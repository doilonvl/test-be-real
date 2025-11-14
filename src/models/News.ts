import mongoose, { Schema, Document } from "mongoose";

export type Locale = "vi" | "en";
export type LocalizedString = Partial<Record<Locale, string>>;
const LocalizedStringSchema = new Schema(
  { vi: { type: String, trim: true }, en: { type: String, trim: true } },
  { _id: false }
);

export interface INewsImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface INews extends Document {
  title: string;
  title_i18n?: LocalizedString;
  slug: string;
  excerpt?: string;
  excerpt_i18n?: LocalizedString;
  content: string;
  content_i18n?: LocalizedString;
  cover?: string; // ảnh thumbnail/cover
  images?: INewsImage[]; // album ảnh trong bài (tùy chọn)
  author?: string;
  isPublished: boolean;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NewsImageSchema = new Schema<INewsImage>(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, trim: true },
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false }
);

const NewsSchema = new Schema<INews>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    title_i18n: { type: LocalizedStringSchema, default: undefined },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: [160, "Slug cannot exceed 160 characters"],
    },
    excerpt: { type: String, trim: true, maxlength: 500 },
    excerpt_i18n: { type: LocalizedStringSchema, default: undefined },
    content: { type: String, required: true, trim: true, maxlength: 20000 },
    content_i18n: { type: LocalizedStringSchema, default: undefined },
    cover: { type: String, trim: true },
    images: { type: [NewsImageSchema], default: [] },
    author: { type: String, trim: true, maxlength: 100 },
    isPublished: { type: Boolean, default: true },
    publishedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

const slugify = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
async function ensureUniqueSlug(doc: any) {
  const base = slugify(doc.slug || doc.title || "");
  let candidate = base || "post";
  let i = 2;

  const NewsModel = doc.constructor;
  while (await NewsModel.exists({ slug: candidate, _id: { $ne: doc._id } })) {
    candidate = `${base}-${i++}`;
  }
  doc.slug = candidate;
}
NewsSchema.pre("validate", function (next) {
  if (!this.slug && this.title) (this as any).slug = slugify(this.title);
  if (!this.publishedAt) (this as any).publishedAt = new Date();
  next();
});
NewsSchema.pre("save", async function (next) {
  try {
    const doc: any = this;
    if (doc.isModified("title") && !doc.isModified("slug")) {
      await ensureUniqueSlug(doc);
    }
    next();
  } catch (e) {
    next(e as any);
  }
});

NewsSchema.index({ isPublished: 1, publishedAt: -1, createdAt: -1 });
NewsSchema.index({
  title: "text",
  excerpt: "text",
  content: "text",
  "title_i18n.vi": "text",
  "title_i18n.en": "text",
  "excerpt_i18n.vi": "text",
  "excerpt_i18n.en": "text",
  "content_i18n.vi": "text",
  "content_i18n.en": "text",
});

export default mongoose.models.News ||
  mongoose.model<INews>("News", NewsSchema);
