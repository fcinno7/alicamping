import ProductDetail from "./models/ProductDetail.js";
import dbConnect from "./utils/dbConnect.js";

async function getFishingC3C4Categories() {
  await dbConnect();

  const rows = await ProductDetail.aggregate([
    {
      $match: {
        c2n: "캠핑 & 하이킹",
      },
    },
    {
      $group: {
        _id: {
          c3n: { $ifNull: ["$c3n", null] },
          c4n: { $ifNull: ["$c4n", null] },
        },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        c3n: "$_id.c3n",
        c4n: "$_id.c4n",
        count: 1,
      },
    },
    {
      $sort: {
        c3n: 1,
        c4n: 1,
      },
    },
  ]);

  console.table(rows);
  console.log("총 조합 개수:", rows.length);

  return rows;
}

getFishingC3C4Categories()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("에러:", err);
    process.exit(1);
  });
