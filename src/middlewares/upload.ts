import path from "node:path";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary";

function sanitizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}
function sanitizeFolder(input?: string) {
  const s = (input || "").toString();
  return (
    s
      .replace(/^\/+|\/+$/g, "")
      .replace(/\.\./g, "")
      .replace(/[^a-z0-9/_-]/gi, "-") || "uploads"
  );
}

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const original = file.originalname;
    const ext = path.extname(original).slice(1).toLowerCase();
    const base = path.basename(original, path.extname(original));
    const isPdf = file.mimetype === "application/pdf" || ext === "pdf";
    const isVideoMp4 = file.mimetype === "video/mp4" || ext === "mp4";

    const folderArg = (req.body?.folder || req.query?.folder) as
      | string
      | undefined;
    const folder = `hasake/${sanitizeFolder(folderArg)}`;

    return {
      folder,
      // ĐẶT public_id RÕ RÀNG để Cloudinary không tự sinh hậu tố lạ
      public_id: sanitizeName(base),
      resource_type: isPdf ? "raw" : isVideoMp4 ? "video" : "image",
      type: "upload",
      access_mode: "public",

      // Vì đã đặt public_id -> tắt 2 cái này (nếu bật cũng bị bỏ qua):
      use_filename: false,
      unique_filename: false,

      overwrite: false,

      // QUAN TRỌNG: ép format=pdf cho file raw để Format hiển thị "pdf"
      // và header Content-Type đúng -> xem inline được
      format: isPdf ? "pdf" : undefined,

      allowed_formats: isPdf
        ? ["pdf"]
        : isVideoMp4
        ? ["mp4"]
        : ["jpg", "jpeg", "png", "webp", "gif"],
    };
  },
});

const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_RAW = ["application/pdf"];
const ALLOWED_VIDEO = ["video/mp4"];

export const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB per file
    files: 50,
  },
  fileFilter(_req, file, cb) {
    const { mimetype } = file;
    if (
      ALLOWED_IMAGE.includes(mimetype) ||
      ALLOWED_RAW.includes(mimetype) ||
      ALLOWED_VIDEO.includes(mimetype)
    ) {
      return cb(null, true);
    }
    return cb(
      new Error("Unsupported file type. Only images, mp4, and pdf are allowed")
    );
  },
});
export const uploadSingle = upload.single("file");
export const uploadMultiple = upload.array("files", 50);
