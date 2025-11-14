// scripts/backfill_products_i18n.ts
import "dotenv/config";
import mongoose from "mongoose";
import ProductNode from "../models/ProductNode.js";

const DRY = process.argv.includes("--dry");

function looksVietnamese(s?: string) {
  if (!s) return false;
  return /[ăâêôơưđàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõờớợởỡồốộổỗùúụủũừứựửữỳýỵỷỹđ]/i.test(
    s
  );
}

type Patch = { $set?: Record<string, unknown> };
function setIfMissing(patch: Patch, path: string, value?: unknown) {
  if (value == null) return;
  patch.$set ??= {};
  // nếu đã có sẵn giá trị cần set trong patch thì bỏ qua
  if (patch.$set[path] !== undefined) return;
  patch.$set[path] = value;
}

async function run() {
  await mongoose.connect(process.env.URI_MONGODB!);

  const cursor = ProductNode.find({}).lean().cursor();
  let scanned = 0;
  let updated = 0;

  for await (const doc of cursor) {
    scanned++;
    const patch: Patch = {};

    // --- TITLE ---
    if (!doc.title_i18n?.vi && !doc.title_i18n?.en && doc.title) {
      const key = looksVietnamese(doc.title) ? "vi" : "en";
      setIfMissing(patch, `title_i18n.${key}`, doc.title);
    } else {
      // bù ngôn ngữ còn thiếu nếu đoán được
      if (!doc.title_i18n?.vi && doc.title && looksVietnamese(doc.title)) {
        setIfMissing(patch, "title_i18n.vi", doc.title);
      }
      if (!doc.title_i18n?.en && doc.title && !looksVietnamese(doc.title)) {
        setIfMissing(patch, "title_i18n.en", doc.title);
      }
    }

    // --- DESCRIPTION ---
    if (
      !doc.description_i18n?.vi &&
      !doc.description_i18n?.en &&
      doc.description
    ) {
      const key = looksVietnamese(doc.description) ? "vi" : "en";
      setIfMissing(patch, `description_i18n.${key}`, doc.description);
    } else {
      if (
        !doc.description_i18n?.vi &&
        doc.description &&
        looksVietnamese(doc.description)
      ) {
        setIfMissing(patch, "description_i18n.vi", doc.description);
      }
      if (
        !doc.description_i18n?.en &&
        doc.description &&
        !looksVietnamese(doc.description)
      ) {
        setIfMissing(patch, "description_i18n.en", doc.description);
      }
    }

    // --- TAGLINE (đơn giản: điền vi nếu thiếu) ---
    if (!doc.tagline_i18n?.vi && doc.tagline) {
      setIfMissing(patch, "tagline_i18n.vi", doc.tagline);
    }

    // --- SLUG (coi slug hiện tại là vi, không đoán en để tránh sai) ---
    if (!doc.slug_i18n?.vi && doc.slug) {
      setIfMissing(patch, "slug_i18n.vi", doc.slug);
    }

    if (patch.$set && Object.keys(patch.$set).length) {
      updated++;
      if (!DRY) {
        await ProductNode.updateOne({ _id: doc._id }, patch);
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
