import mongoose, { Schema, Document, Types } from "mongoose";

// Các loại node trong cây sản phẩm
export type NodeType = "category" | "group" | "item";
export type Locale = "vi" | "en";

export type LocalizedString = Partial<Record<Locale, string>>;

export interface IImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface IProductNode extends Document {
  title: string;
  slug: string;

  title_i18n?: LocalizedString;
  tagline_i18n?: LocalizedString;
  description_i18n?: LocalizedString;
  slug_i18n?: LocalizedString;

  type: NodeType; // "category" | "group" | "item"
  parent?: Types.ObjectId | null;
  ancestors: {
    _id: Types.ObjectId;
    slug: string;
    title: string;
  }[];
  path: string;
  tagline?: string;
  description?: string;
  thumbnail?: string;
  images?: IImage[];
  specs?: {
    material?: string;
    dimensions_cm?: string;
    usable_depth_cm?: string;
    weight_kg?: string;
  };
  order: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ImageSchema = new Schema<IImage>(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, trim: true },
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false }
);

const LocalizedStringSchema = new Schema(
  { vi: { type: String, trim: true }, en: { type: String, trim: true } },
  { _id: false }
);

const ProductNodeSchema = new Schema<IProductNode>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      trim: true,
      lowercase: true,
      maxlength: [160, "Slug cannot exceed 160 characters"],
    },

    title_i18n: { type: LocalizedStringSchema, default: undefined },
    tagline_i18n: { type: LocalizedStringSchema, default: undefined },
    description_i18n: { type: LocalizedStringSchema, default: undefined },
    slug_i18n: { type: LocalizedStringSchema, default: undefined },

    type: {
      type: String,
      enum: ["category", "group", "item"],
      required: [true, "Type is required"],
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: "ProductNode",
      default: null,
      // index: true,
    },
    ancestors: {
      type: [
        {
          _id: {
            type: Schema.Types.ObjectId,
            ref: "ProductNode",
            required: true,
          },
          slug: { type: String, required: true },
          title: { type: String, required: true },
        },
      ],
      default: [],
      _id: false,
    },
    path: {
      type: String,
      required: [true, "Path is required"],
      trim: true,
      lowercase: true,
      // unique: true,
    },
    tagline: { type: String, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 8000 },
    thumbnail: { type: String, trim: true },
    images: [ImageSchema],
    specs: {
      material: { type: String, trim: true },
      dimensions_cm: { type: String, trim: true },
      usable_depth_cm: { type: String, trim: true },
      weight_kg: { type: String, trim: true },
    },
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Auto-generate slug/path/ancestors
const slugify = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

ProductNodeSchema.pre("validate", async function (next) {
  try {
    if (this.title && (!this.title_i18n || !this.title_i18n.vi)) {
      this.title_i18n = {
        ...(this.title_i18n || {}),
        vi: this.title,
      };
    }

    if (!this.slug && this.title) this.slug = slugify(this.title);

    if (!this.parent) {
      this.ancestors = [];
      this.path = this.slug;
    } else {
      const Parent = mongoose.model<IProductNode>("ProductNode");
      const parentDoc = await Parent.findById(this.parent).lean();
      if (!parentDoc) throw new Error("Parent not found");

      this.ancestors = [
        ...parentDoc.ancestors,
        {
          _id: parentDoc._id as Types.ObjectId,
          slug: parentDoc.slug,
          title: parentDoc.title,
        },
      ];

      this.path = `${parentDoc.path}/${this.slug}`;
    }
    next();
  } catch (err) {
    next(err as Error);
  }
});

ProductNodeSchema.index({
  title: "text",
  description: "text",
  tagline: "text",
  "title_i18n.vi": "text",
  "title_i18n.en": "text",
  "description_i18n.vi": "text",
  "description_i18n.en": "text",
  "tagline_i18n.vi": "text",
  "tagline_i18n.en": "text",
});
ProductNodeSchema.index({ parent: 1, order: 1 });
ProductNodeSchema.index({ path: 1 }, { unique: true });

export default mongoose.models.ProductNode ||
  mongoose.model<IProductNode>("ProductNode", ProductNodeSchema);
