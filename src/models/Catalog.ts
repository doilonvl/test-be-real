import mongoose, { Schema, Document } from "mongoose";

export type CatalogProvider = "external" | "cloudinary" | "local";

export interface ICatalogPdf {
  url: string;
  provider: CatalogProvider;    // 'external' | 'cloudinary' | 'local'
  publicId?: string;            // Cloudinary public_id (nếu có)
  bytes?: number;               // dung lượng file
  contentType?: string;         // 'application/pdf'
}

export interface ICatalog extends Document {
  title: string;
  slug: string;
  year?: number;
  description?: string;
  pdf: ICatalogPdf;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CatalogPdfSchema = new Schema<ICatalogPdf>({
  url:        { type: String, required: true, trim: true },
  provider:   { type: String, enum: ["external","cloudinary","local"], required: true },
  publicId:   { type: String, trim: true },
  bytes:      { type: Number },
  contentType:{ type: String, trim: true }
}, { _id: false });

const CatalogSchema = new Schema<ICatalog>({
  title: {
    type: String, required: true, trim: true,
    maxlength: [200, "Title cannot exceed 200 characters"]
  },
  slug: {
    type: String, required: true, trim: true, lowercase: true, unique: true,
    maxlength: [160, "Slug cannot exceed 160 characters"]
  },
  year: { type: Number, min: 1900, max: 2100 },
  description: { type: String, trim: true, maxlength: 500 },
  pdf: { type: CatalogPdfSchema, required: true },
  isPublished: { type: Boolean, default: true },
}, { timestamps: true });

const slugify = (text: string) =>
  text.normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
      .toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)+/g,"");

CatalogSchema.pre("validate", function(next) {
  if (!this.slug && this.title) {
    (this as any).slug = slugify(this.title);
  }
  next();
});

CatalogSchema.index({ isPublished: 1, year: -1, createdAt: -1 });
CatalogSchema.index({ title: "text", description: "text" });

export default mongoose.models.Catalog ||
  mongoose.model<ICatalog>("Catalog", CatalogSchema);
