import { Request, Response } from "express";
import { catalogRepo } from "../repositories/catalog.repo";
import {
  uploadPdfBufferToCloudinary,
  destroyCloudinaryRaw,
} from "../lib/cloudinaryRaw";

const toNum = (v: any) => (v === undefined || v === "" ? undefined : Number(v));

export const catalogController = {
  async listPublic(req: Request, res: Response) {
    const { page, limit, q, year, sort } = req.query as any;
    const result = await catalogRepo.list({
      page: toNum(page) || 1,
      limit: toNum(limit) || 50,
      q: q ? String(q) : undefined,
      year: toNum(year),
      includeUnpublished: false,
      sort: (sort as any) || undefined,
    });
    res.json(result);
  },

  async getBySlug(req: Request, res: Response) {
    const doc = await catalogRepo.getBySlug(req.params.slug);
    if (!doc || !doc.isPublished)
      return res.status(404).json({ message: "Not found" });
    res.json(doc);
  },

  async openBySlug(req: Request, res: Response) {
    const doc = await catalogRepo.getBySlug(req.params.slug);
    if (!doc || !doc.isPublished)
      return res.status(404).json({ message: "Not found" });
    return res.redirect(302, doc.pdf.url);
  },

  async listAdmin(req: Request, res: Response) {
    const { page, limit, q, year, sort } = req.query as any;
    const result = await catalogRepo.list({
      page: toNum(page) || 1,
      limit: toNum(limit) || 50,
      q: q ? String(q) : undefined,
      year: toNum(year),
      includeUnpublished: true,
      sort: (sort as any) || "-createdAt",
    });
    res.json(result);
  },

  async create(req: Request, res: Response) {
    try {
      const b = req.body || {};
      if (!b.title || !b.pdf) {
        return res.status(400).json({ message: "title and pdf are required" });
      }
      const created = await catalogRepo.create({
        title: String(b.title),
        year: b.year !== undefined ? Number(b.year) : undefined,
        description: b.description ? String(b.description) : undefined,
        pdf: {
          url: String(b.pdf.url),
          provider: b.pdf.provider || "external",
          publicId: b.pdf.publicId,
          bytes: b.pdf.bytes ? Number(b.pdf.bytes) : undefined,
          contentType: b.pdf.contentType,
        },
        isPublished: b.isPublished !== undefined ? !!b.isPublished : true,
      });
      res.status(201).json(created);
    } catch (e: any) {
      res.status(400).json({ message: e?.message || "Create failed" });
    }
  },

  async uploadFile(req: Request, res: Response) {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ message: "Missing file" });
      if (file.mimetype !== "application/pdf") {
        return res.status(400).json({ message: "Only PDF is allowed" });
      }
      const up = await uploadPdfBufferToCloudinary(
        file.buffer,
        file.originalname
      );
      return res.status(201).json({
        url: up.url,
        provider: "cloudinary",
        publicId: up.public_id,
        bytes: up.bytes,
        access_mode: "public",
        contentType: "application/pdf",
      });
    } catch (e: any) {
      res.status(400).json({ message: e?.message || "Upload failed" });
    }
  },

  async replaceFile(req: Request, res: Response) {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ message: "Missing file" });
      if (file.mimetype !== "application/pdf") {
        return res.status(400).json({ message: "Only PDF is allowed" });
      }

      const doc = await catalogRepo.getById(req.params.id);
      if (!doc) return res.status(404).json({ message: "Not found" });

      const up = await uploadPdfBufferToCloudinary(
        file.buffer,
        file.originalname
      );

      if (doc.pdf?.provider === "cloudinary" && doc.pdf.publicId) {
        try {
          await destroyCloudinaryRaw(doc.pdf.publicId);
        } catch {}
      }

      doc.pdf = {
        url: up.url,
        provider: "cloudinary",
        publicId: up.public_id,
        bytes: up.bytes,
        contentType: "application/pdf",
      };
      await doc.save();

      res.json(doc);
    } catch (e: any) {
      res.status(400).json({ message: e?.message || "Replace failed" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const b = req.body || {};
      const patch: any = {};
      if ("title" in b) patch.title = String(b.title);
      if ("description" in b)
        patch.description = b.description ? String(b.description) : undefined;
      if ("year" in b)
        patch.year = b.year !== undefined ? Number(b.year) : undefined;
      if ("isPublished" in b) patch.isPublished = !!b.isPublished;

      if ("pdf" in b && b.pdf && typeof b.pdf === "object") {
        patch.pdf = {
          url: String(b.pdf.url),
          provider: b.pdf.provider || "external",
          publicId: b.pdf.publicId,
          bytes: b.pdf.bytes ? Number(b.pdf.bytes) : undefined,
          contentType: b.pdf.contentType,
        };
      }

      const updated = await catalogRepo.update(req.params.id, patch);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e?.message || "Update failed" });
    }
  },

  async remove(req: Request, res: Response) {
    const doc = await catalogRepo.getById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    if (doc.pdf?.provider === "cloudinary" && doc.pdf.publicId) {
      try {
        await destroyCloudinaryRaw(doc.pdf.publicId);
      } catch {}
    }
    await catalogRepo.delete(req.params.id);
    res.json({ message: "Deleted" });
  },
};
