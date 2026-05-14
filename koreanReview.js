import { chromium } from "playwright-core";
import pLimit from "p-limit";
import ProductDetail from "./models/ProductDetail.js";
import dbConnect from "./utils/dbConnect.js";

let browser;

if (process.env.NODE_ENV !== "production") {
  const dotenv = await import("dotenv");
  dotenv.config();
}

async function initBrowser() {
  if (browser) return browser;

  browser = await chromium.launch({
    headless: false,
    executablePath:
      process.env.NODE_ENV === "production"
        ? process.env.CHROME_EXECUTABLE_PATH || "/usr/bin/google-chrome-stable"
        : undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-gpu",
      "--no-zygote",
    ],
  });

  console.log("✅ Playwright browser initialized");
  return browser;
}

async function blockUnwantedResources(page) {
  await page.route("**/*", (route) => {
    const blockedTypes = new Set(["image", "font", "media", "texttrack"]);
    const blockedDomains = ["google-analytics.com", "doubleclick.net"];

    const req = route.request();
    const url = req.url();

    if (
      blockedTypes.has(req.resourceType()) ||
      blockedDomains.some((domain) => url.includes(domain))
    ) {
      route.abort();
    } else {
      route.continue();
    }
  });
}

async function openAliExpressProduct(list = [], concurrency = 2) {
  const limit = pLimit(concurrency);
  const results = [];

  const browserInstance = await initBrowser();

  const context = await browserInstance.newContext({
    locale: "ko-KR",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });

  const selector =
    "#nav-review > :nth-child(3) > :nth-child(2) > div:first-child > div:nth-child(4)";

  try {
    const tasks = list.map((product) =>
      limit(async () => {
        if (!product?._id) return;

        const id = String(product._id);
        const url = `https://ko.aliexpress.com/item/${id}.html`;
        const page = await context.newPage();

        try {
          await blockUnwantedResources(page);

          console.log(`🌍 Navigating to ${url}`);

          await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 200000000,
          });

          const target = page.locator(selector);

          await target.waitFor({
            state: "attached",
            timeout: 500000000,
          });

          const text = (await target.textContent())?.trim() || "";
          const koreanReviewCount = text.match(/\((\d+)\)/)?.[1] ?? null;

          results.push({
            id,
            koreanReviewCount: koreanReviewCount
              ? Number(koreanReviewCount)
              : null,
          });

          console.log(`✔ ID ${id} → ${koreanReviewCount}`);
        } catch (err) {
          results.push({
            id,
            koreanReviewCount: null,
            error: err.message,
          });

          console.error(`❌ Error for ID ${id}: ${err.message}`);
        } finally {
          if (!page.isClosed()) {
            await page.close().catch(() => {});
          }
        }
      }),
    );

    await Promise.allSettled(tasks);
    return results;
  } finally {
    await context.close().catch(() => {});
    await browserInstance.close().catch(() => {});
    browser = null;
  }
}

// 사용 예시
// const list = [
//   { id: "1005009084986255" },
//   { id: "1005007612849331" },
//   { id: "1005007612849331" },
//   { id: "1005007612849331" },
//   { id: "1005007612849331" },
// ];

const main = async () => {
  await dbConnect();
  const list = await ProductDetail.find(
    { c3n: "비키니 세트" },
    { _id: 1 },
  ).lean();

  console.log("list", list);

  const results = await openAliExpressProduct(list, 5);
  console.log(JSON.stringify(results, null, 2));
};

main();

// async function openAliExpressProduct(list = [], concurrency = 10) {
//   const limit = pLimit(concurrency);
//   const results = [];

//   await initBrowser();

//   const context = await browser.newContext({
//     locale: "ko-KR",
//     userAgent:
//       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
//     viewport: { width: 1440, height: 900 },
//   });

//   const page = await context.newPage();

//   const tasks = list.map((product) =>
//     limit(async () => {
//       if (!product.id) return;

//       const { id } = product;
//       const page = await context.newPage();
//       await blockUnwantedResources(page);

//       try {
//         console.log(`🌍 Navigating to ${url}`);
//         await page.goto(url, { waitUntil: "domcontentloaded" });

//         await page.waitForFunction(
//           () => {
//             const element = document.querySelector(
//               "#nav-review > :nth-child(3) > :nth-child(2) > div:first-child > div:nth-child(4)",
//             );
//             return element;
//           },
//           { timeout: 80000 },
//         );

//         let koreanReview = await page.evaluate(() => {
//           const element = document.querySelector(
//             "#nav-review > :nth-child(3) > :nth-child(2) > div:first-child > div:nth-child(4)",
//           ).textContent;
//           return element;
//         });

//         results.push({
//           id: id,
//           koreanReview: koreanReview,
//         });

//         console.log(`✔ ID ${id} / Grade ${grade} → ${datacenterTitle}`);
//       } catch (err) {
//         console.error(`❌ Error for ID ${id}, Grade ${grade}:`, err.message);
//       } finally {
//         await page.close();
//       }
//     }),
//   );

//   await blockUnwantedResources(page);

//   const url = "https://ko.aliexpress.com/item/1005009084986255.html";

//   try {
//     console.log(`🌍 Navigating to ${url}`);
//     await page.goto(url, {
//       waitUntil: "domcontentloaded",
//       timeout: 30000,
//     });

//     await page
//       .waitForLoadState("networkidle", { timeout: 15000 })
//       .catch(() => {});

//     const navReview = page.locator(
//       "#nav-review > :nth-child(3) > :nth-child(2) > div:first-child > div:nth-child(4)",
//     );

//     console.log("count:", await navReview.count());

//     if ((await navReview.count()) > 0) {
//       console.log("text:", (await navReview.textContent())?.trim());
//       console.log("html:", await navReview.innerHTML());
//     } else {
//       console.log("#nav-review not found");
//     }

//     await page.screenshot({ path: "aliexpress-product.png", fullPage: true });
//   } catch (error) {
//     console.error("❌ Error opening AliExpress page:", error.message);
//   } finally {
//     await page.close();
//     await context.close();
//     await browser.close();
//     browser = null;
//   }
// }
