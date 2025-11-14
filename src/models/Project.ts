import mongoose, { Schema, Document } from "mongoose";

export interface IProjectImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface IProject extends Document {
  project: string;
  scope: string;
  client: string;
  year: number;
  slug?: string;
  images?: IProjectImage[];
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectImageSchema = new Schema<IProjectImage>(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, trim: true },
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false }
);

const ProjectSchema = new Schema<IProject>(
  {
    project: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
      maxlength: [200, "Project cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      required: false,
      trim: true,
      set: (v: unknown) => {
        const s = String(v ?? "").trim();
        return s.length ? s : undefined;
      },
    },
    scope: {
      type: String,
      required: [true, "Scope of work is required"],
      trim: true,
      maxlength: [400, "Scope cannot exceed 400 characters"],
    },
    client: {
      type: String,
      required: [true, "Client is required"],
      trim: true,
      maxlength: [200, "Client cannot exceed 200 characters"],
    },
    year: {
      type: Number,
      required: [true, "Year is required"],
      min: [1900, "Year must be >= 1900"],
      max: [2100, "Year must be <= 2100"],
    },
    images: { type: [ProjectImageSchema], default: [] },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ProjectSchema.index({ isPublished: 1, year: -1, createdAt: -1 });
ProjectSchema.index({ project: "text", scope: "text", client: "text" });
// Unique slug when present (case-insensitive)
ProjectSchema.index(
  { slug: 1 },
  { unique: true, sparse: true, collation: { locale: "en", strength: 2 } }
);
ProjectSchema.index(
  { project: 1, client: 1, year: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

export default mongoose.models.Project ||
  mongoose.model<IProject>("Project", ProjectSchema);
