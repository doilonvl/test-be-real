import { Request, Response } from "express";
import { uploadSingle, uploadMultiple } from "../middlewares/upload";

function buildInline(url: string) {
  // chèn fl_inline sau "upload" để xem online
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "upload");
    if (idx >= 0 && parts[idx + 1] !== "fl_inline") {
      parts.splice(idx + 1, 0, "fl_inline");
      u.pathname = "/" + parts.join("/");
    }
    return u.toString();
  } catch {
    return url;
  }
}

function buildAttachment(url: string, filename: string) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "upload");
    if (idx >= 0) {
      parts.splice(idx + 1, 0, `fl_attachment:${encodeURIComponent(filename)}`);
      u.pathname = "/" + parts.join("/");
    }
    return u.toString();
  } catch {
    return url;
  }
}

export const uploadController = {
  single: [
    uploadSingle,
    (req: Request, res: Response) => {
      const f: any = req.file;
      if (!f) return res.status(400).json({ message: "No file uploaded" });

      // Multer-Cloudinary trả về:
      // f.path (secure_url), f.public_id, f.bytes, f.resource_type, f.format, f.mimetype
      const secureUrl: string = f.path;
      const publicId: string = f.public_id || f.filename; // ưu tiên public_id
      const format: string = f.format; // expect 'pdf' cho raw
      const bytes: number = f.bytes ?? f.size;
      const contentType: string =
        f.mimetype ||
        (format === "pdf" ? "application/pdf" : "application/octet-stream");

      const view_url = buildInline(secureUrl);
      const download_url = buildAttachment(
        secureUrl,
        (publicId.split("/").pop() || "file") + ".pdf"
      );

      res.json({
        url: secureUrl,
        publicId,
        bytes,
        resource_type: f.resource_type,
        format,
        contentType,
        view_url,
        download_url,
      });
    },
  ],

  multi: [
    uploadMultiple,
    (req: Request, res: Response) => {
      const files: any[] = (req.files as any[]) || [];
      const items = files.map((f) => {
        const secureUrl: string = f.path;
        const publicId: string = f.public_id || f.filename;
        const format: string = f.format;
        const bytes: number = f.bytes ?? f.size;
        const contentType: string =
          f.mimetype ||
          (format === "pdf" ? "application/pdf" : "application/octet-stream");

        return {
          url: secureUrl,
          publicId,
          bytes,
          resource_type: f.resource_type,
          format,
          contentType,
          view_url: buildInline(secureUrl),
          download_url: buildAttachment(
            secureUrl,
            (publicId.split("/").pop() || "file") + ".pdf"
          ),
        };
      });

      res.json({ items });
    },
  ],
};
