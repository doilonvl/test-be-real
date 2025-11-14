import "dotenv/config";
import mongoose from "mongoose";
import ProductNode from "../models/ProductNode";

const looksVietnamese = (s: string) =>
  /[ăâêôơưđàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõờớợởỡồốộổỗùúụủũừứựửữỳýỵỷỹ]/i.test(
    s
  );

const isEnglishLike = (s: string) => /[a-z]/i.test(s) && !looksVietnamese(s);

const DRY = process.argv.includes("--dry");

async function run() {
  await mongoose.connect(process.env.URI_MONGODB!);
  const cursor = ProductNode.find({}).cursor();

  let scanned = 0,
    updated = 0;

  for await (const d of cursor) {
    scanned++;
    const set: any = {};
    const unset: any = {};

    (["title", "tagline", "description"] as const).forEach((k) => {
      const vi = d[`${k}_i18n`]?.vi as string | undefined;
      if (vi && isEnglishLike(vi)) {
        set[`${k}_i18n.en`] = vi;
        unset[`${k}_i18n.vi`] = ""; // xoá vi sai ngôn ngữ
      }
    });

    // 2) Bổ sung slug_i18n.en nếu muốn song ngữ đủ cặp
    if (d.slug_i18n?.vi && !d.slug_i18n?.en) {
      set["slug_i18n.en"] = d.slug_i18n.vi;
    }

    // 3) Sửa “Aqua Gym equipments”
    if (d.title_i18n?.en === "Aqua Gym equipments") {
      set["title_i18n.en"] = "Aqua Gym Equipment";
    }

    if (Object.keys(set).length || Object.keys(unset).length) {
      updated++;
      if (!DRY) {
        await ProductNode.updateOne(
          { _id: d._id },
          {
            ...(Object.keys(set).length ? { $set: set } : {}),
            ...(Object.keys(unset).length ? { $unset: unset } : {}),
          }
        );
      }
    }
  }

  console.log(`Scanned: ${scanned} | Updated: ${updated} | Dry-run: ${DRY}`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
