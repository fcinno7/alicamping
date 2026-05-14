import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import ProductDetail from "./models/ProductDetail.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URL;

async function exportProductDetailsStream() {
  let count = 0;

  try {
    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI가 .env에 없습니다.");
    }

    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB 연결 성공");

    const outputDir = path.join(process.cwd(), "exports");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const outputPath = path.join(outputDir, "productDetails.json");
    const writeStream = fs.createWriteStream(outputPath, { encoding: "utf-8" });

    writeStream.write("[\n");

    const cursor = ProductDetail.find({}).lean().cursor();

    for await (const doc of cursor) {
      if (count > 0) {
        writeStream.write(",\n");
      }

      writeStream.write(JSON.stringify(doc, null, 2));
      count++;

      if (count % 1000 === 0) {
        console.log(`${count}개 저장 중...`);
      }
    }

    writeStream.write("\n]");
    writeStream.end();

    console.log(`총 ${count}개 저장 완료`);
    console.log(`파일 위치: ${outputPath}`);
  } catch (error) {
    console.error("Export 실패:", error);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB 연결 종료");
  }
}

exportProductDetailsStream();
