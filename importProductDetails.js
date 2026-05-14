import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import ProductDetail from "./models/ProductDetail.js";

dotenv.config();

const NEW_MONGODB_URI = process.env.MONGODB_URL;

const JSON_PATH = path.join(process.cwd(), "exports", "productDetails.json");

const BATCH_SIZE = 300;

let successCount = 0;
let failCount = 0;
let processedCount = 0;

async function insertBatch(batch) {
  if (!batch.length) return;

  try {
    const result = await ProductDetail.collection.insertMany(batch, {
      ordered: false,
    });

    const inserted = result.insertedCount || 0;
    successCount += inserted;

    console.log(`${inserted}개 insert 성공`);
  } catch (error) {
    const inserted = error.result?.result?.nInserted || 0;
    const failed = error.writeErrors?.length || 0;

    successCount += inserted;
    failCount += failed;

    console.warn(`Batch 일부 실패`);
    console.warn(`성공: ${inserted}개 / 실패: ${failed}개`);

    if (error.writeErrors?.length) {
      const firstError = error.writeErrors[0];

      console.warn("첫 번째 실패 이유:");
      console.warn(firstError.errmsg || firstError.message);
      console.warn("실패한 문서 _id:");
      console.warn(firstError.err?.op?._id || firstError.err?.op?.id);
    } else {
      console.error(error.message);
    }
  }
}

async function importProductDetails() {
  if (!NEW_MONGODB_URI) {
    throw new Error("NEW_MONGODB_URI가 .env에 없습니다.");
  }

  if (!fs.existsSync(JSON_PATH)) {
    throw new Error(`JSON 파일을 찾을 수 없습니다: ${JSON_PATH}`);
  }

  await mongoose.connect(NEW_MONGODB_URI);
  console.log("새 MongoDB 연결 성공");

  // 완전히 새로 넣고 싶으면 이 줄 사용
  await ProductDetail.collection.deleteMany({});
  console.log("기존 productdetails 컬렉션 삭제 완료");

  const stream = fs.createReadStream(JSON_PATH, {
    encoding: "utf-8",
    highWaterMark: 1024 * 1024,
  });

  let batch = [];

  let buffer = "";
  let depth = 0;
  let inString = false;
  let escape = false;
  let collecting = false;

  try {
    for await (const chunk of stream) {
      for (const char of chunk) {
        if (!collecting) {
          if (char === "{") {
            collecting = true;
            depth = 1;
            buffer = "{";
          }

          continue;
        }

        buffer += char;

        if (escape) {
          escape = false;
          continue;
        }

        if (char === "\\") {
          escape = true;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === "{") depth++;
          if (char === "}") depth--;

          if (depth === 0) {
            const doc = JSON.parse(buffer);

            batch.push(doc);
            processedCount++;

            buffer = "";
            collecting = false;

            if (batch.length >= BATCH_SIZE) {
              await insertBatch(batch);
              console.log(
                `읽은 개수: ${processedCount} / 성공: ${successCount} / 실패: ${failCount}`,
              );
              batch = [];
            }
          }
        }
      }
    }

    if (batch.length > 0) {
      await insertBatch(batch);
    }

    const dbCount = await ProductDetail.collection.countDocuments();

    console.log("=================================");
    console.log(`파일에서 읽은 개수: ${processedCount}`);
    console.log(`insert 성공 개수: ${successCount}`);
    console.log(`insert 실패 개수: ${failCount}`);
    console.log(`DB 실제 개수: ${dbCount}`);
    console.log("=================================");
  } catch (error) {
    console.error("Import 중 오류:", error);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB 연결 종료");
  }
}

importProductDetails();
