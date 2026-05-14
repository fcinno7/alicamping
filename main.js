// filename: fetchPopularKR.fixed.js
// Node 18+, package.json: { "type": "module" }
import crypto from "crypto";
import "dotenv/config";
import pLimit from "p-limit";
import { getSkuDetail } from "./skuIdPruductSearch.js";
import ProductDetail from "./models/ProductDetail.js";
import dbConnect from "./utils/dbConnect.js";
import { dateKeyKST } from "./utils/dateKeyKST.js";
import mongoose from "mongoose";
import { assert } from "console";
// import ProductCategories from "./models/ProductCategories.js";
import ProductCategories from "./models/ProductCategories.js";
import { getProductDetailsById } from "./getProductDetailById.js";
import {
  translateSkuPropertiesSimple,
  VALUE_MAP,
} from "./utils/skuTranslate.js";
import {
  normalizeCForCompare,
  normalizeSpForCompare,
  stripForCompare,
} from "./utils/normalize.js";
import { withRetry } from "./utils/withRetry.js";
import { fetchByCategory } from "./utils/fetchByCategory.js";
import { computePriceFields } from "./utils/computePriceFields.js";

const SYNONYM_KEY_MAP = { 색깔: "색상" };

const limit = pLimit(10); // 동시에 10개만 실행

// ─────────────────────────────────────────────────────────────────────────────
//  실패 무해 try/catch, 배열 정규화

const PL_BASE1 = "https://s.click.aliexpress.com/s/";
const PL_BASE2 = "http://s.click.aliexpress.com/s/";
const IMAGE_BASE1 = "https://ae-pic-a1.aliexpress-media.com/kf/";
const IMAGE_BASE2 = "http://ae-pic-a1.aliexpress-media.com/kf/";

const tryCatch = async (fn) => {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    return { ok: false, error: e };
  }
};
// 특수문자 이스케이프 + 문자 사이사이에 \s* 허용

const ZWSP = "\u200B"; // 제로폭 공백(실제 문자)
const NBSP = "\u00A0"; // NBSP(실제 문자)

function setPdPrice(targetSku, todayKey, price) {
  const safePrice = Number(price);
  if (!Number.isFinite(safePrice) || safePrice < 0) return;

  if (!targetSku.pd || typeof targetSku.pd !== "object") {
    targetSku.pd = {};
  }

  targetSku.pd[todayKey] = { s: safePrice };

  const istargetSku = targetSku.pd[todayKey] ? true : false;

  return istargetSku;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // 특수문자 리터럴화
}

function makeSpaceAgnosticPattern(raw) {
  const cleaned = String(raw).normalize("NFKC");

  // 허용할 잡음 문자 집합(괄호/공백/구두점/제로폭/NBSP/하이픈/언더스코어)
  const SEP = `[\\s()\\[\\]{}:;,'"\`·•・ㆍ·\\-_${ZWSP}${NBSP}]*`;

  // ❗️여기 바뀜: 문자 단위로 나눈 후 각 문자 escape → SEP로 join
  const body = Array.from(cleaned)
    .map((ch) => escapeRegex(ch))
    .join(SEP);

  return `^${SEP}${body}${SEP}$`;
}

// const makeSpaceAgnosticPattern = (raw) => {
//   const canon = String(raw ?? "")
//     .normalize("NFKC")
//     .replace(/\s+/g, ""); // 모든 공백 제거
//   return canon.length
//     ? canon.split("").map(escapeRegExp).join("\\s*") // 문자 사이에 임의 공백 허용
//     : ".*";
// };

function deepSortObjectKeysKo(input) {
  if (Array.isArray(input)) return input.map(deepSortObjectKeysKo);
  if (input && typeof input === "object") {
    const sorted = Object.entries(input)
      .map(([k, v]) => [normKey(k), deepSortObjectKeysKo(v)])
      .sort(([a], [b]) => koCollator.compare(a, b));
    return Object.fromEntries(sorted);
  }
  return input;
}

function sortArrayOfObjectsStable(arr) {
  return arr
    .map((o) => deepSortObjectKeysKo(o))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function stripMinimal(s) {
  return String(s ?? "").replace(/[{}\[\]\(\)\"\s]/g, "");
}

// 비교용 정규화: 지정 특수문자 + 공백 제거
// function stripForCompare(s) {
//   return String(s ?? "").replace(/[{}\[\]\(\)\"\s]/g, "");
// }

// sp 비교용 정규화
// function normalizeSpForCompare(spStr) {
//   if (typeof spStr !== "string") return stripForCompare(spStr);
//   // 1) JSON 파싱 시도
//   try {
//     let arr = JSON.parse(spStr);
//     if (!Array.isArray(arr)) arr = [arr];
//     // 2) 동의어 키 매핑 (선택)
//     const mapped = arr.map((obj) => {
//       const out = {};
//       for (const [k, v] of Object.entries(obj || {})) {
//         const nk = USE_SYNONYM_MAP ? SYNONYM_KEY_MAP[k] || k : k;
//         out[nk] = v;
//       }
//       // 키 정렬로 직렬화 안정화
//       return Object.fromEntries(
//         Object.entries(out).sort(([a], [b]) => (a > b ? 1 : -1))
//       );
//     });
//     // 3) 안정적 직렬화 후 strip
//     const stable = JSON.stringify(mapped);
//     return stripForCompare(stable);
//   } catch {
//     // 파싱 불가 → 그냥 strip 규칙만 적용
//     return stripForCompare(spStr);
//   }
// }

// sp 비교용 정규화
// export function normalizeSpForCompare(spStr) {
//   // 1) JSON 파싱 시도
//   try {
//     let arr = JSON.parse(spStr);
//     if (!Array.isArray(arr)) arr = [arr];

//     const trans = stripForCompare(spStr);

//     // 3) 안정적 직렬화 후 strip
//     const stable = JSON.stringify(trans);
//     return stripForCompare(stable);
//   } catch {
//     // 파싱 불가 → 그냥 strip 규칙만 적용
//     return stripForCompare(spStr);
//   }
// }

const parseSkuProps = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const arr = JSON.parse(val);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  return [];
};

const isEmptyProps = (arr) =>
  !arr ||
  arr.length === 0 ||
  (arr.length === 1 && Object.keys(arr[0] || {}).length === 0);

// 키 동의어: '색깔' → '색상'
const KEY_SYNONYM = Object.freeze({
  색깔: "색상",
});

const canonSkuProps = (arr) => {
  const a = parseSkuProps(arr);
  if (isEmptyProps(a)) return "";

  const canonArr = a.map((obj) => {
    // 1) 키/값 정규화 + 동의어 치환 (키/값 모두 KEY_SYNONYM 사용)
    const pairs = [];
    for (const [k, v] of Object.entries(obj || {})) {
      const kNorm = norm(k);
      const kMapped = VALUE_MAP[k] ?? VALUE_MAP[kNorm] ?? kNorm;

      const vRaw = String(v).trim();
      const vNorm = norm(vRaw);
      const vMapped = VALUE_MAP[vRaw] ?? VALUE_MAP[vNorm] ?? vNorm;

      pairs.push([kMapped, vMapped]);
    }

    // 2) 키 정렬(직렬화 안정화)
    pairs.sort(([k1], [k2]) => (k1 > k2 ? 1 : k1 < k2 ? -1 : 0));

    // 3) 동의어 치환으로 생긴 중복 키 병합(첫 값 우선)
    const merged = {};
    for (const [k, v] of pairs) {
      if (!(k in merged)) merged[k] = v;
    }

    return merged;
  });

  return JSON.stringify(canonArr);
};

const norm = (v) =>
  (v ?? "") // null/undefined 방어
    .toString() // 문자열화
    .replace(/[\s\u200B-\u200D\uFEFF]/g, ""); // 일반 공백 + 제로폭 공백 제거

// const FIELDS = [
//   "product_id",
//   "product_title",
//   "product_detail_url",
//   "product_main_image_url",
//   "target_app_sale_price",
//   "target_app_sale_price_currency",
//   "promotion_link",
//   "lastest_volume",
//   "review_count",
//   "first_level_category_id",
//   "first_level_category_name",
//   "second_level_category_id",
//   "second_level_category_name",
// ].join(",");

// ───────────────────────── 재시도 유틸 ─────────────────────────

/**
 * fetch → JSON 파싱까지 포함한 재시도 래퍼
 * - 429/5xx/타임아웃/네트워크 오류(ECONNRESET 등) 시 지수백오프(+지터)로 재시도
 */
// async function fetchJsonWithRetry(
//   url,
//   {
//     retries = 1, // 총 2회(0..4)
//     base = 600, // 시작 지연(ms)
//     factor = 2,
//     jitter = 0.35,
//     max = 10000,
//     timeoutMs = 18000,
//     fetchInit = {},
//   } = {}
// ) {
//   for (let attempt = 0; attempt <= retries; attempt++) {
//     const ctrl = new AbortController();
//     const to = setTimeout(() => ctrl.abort(), timeoutMs);
//     try {
//       const res = await fetch(url, { signal: ctrl.signal, ...fetchInit });
//       clearTimeout(to);

//       if (res.ok) {
//         const txt = await res.text();
//         try {
//           return JSON.parse(txt);
//         } catch {
//           return {};
//         }
//       }

//       // 429/5xx → 재시도
//       if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
//         if (attempt === retries)
//           throw new Error(`HTTP ${res.status} (max retry)`);
//         const ra = res.headers.get("retry-after");
//         const delay = ra
//           ? Number(ra) * 1000
//           : calcDelay({ base, factor, attempt, jitter, max });
//         await sleep(delay);
//         continue;
//       }

//       // 그 외 4xx → 즉시 실패
//       const body = await res.text().catch(() => "");
//       throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
//     } catch (err) {
//       clearTimeout(to);
//       const code = err?.cause?.code || err?.code;
//       const isAbort = err?.name === "AbortError";
//       const transient =
//         isAbort ||
//         code === "ECONNRESET" ||
//         code === "ETIMEDOUT" ||
//         code === "EAI_AGAIN";
//       if (!transient || attempt === retries) throw err;
//       const delay = calcDelay({ base, factor, attempt, jitter, max });
//       await sleep(delay);
//     }
//   }
// }

/**
 * 임의 함수 재시도(예: getSkuDetail)
 */
// export async function withRetry(fn, opts = {}) {
//   const {
//     retries = 3,
//     base = 800,
//     factor = 2,
//     jitter = 0.3,
//     max = 10000,
//   } = opts;
//   for (let attempt = 0; attempt <= retries; attempt++) {
//     try {
//       return await fn();
//     } catch (err) {
//       const code = err?.cause?.code || err?.code;
//       const transient =
//         code === "ECONNRESET" || code === "ETIMEDOUT" || code === "EAI_AGAIN";
//       if (!transient && attempt === 0) throw err; // 비일시적이면 즉시
//       if (attempt === retries) throw err;
//       const delay = calcDelay({ base, factor, attempt, jitter, max });
//       await sleep(delay);
//     }
//   }
// }

// function signSha256(params, secret) {
//   const base = Object.keys(params)
//     .filter(
//       (k) => params[k] !== undefined && params[k] !== null && k !== "sign"
//     )
//     .sort()
//     .map((k) => k + params[k])
//     .join("");
//   return crypto
//     .createHmac("sha256", secret)
//     .update(base, "utf8")
//     .digest("hex")
//     .toUpperCase();
// }

// function parseProducts(raw) {
//   const arr =
//     raw?.aliexpress_affiliate_product_query_response?.resp_result?.result
//       ?.products?.product ??
//     raw?.resp_result?.result?.products?.product ??
//     raw?.result?.products?.product ??
//     [];
//   return Array.isArray(arr) ? arr : [];
// }

// function normalize(p) {
//   // if (p.lastest_volume > 0) console.log("p:", p);

//   console.log("p", p);

//   return {
//     _id: p.product_id,
//     // title: p.product_title,
//     // price: p.target_app_sale_price,
//     // currency: p.target_app_sale_price_currency,
//     // image: p.product_main_image_url,
//     promotion_link: p.promotion_link,
//     // c1_id: p.first_level_category_id,
//     // c1_name: p.first_level_category_name,
//     // c2_id: p.second_level_category_id,
//     // c2_name: p.second_level_category_name,
//     volume: p.lastest_volume,
//   };
// }

// export async function fetchByCategory({ categoryId }) {
//   const pageSize = 50;
//   const allItems = [];
//   let pageNo = 1;
//   let breakNo = 0;
//   let lastRaw = null;
//   let totalServerCount = 0;
//   let totalFilteredCount = 0;

//   while (true) {
//     const params = {
//       app_key: APP_KEY,
//       method: METHOD,
//       sign_method: "sha256",
//       timestamp: Date.now(), // epoch(ms)
//       v: "1.0",
//       // biz
//       tracking_id: TRACKING_ID,
//       page_no: pageNo,
//       page_size: pageSize,
//       target_language: "KO",
//       target_currency: "KRW",
//       ship_to_country: "KR",
//       // country: "KR", // 필요 시만 사용

//       //  SALE_PRICE_ASC → 가격 낮은 순
//       // SALE_PRICE_DESC → 가격 높은 순
//       // LAST_VOLUME_ASC → 최근 판매량 낮은 순
//       // LAST_VOLUME_DESC → 최근 판매량 높은 순
//       sort: "LAST_VOLUME_DESC",

//       fields: FIELDS,
//       // 카테고리: 서버가 먹는 키를 모두 전달
//       category_ids: String(categoryId),
//       // category_id: String(categoryId),
//       // keywords: "", // 섞임 방지로 비움
//     };
//     params.sign = signSha256(params, APP_SECRET);

//     const url = API + "?" + new URLSearchParams(params).toString();
//     // const res = await fetch(url);
//     // const raw = await res.json().catch(() => ({}));
//     const raw = await fetchJsonWithRetry(url);

//     lastRaw = raw;

//     // 에러 그대로 전달하되, 형태는 아래 호출부와 호환되게 유지
//     if (raw?.error_response) {
//       return {
//         items: [],
//         raw,
//         serverCount: 0,
//         filteredCount: 0,
//         note: "error_response",
//       };
//     }

//     // 서버 반환
//     const products = parseProducts(raw);
//     const filtered = products.filter(
//       (p) =>
//         Number(p.first_level_category_id) === Number(categoryId) ||
//         Number(p.second_level_category_id) === Number(categoryId)
//     );

//     const final = (filtered.length ? filtered : products).map(normalize);

//     totalServerCount += products.length;
//     totalFilteredCount += filtered.length;

//     // 현 페이지 결과 누적
//     if (final.length > 0) {
//       allItems.push(...final);
//     }

//     // 종료 조건:
//     // - 서버가 더 이상 주지 않음 (0개)
//     // - 페이지 크기 미만(마지막 페이지로 추정)
//     if (products.length === 0 && products.length < pageSize) {
//       if (breakNo === 2) {
//         break;
//       }
//       breakNo++;
//     } else {
//       breakNo = 0;
//       pageNo++;
//     }
//   }

//   return {
//     items: allItems,
//     raw: lastRaw, // 마지막 페이지 raw
//     serverCount: totalServerCount,
//     filteredCount: totalFilteredCount,
//   };
// }

(async () => {
  await dbConnect();

  // const divided = [
  //   // ------------------------- 여성 의류 -----------------------------

  //   {
  //     cId: "200075142", // 낚시
  //     cn: "낚시 도구",
  //     categorieList: [
  //       {
  //         cId: "200075142", // 가죽
  //         cn: "낚시 도구",
  //       },
  //     ],
  //   },
  //   {},
  // ];

  const divided = [
    // {
    //   cId: "100005529",
    //   c2n: "캠핑 & 하이킹",
    // },
    // {
    //   cId: "200003625", // 깔차
    //   c3n: "깔창",
    //   categorieList: null,
    // },
    // {
    //   cId: "100005530",
    //   c3n: "나침반",
    //   categorieList: null,
    // },
    // {
    //   cId: "201524202",
    //   c3n: "단안경",
    //   categorieList: null,
    // },
    // {
    //   cId: "200003624",
    //   c3n: "등산 스카프",
    //   categorieList: null,
    // },
    // {
    //   cId: "100005536",
    //   c3n: "등산 스틱",
    //   categorieList: null,
    // },
    // {
    //   cId: "200015143",
    //   c3n: "로프",
    //   categorieList: null,
    // },
    // {
    //   cId: "200001987",
    //   c3n: "망원경",
    //   categorieList: null,
    // },
    // {
    //   cId: "200016142",
    //   c3n: "보호장비",
    //   categorieList: null,
    // },
    // -------------------------------------------------------------- 1 -----------------------------------------------------
    // {
    //   cId: "200003626",
    //   c3n: "아웃도어 가방",
    //   categorieList: null,
    // },
    // {
    //   cId: "200000548",
    //   c3n: "아웃도어 의류 & 액세서리",
    //   categorieList: [
    //     {
    //       cId: "200003644",
    //       c4n: "고글",
    //     },
    //     {
    //       cId: "200003608",
    //       c4n: "다운",
    //     },
    //     {
    //       cId: "200000573",
    //       c4n: "바지",
    //     },
    //     {
    //       cId: "200000584",
    //       c4n: "반바지",
    //     },
    //     {
    //       cId: "200000577",
    //       c4n: "셔츠",
    //     },
    //     {
    //       cId: "200002214",
    //       c4n: "자켓",
    //     },
    //     {
    //       cId: "200003555",
    //       c4n: "장갑",
    //     },
    //     {
    //       cId: "201514601",
    //       c4n: "전자 야외 의류 및 액세서리",
    //     },
    //     {
    //       cId: "200003623",
    //       c4n: "조끼",
    //     },
    //     {
    //       cId: "200002216",
    //       c4n: "티셔츠",
    //     },
    //     {
    //       cId: "202183203",
    //       c4n: "하이킹 Gaiters",
    //     },
    //   ],
    // },
    // {
    //   cId: "200015142",
    //   c3n: "아웃도어 장비",
    //   categorieList: null,
    // },
    // {
    //   cId: "201518502",
    //   c3n: "조류관찰",
    //   categorieList: null,
    // },
    // {
    //   cId: "201519801",
    //   c3n: "천문 관측",
    //   categorieList: null,
    //   // 천문관측 카테고리
    //   //  '가이드 스코프'
    //   //  '더블 헬리컬 포커서'
    //   //  '도베테일 마운팅 플레이트'
    //   //  '듀 히터'
    //   //  '바로우 렌즈'
    //   //  '바티노프 마스크'
    //   //  '사선 미러'
    //   //  '사진 확장 튜브'
    //   //  '삼각대'
    //   //  '어댑터'
    //   //  '전기 접안렌즈'
    //   //  '접안렌즈/접안렌즈 수트'
    //   //  '천문 망원경'
    //   //  '천문 액세서리'
    //   //  '카메라 마운트 어댑터'
    //   //  '카메라 폰 홀더'
    //   //  '필터'
    //   //  '필터 휠'
    // },
    // {
    //   cId: "201173908",
    //   c3n: "캠핑 가구",
    //   categorieList: [
    //     {
    //       cId: "201169110",
    //       c4n: "야전침대",
    //     },
    //     {
    //       cId: "201170908",
    //       c4n: "캠핑 스툴",
    //     },
    //     {
    //       cId: "201172606",
    //       c4n: "캠핑 의자",
    //     },
    //     {
    //       cId: "201172010",
    //       c4n: "캠핑 테이블",
    //     },
    //   ],
    // },
    // {
    //   cId: "100007472",
    //   c3n: "캠핑 매트",
    //   categorieList: null,
    // },
    // -------------------------------------------------------------- 2 -----------------------------------------------------
    {
      cId: "201171006",
      c3n: "캠핑 조리기구",
      categorieList: [
        {
          cId: "200004182",
          c4n: "스포츠 물병",
        },
        {
          cId: "201173110",
          c4n: "아이스박스",
        },
        {
          cId: "200002211",
          c4n: "야외 식기",
        },
        {
          cId: "200003609",
          c4n: "워터백",
        },
        {
          cId: "201170012",
          c4n: "캠핑 정수필터",
        },
        {
          cId: "201169306",
          c4n: "캠핑 조리기구",
        },
        {
          cId: "200002210",
          c4n: "캠핑 화로 & 버너",
        },
        {
          cId: "200003610",
          c4n: "피크닉 가방",
        },
      ],
    },
    {
      cId: "201175211",
      c3n: "캠핑 침구",
      categorieList: [
        {
          cId: "201169007",
          c4n: "에어매트",
        },
        {
          cId: "201171710",
          c4n: "자 Pads",
        },
        {
          cId: "201172209",
          c4n: "침낭 라이너",
        },
        {
          cId: "100005533",
          c4n: "침낭 패드",
        },
        {
          cId: "201170113",
          c4n: "캠핑 담요",
        },
        {
          cId: "201169907",
          c4n: "캠핑 베개",
        },
      ],
    },
    {
      cId: "200143142",
      c3n: "클라이밍 장비",
      categorieList: null,
    },
    {
      cId: "201174907",
      c3n: "텐트 & 그늘막",
      categorieList: [
        {
          cId: "100005844",
          c4n: "그늘막",
        },
        {
          cId: "100005535",
          c4n: "텐트",
        },
        {
          cId: "200003906",
          c4n: "텐트 액세서리",
        },
      ],
    },
  ];

  const categoryItem = divided;

  const cnfields = ["c2n", "c3n", "c4n"];
  //

  const listTasks = { item: [], dataBaseRes: [] };

  // -------------------------------------------------------------------- 카테고리 전체 ----------------------------------------------------------

  // const c1nItem = await fetchByCategory({
  //   categoryId: categoryItem.cId,
  // });

  // console.log("c1nitem", c1nItem.items.length);

  // listTasks.item.push(...c1nItem.items);

  const categoryRes = categoryItem
    // .slice(Math.round(divided[10].length / 2), Math.round(divided[10].length))
    .map((item) =>
      limit(async () => {
        if (item?.categorieList?.length >= 1) {
          for (let category of item.categorieList) {
            const res = await ProductDetail.find({
              c4n: category.c4n,
            })
              .populate("cId1", "cId cn")
              .populate("cId2", "cId cn")
              .select("_id vol")
              .lean();

            const { items, raw, serverCount, filteredCount, note } =
              await fetchByCategory({
                categoryId: category.cId,
              });

            console.log("cid:", category?.cId);
            console.log("CN:", category?.c4n);
            console.log("items:", items?.length);
            console.log("res:", res?.length);

            listTasks.item.push(...items);
            listTasks.dataBaseRes.push(...res);
          }
        } else {
          const res = await ProductDetail.find({
            c3n: item.c3n,
          })
            .populate("cId1", "cId cn")
            .populate("cId2", "cId cn")
            .select("_id vol")
            .lean();

          const { items, raw, serverCount, filteredCount, note } =
            await fetchByCategory({
              categoryId: item.cId,
            });
          console.log("cid:", item?.cId);
          console.log("cn:", item?.c3n);
          console.log("items:", items?.length);
          console.log("res:", res?.length);

          listTasks.item.push(...items);
          listTasks.dataBaseRes.push(...res);
        }

        //  fetchByCategory안에 filtered 변수도 볼 것 !

        //  fetchByCategory 에서 요청을 volume 이 170 이상인것만 받아옴 수정할려면 normalize함수 볼 것
      }),
    );

  await Promise.allSettled(categoryRes);

  // 단일 데이터베이스 요청

  // const categoryRes = async () => {
  //   let res = await ProductDetail.find({ _id: "1005012200259825" })
  //     .populate("cId1", "cId cn")
  //     .populate("cId2", "cId cn")
  //     .lean({ virtuals: true });

  //   // listTasks.item.push(...items);
  //   listTasks.dataBaseRes.push({ _id: "1005012200259825" });
  //   listTasks.dataBaseRes.push(...res);
  // };

  // await categoryRes();

  //  단일 카테고리 요청
  // const categoryRes = async () => {
  //   const item = {
  //     cId: "201515701",
  //   };

  //   const { items, raw, serverCount, filteredCount, note } =
  //     await fetchByCategory({
  //       categoryId: item.cId,
  //     });

  //   listTasks.item.push(...items);
  // };

  // await categoryRes();

  // 데이터베이스에 있는건 volume 200 안넘어도 업데이트

  // await processDivided(divided, listTasks);

  console.log("dataBaseRes", listTasks.dataBaseRes.length);
  console.log("item", listTasks.item.length);

  const items = (listTasks.item ?? []).filter((p) => {
    return Number(p?.volume) >= 1;
  });
  const dbs = listTasks.dataBaseRes ?? [];

  const merged = [
    ...items, // item 뒤 (우선권)
    ...dbs, // DB 먼저
  ];

  console.log("dbs:", dbs.length);
  console.log("merged:", merged.length);

  // ------------ 중복검사 --------------

  const seen = new Set();
  const uniqueList = [];
  for (const p of merged) {
    const id = String(p._id);
    if (seen.has(id)) continue;
    seen.add(id);
    uniqueList.push(p);
  }

  // // ----------------중복검사---------------

  console.log("uniqueList:", uniqueList.length);

  // ------------------------------

  const failedIds = [];

  await Promise.all(
    uniqueList.map((item) =>
      limit(async () => {
        try {
          // 0) 외부 API
          const productIds = [item._id];

          const skuData = await withRetry(() => getSkuDetail(item._id), {
            retries: 1,
            base: 800,
            max: 10000,
          });

          const info = skuData?.ae_item_info ?? {};
          const sku = skuData?.ae_item_sku_info ?? {};
          const skuList = sku.traffic_sku_info_list ?? [];

          // ---- 카테고리 참조 매핑 (두 개 한번에) ----

          const cId1 = await ProductCategories.findOne({
            cId: String(info?.display_category_id_l1),
          });
          const cId2 = await ProductCategories.findOne({
            cId: String(info?.display_category_id_l2),
          });
          // console.log("cId1:", cId1);

          // 1) 파생값
          const productId = String(item._id); // ← 스키마가 String이므로 문자열 고정
          const todayKey = dateKeyKST(); // "YYYY-MM-DD" (KST)

          // 2) 본문(upsert) 베이스

          const baseDoc = {};

          // console.log("item:", item);
          // console.log("volume:", volume);
          // console.log("item.volume:", item.volume);
          // console.log("item._id:", item._id);

          if (item.volume && Number(item.volume) !== 0) {
            baseDoc.vol = item.volume;
          } else {
            const pdRes = await tryCatch(() =>
              withRetry(() => getProductDetailsById(productIds), {
                retries: 2,
                base: 800,
                max: 10000,
              }),
            );
            const productData = pdRes.ok ? pdRes.value : null;

            if (Number(productData?.items[0]?.volume) > 0) {
              baseDoc.vol = productData.items[0].volume;
            }
          }

          // if (
          //   info.original_link &&
          //   stripForCompare(info.original_link) !== ""
          // ) {
          //   baseDoc.ol = info.original_link;
          // }

          // console.log("item.promotion_link", item.promotion_link);

          // https://s.click.aliexpress.com/s/ 문자열을 빼서 데이터공간 저장 확보

          if (
            item.promotion_link &&
            stripForCompare(item.promotion_link) !== ""
          ) {
            if (
              item?.promotion_link &&
              item.promotion_link.startsWith(PL_BASE1)
            ) {
              item.promotion_link = item.promotion_link.slice(PL_BASE1.length);
            } else if (
              item?.promotion_link &&
              item.promotion_link.startsWith(PL_BASE2)
            ) {
              item.promotion_link = item.promotion_link.slice(PL_BASE2.length);
            }
            baseDoc.pl = item.promotion_link;
          } else if (item.pl && stripForCompare(item.pl) !== "") {
            if (item?.pl && item.pl.startsWith(PL_BASE1)) {
              item.pl = item.pl.slice(PL_BASE1.length);
            } else if (item?.pl && item.pl.startsWith(PL_BASE2)) {
              item.pl = item.pl.slice(PL_BASE2.length);
            }
            baseDoc.pl = item.pl;

            // pl값이 비어있으면 새로운 pl값 넣기
          } else if (!item?.pl && stripForCompare(item.pl) === "") {
            const pdRes = await tryCatch(() =>
              withRetry(() => getProductDetailsById(productIds), {
                retries: 2,
                base: 800,
                max: 10000,
              }),
            );

            const productData = pdRes.ok ? pdRes.value : null;
            let promotion_link = productData.items[0]._raw.promotion_link;

            if (promotion_link && promotion_link.startsWith(PL_BASE1)) {
              promotion_link = promotion_link.slice(PL_BASE1.length);
            } else if (promotion_link && promotion_link.startsWith(PL_BASE2)) {
              promotion_link = promotion_link.slice(PL_BASE2.length);
            }

            baseDoc.pl = promotion_link;
          }

          //  ----------------------------il https://ae-pic-a1.aliexpress-media.com/kf/ 데이터베이스 저장공간 줄이기-------------------------------------------

          if (info.image_link && stripForCompare(info.image_link) !== "") {
            if (info.image_link && info.image_link.startsWith(IMAGE_BASE1)) {
              info.image_link = info.image_link.slice(IMAGE_BASE1.length);
            } else if (
              info.image_link &&
              info.image_link.startsWith(IMAGE_BASE2)
            ) {
              info.image_link = info.image_link.slice(IMAGE_BASE2.length);
            }
            baseDoc.il = info.image_link;
          }

          //  ----------------------------ail https://ae-pic-a1.aliexpress-media.com/kf/ 데이터베이스 저장공간 줄이기-------------------------------------------

          if (
            info.additional_image_links?.string &&
            info.additional_image_links?.string.length >= 1
          ) {
            const imgLink = [];
            for (let ImgLink of info.additional_image_links?.string) {
              if (ImgLink && ImgLink.startsWith(IMAGE_BASE1)) {
                ImgLink = ImgLink.slice(IMAGE_BASE1.length);
              } else if (ImgLink && ImgLink.startsWith(IMAGE_BASE2)) {
                ImgLink = ImgLink.slice(IMAGE_BASE2.length);
              }
              imgLink.push(ImgLink);
            }
            baseDoc.ail = imgLink;
          }

          if (cId1) {
            baseDoc.cId1 = cId1;
          }
          if (cId2) {
            baseDoc.cId2 = cId2;
          }

          if (info?.display_category_name_l1) {
            baseDoc.c1n = info.display_category_name_l1;
          }
          if (info?.display_category_name_l2) {
            baseDoc.c2n = info.display_category_name_l2;
          }
          if (info?.display_category_name_l3) {
            baseDoc.c3n = info.display_category_name_l3;
          }
          if (info?.display_category_name_l4) {
            baseDoc.c4n = info.display_category_name_l4;
          }

          if (info.title && stripForCompare(info.title) !== "") {
            baseDoc.tt = info.title;
          }
          if (info.product_score && Number(info.product_score) !== 0) {
            baseDoc.ps = info.product_score;
          }
          if (info.review_number && Number(info.review_number) !== 0) {
            baseDoc.rn = info.review_number;
          }

          // const baseDoc = {
          //   vol: item.volume ?? 0,
          //   ol: info.original_link ?? "",
          //   pl: item.promotion_link ?? "",

          //   // ref 필드에는 반드시 _id(ObjectId)만
          //   cId1: cId1, // 없으면 undefined → $set에서 무시됨
          //   cId2: cId2,

          //   tt: info.title ?? "",
          //   st: info.store_name ?? "",
          //   ps: info.product_score ?? 0,
          //   rn: info.review_number ?? 0,
          //   il: info.image_link ?? "",
          //   ail: info.additional_image_links?.string ?? [],
          // };

          // 3) 최초 생성 시에만 넣을 SKU 전체(오늘 포인트 포함) — 임베디드 구조

          const skusForInsert = skuList.map((s) => {
            return {
              // sId: String(s.sku_id), // 문자열로 통일
              c: normalizeCForCompare(s.color ?? ""), // 정규화 통일
              sp: canonSkuProps(s.sku_properties ?? ""), // 정규화 통일
              spKey: normalizeSpForCompare(s.sku_properties ?? ""), // 정규화 통일
              cur: s.currency ?? "KRW",
              pd: {
                [todayKey]: {
                  s: Number(s.sale_price_with_tax ?? 1),
                  t: new Date(),
                },
              },
            };
          });

          // 4) 기존 문서의 sku_id 집합만 얇게 조회 — 경로 "sku_info.sil"
          let doc = await ProductDetail.findById(productId)
            .select(
              "sku_info.sil.c sku_info.sil.sp sku_info.sil.pd sku_info.sil.spKey",
            )
            .lean();

          const toNum = (v) => (v == null ? NaN : +v);
          const safeNorm = (v) => norm(v ?? "");
          const toKey1 = (color, props) =>
            `\u0001${normalizeCForCompare(color)}\u0001${normalizeSpForCompare(
              props,
            )}`;
          const toKey2 = (color, props) =>
            `\u0001${normalizeCForCompare(color)}\u0001${canonSkuProps(props)}`;
          // const toKey3 = (sid, color, props) =>
          //   `${String(sid)}
          //   \u0001${normalizeSpForCompare(props)}`;
          // const toKey4 = (sid, color, props) =>
          //   `${String(sid)}
          //   \u0001${canonSkuProps(props)}`;

          // 필요한 필드만

          const sil = doc?.sku_info?.sil ?? [];
          console.log("sil", sil);
          // const existingIds = new Set(
          //   (doc?.sku_info?.sil ?? []).map((d) => String(d?.sId))
          // );
          const skuMap1 = new Map();
          const skuMap2 = new Map();
          // const skuMap3 = new Map();
          // const skuMap4 = new Map();
          for (const sku of sil) {
            const i = toKey1(sku?.c, sku?.sp);
            const j = toKey2(sku?.c, sku?.sp);
            // const k = toKey2(sku?.sId, sku?.sp);
            // const z = toKey2(sku?.sId, sku?.sp);

            skuMap1.set(i, sku);
            skuMap2.set(j, sku);
            // skuMap3.set(k, sku);
            // skuMap4.set(z, sku);
          }

          const newSkus = [];
          const updSkus = [];
          const lowPriceUpdSkus = [];

          for (const item1 of skuList) {
            console.log("1");

            const key1 = toKey1(item1?.color, item1?.sku_properties);
            let matchedSku = skuMap1.get(key1);

            if (!matchedSku) {
              const key2 = toKey2(item1?.color, item1?.sku_properties);
              matchedSku = skuMap2.get(key2);
            }

            if (!matchedSku) {
              newSkus.push(item1);
              continue;
            }

            const docToday = matchedSku?.pd?.[todayKey];
            const docSale = toNum(docToday?.s);
            const incomingSale = toNum(
              item1?.sale_price_with_tax ?? item1?.sale_price,
            );

            if (docToday) {
              lowPriceUpdSkus.push(item1);
            } else {
              updSkus.push(item1);
            }

            setPdPrice(matchedSku, todayKey, incomingSale);
          }

          // 5) bulkWrite 준비
          const ops = [];

          console.log("2");

          // 5-1) 본문 upsert
          ops.push({
            updateOne: {
              filter: { _id: productId },
              update: {
                $set: baseDoc,
                $setOnInsert: {
                  // _id는 filter에서 고정
                  "sku_info.sil": skusForInsert,
                },
              },
              upsert: true,
            },
          });

          const colorNorm = (v) => norm(v ?? "");

          // 5-2) 금일 첫 sku 업데이트 (오늘 키가 없던 케이스)
          for (const s of updSkus) {
            // const sId = String(s.sku_id);
            const cNorm = normalizeCForCompare(s.color);
            const spCanon = canonSkuProps(s.sku_properties);

            const spRegex = makeSpaceAgnosticPattern(spCanon);
            const cRegex = makeSpaceAgnosticPattern(cNorm);

            const spKey = normalizeSpForCompare(s.sku_properties);

            console.log("item:", item._id);
            console.log("금일 첫 업데이트!");

            const pricePoint = {
              s: Number(s.sale_price_with_tax),
            };

            ops.push({
              updateOne: {
                filter: { _id: productId },
                update: {
                  $set: {
                    // "sku_info.sil.$[e].sId": sId,
                    "sku_info.sil.$[e].c": cNorm,
                    "sku_info.sil.$[e].link": s.link ?? "",
                    "sku_info.sil.$[e].sp": spCanon,
                    "sku_info.sil.$[e].spKey": spKey,
                    "sku_info.sil.$[e].cur": s.currency ?? "KRW",
                    [`sku_info.sil.$[e].pd.${todayKey}`]: pricePoint,
                  },
                },
                arrayFilters: [
                  {
                    // "e.sId": sId,
                    $and: [
                      {
                        $or: [
                          { "e.c": cNorm },
                          { "e.c": { $regex: cRegex, $options: "x" } },
                        ],
                      },
                      {
                        $or: [
                          { "e.spKey": spKey },
                          { "e.sp": spCanon },
                          { "e.sp": s.sku_properties },
                        ],
                      },
                    ],
                  },
                ],
              },
            });
          }

          // 5-3) 오늘 갱신했지만 가격이 바뀐 경우
          for (const s of lowPriceUpdSkus) {
            // const sId = String(s.sku_id);
            const cNorm = normalizeCForCompare(s.color);
            const spCanon = canonSkuProps(s.sku_properties);

            const spKey = normalizeSpForCompare(s.sku_properties);

            const spRegex = makeSpaceAgnosticPattern(spCanon);
            const cRegex = makeSpaceAgnosticPattern(cNorm);

            console.log("item:", item._id);
            console.log("가격 바뀜");

            const pricePoint = {
              s: Number(s.sale_price_with_tax),
            };

            ops.push({
              updateOne: {
                filter: { _id: productId },
                update: {
                  $set: {
                    // "sku_info.sil.$[e].sId": sId,
                    "sku_info.sil.$[e].c": cNorm,
                    "sku_info.sil.$[e].link": s.link ?? "",
                    "sku_info.sil.$[e].sp": spCanon,
                    "sku_info.sil.$[e].spKey": spKey,
                    "sku_info.sil.$[e].cur": s.currency ?? "KRW",
                    [`sku_info.sil.$[e].pd.${todayKey}`]: pricePoint,
                  },
                },
                arrayFilters: [
                  {
                    // "e.sId": sId,
                    $and: [
                      {
                        $or: [
                          { "e.c": cNorm },
                          { "e.c": { $regex: cRegex, $options: "x" } },
                        ],
                      },
                      {
                        $or: [
                          { "e.spKey": spKey },
                          { "e.sp": spCanon },
                          { "e.sp": s.sku_properties },
                        ],
                      },
                    ],
                  },
                ],
              },
            });
          }

          // 5-4) 새로 발견된 sku들을 push
          if (newSkus.length > 0) {
            const toPushLocal = newSkus.map((s) => ({
              c: normalizeCForCompare(s.color) ?? "",
              link: s.link,
              sp: canonSkuProps(s.sku_properties) ?? "",
              spKey: normalizeSpForCompare(s.sku_properties) ?? "",
              cur: s.currency ?? "KRW",
              pd: {
                [todayKey]: {
                  s: Number(s.sale_price_with_tax ?? s.sale_price),
                },
              },
            }));

            if (!doc) {
              doc = {};
            }

            if (!doc?.sku_info) doc.sku_info = {};

            if (!Array.isArray(doc.sku_info.sil)) doc.sku_info.sil = [];

            doc.sku_info.sil.push(...toPushLocal);
          }

          // 6) 일괄 실행
          const { min_price, max_price, discount_rate } =
            computePriceFields(doc);
          baseDoc.min_p = min_price;
          baseDoc.max_p = max_price;
          baseDoc.dr = discount_rate;

          if (ops.length) {
            await ProductDetail.bulkWrite(ops, {
              ordered: false,
              writeConcern: { w: 1 },
            });
          }
        } catch (err) {
          const pid =
            (err &&
              typeof err === "object" &&
              "productId" in err &&
              err.productId) ||
            item._id;
          failedIds.push(pid);
          console.warn("getSkuDetail 실패", {
            productId: pid,
            code: err?.code,
            sub_code: err?.sub_code,
            message: err?.message,
          });
        }
      }),
    ),
  );

  console.log("실패한 상품 IDs:", failedIds);

  process.exit(0);
})();
