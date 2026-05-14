// import-fishing-product.js
import mongoose from "mongoose";
import fs from "fs";
import ProductDetail from "./models/ProductDetail.js";
import dbConnect from "./utils/dbConnect.js";

const FILE_PATH = "./fishing-products.json";
const BATCH_SIZE = 500;

async function flushBatch(batch, stats) {
  if (batch.length === 0) return;

  try {
    const insertedDocs = await ProductDetail.insertMany(batch, {
      ordered: false,
    });

    stats.inserted += insertedDocs.length;
    console.log(
      `[OK] batch inserted: ${insertedDocs.length}, total inserted: ${stats.inserted}`,
    );
  } catch (err) {
    if (err?.writeErrors?.length) {
      const failedCount = err.writeErrors.length;
      const successCount = batch.length - failedCount;

      stats.inserted += Math.max(successCount, 0);
      stats.failed += failedCount;

      console.log(
        `[PARTIAL] batch success: ${successCount}, failed: ${failedCount}, total inserted: ${stats.inserted}, total failed: ${stats.failed}`,
      );
    } else {
      console.error("[FATAL BATCH ERROR]", err);
      throw err;
    }
  }

  batch.length = 0;
}

// JSON 배열 파일에서 객체를 하나씩 꺼내는 async generator
async function* streamJsonArrayObjects(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });

  let started = false; // 배열 시작 '[' 만났는지
  let inString = false; // 문자열 내부인지
  let escaped = false; // 이스케이프 직전인지
  let depth = 0; // 중괄호 깊이
  let buffer = ""; // 현재 객체 버퍼

  for await (const chunk of stream) {
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];

      if (!started) {
        if (ch === "[") started = true;
        continue;
      }

      // 객체 시작 전의 공백, 쉼표, 줄바꿈 무시
      if (depth === 0) {
        if (
          ch === " " ||
          ch === "\n" ||
          ch === "\r" ||
          ch === "\t" ||
          ch === ","
        ) {
          continue;
        }

        // 배열 끝
        if (ch === "]") {
          return;
        }

        // 객체 시작
        if (ch === "{") {
          depth = 1;
          buffer = "{";
          inString = false;
          escaped = false;
          continue;
        }

        // 혹시 예상치 못한 문자면 무시
        continue;
      }

      // depth > 0 이면 현재 객체 읽는 중
      buffer += ch;

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) {
          // 객체 하나 완성
          yield JSON.parse(buffer);
          buffer = "";
        }
      }
    }
  }

  if (depth !== 0 || buffer.trim()) {
    throw new Error(
      "Invalid JSON array file: object parsing did not finish cleanly.",
    );
  }
}

async function importFishingProducts() {
  const stats = {
    read: 0,
    inserted: 0,
    failed: 0,
  };

  try {
    await dbConnect();
    console.log("target db connected");

    const batch = [];

    for await (const doc of streamJsonArrayObjects(FILE_PATH)) {
      batch.push(doc);
      stats.read += 1;

      if (batch.length >= BATCH_SIZE) {
        await flushBatch(batch, stats);
      }

      if (stats.read % 5000 === 0) {
        console.log(
          `[PROGRESS] read: ${stats.read}, inserted: ${stats.inserted}, failed: ${stats.failed}`,
        );
      }
    }

    if (batch.length > 0) {
      await flushBatch(batch, stats);
    }

    console.log("====================================");
    console.log("[DONE]");
    console.log(`read     : ${stats.read}`);
    console.log(`inserted : ${stats.inserted}`);
    console.log(`failed   : ${stats.failed}`);
    console.log("====================================");
  } catch (err) {
    console.error("import error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("mongodb disconnected");
  }
}

importFishingProducts();
