import dbConnect from "./utils/dbConnect.js";
import PromotionCoupon from "./models/PromotionCoupon.js";

(async () => {
  await dbConnect();

  // (KST 기준)
  // 판매 시간: 2/1 00:00 ~ 2/7 23:59 (포함)
  // endAt은 배타적으로 2/8 00:00으로 저장
  //   const doc = {
  //     period: {
  //       startAt: new Date("2026-02-01T00:00:00+09:00"),
  //       endAt: new Date("2026-02-08T00:00:00+09:00"),
  //     },
  //     promotionName: "사랑가득 선물대전 (달러)",

  //     // ✅ 스키마에 coupon만 있으니 코드 문자열은 메타로 남기기 어려움
  //     // 일단 할인 조건만 저장 (minPrice, sale, currency)
  //     coupon: [
  //       { minPrice: 19, sale: 2, couponCode: "LOVEKR02 ", currency: "USD" },
  //       { minPrice: 34, sale: 4, couponCode: "LOVEKR04 ", currency: "USD" },
  //       { minPrice: 53, sale: 6, couponCode: "LOVEKR06 ", currency: "USD" },
  //       { minPrice: 86, sale: 9, couponCode: "LOVEKR09 ", currency: "USD" },
  //       { minPrice: 139, sale: 15, couponCode: "LOVEKR15 ", currency: "USD" },
  //       { minPrice: 239, sale: 26, couponCode: "LOVEKR26 ", currency: "USD" },
  //       { minPrice: 332, sale: 34, couponCode: "LOVEKR34 ", currency: "USD" },
  //       { minPrice: 529, sale: 54, couponCode: "LOVEKR54", currency: "USD" },
  //     ],
  //   };

  // 판매 시간: 2/1 00:00 ~ 2/7 23:59 (포함)
  // endAt은 배타적으로 2/8 00:00으로 저장

  const doc = {
    period: {
      startAt: new Date("2026-05-01T00:00:00+09:00"),
      endAt: new Date("2026-05-07T00:00:00+09:00"),
    },
    promotionName: "행복위크",

    // ✅ 스키마에 coupon만 있으니 코드 문자열은 메타로 남기기 어려움
    // 일단 할인 조건만 저장 (minPrice, sale, currency)
    coupon: [
      { minPrice: 30000, sale: 4100, couponCode: "AEKZ03", currency: "KRW" },
      { minPrice: 50000, sale: 6000, couponCode: "AEKZ04", currency: "KRW" },
      { minPrice: 80000, sale: 10000, couponCode: "AEKZ07", currency: "KRW" },
      { minPrice: 125000, sale: 15000, couponCode: "AEKZ10", currency: "KRW" },
      // { minPrice: 200000, sale: 25000, couponCode: "AEKZ17", currency: "KRW" },
      // { minPrice: 300000, sale: 39000, couponCode: "AEKZ27", currency: "KRW" },
      // { minPrice: 500000, sale: 55000, couponCode: "AEKZ38", currency: "KRW" },
      // { minPrice: 800000, sale: 100000, couponCode: "AEKZ70", currency: "KRW" },
      // {
      //   minPrice: 1000000,
      //   sale: 125000,
      //   couponCode: "AEKZ85",
      //   currency: "KRW",
      // },
    ],
  };

  // ✅ 있으면 업데이트 / 없으면 생성
  const saved = await PromotionCoupon.findOneAndUpdate(
    { promotionName: doc.promotionName },
    { $set: doc },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  console.log("✅ 저장 완료:", saved);

  await PromotionCoupon.db.close();
  process.exit(0);
})().catch((err) => {
  console.error("❌ 에러:", err);
  process.exit(1);
});
