import { Request, Response } from "express";
import { projectRepo } from "../repositories/project.repo";

const toNum = (v: any) => (v === undefined || v === "" ? undefined : Number(v));

export const projectController = {
  async listPublic(req: Request, res: Response) {
    const { page, limit, q, client, year } = req.query as any;
    const result = await projectRepo.list({
      page: toNum(page) || 1,
      limit: toNum(limit) || 20,
      q: q ? String(q) : undefined,
      client: client ? String(client) : undefined,
      year: toNum(year),
      includeUnpublished: false,
    });
    res.json(result);
  },

  async getOneBySlugPublic(req: Request, res: Response) {
    const slug = String(req.params.slug || "").trim();
    if (!slug) return res.status(400).json({ message: "Missing slug" });
    const doc = await projectRepo.getPublicBySlug(slug);
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  },

  async getOne(req: Request, res: Response) {
    const doc = await projectRepo.getByIdOrSlug(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  },

  async listAdmin(req: Request, res: Response) {
    const { page, limit, sort, q, client, year } = req.query as any;
    const result = await projectRepo.list({
      page: toNum(page) || 1,
      limit: toNum(limit) || 20,
      sort: (sort as any) || "-createdAt",
      q: q ? String(q) : undefined,
      client: client ? String(client) : undefined,
      year: toNum(year),
      includeUnpublished: true,
    });
    res.json(result);
  },

  async create(req: Request, res: Response) {
    try {
      const { project, scope, client, year, images, isPublished, slug } =
        req.body || {};
      if (!project || !scope || !client || year === undefined) {
        return res
          .status(400)
          .json({ message: "project, scope, client, year are required" });
      }
      const created = await projectRepo.create({
        project: String(project),
        scope: String(scope),
        client: String(client),
        year: Number(year),
        images: Array.isArray(images) ? images : [],
        isPublished: isPublished !== undefined ? !!isPublished : true,
        slug: slug ? String(slug) : undefined,
      });
      res.status(201).json(created);
    } catch (err: any) {
      console.error("[PROJECT CREATE]", err);
      res.status(400).json({ message: err?.message || "Create failed" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      let b: any = req.body;
      if (typeof b === "string") {
        try {
          b = JSON.parse(b);
        } catch {}
      }
      if (!b || typeof b !== "object") {
        return res.status(400).json({ message: "Missing JSON body" });
      }

      // Load current to compare title (project) and to fallback slug generation
      const current = await projectRepo.getById(String(req.params.id));
      if (!current) return res.status(404).json({ message: "Not found" });

      const patch: any = {};
      if ("project" in b) patch.project = String(b.project);
      if ("scope" in b) patch.scope = String(b.scope);
      if ("client" in b) patch.client = String(b.client);
      if ("year" in b) patch.year = Number(b.year);
      if ("images" in b) patch.images = Array.isArray(b.images) ? b.images : [];
      if ("isPublished" in b) patch.isPublished = !!b.isPublished;

      // Slug rules similar to productNode:
      // 1) If client sends slug -> normalize and ensure unique
      if ("slug" in b && b.slug) {
        const base = projectRepo.slugify(String(b.slug));
        patch.slug = await projectRepo.ensureUniqueSlug(base, String(req.params.id));
      }
      // 2) If slug not provided but project changed -> regenerate slug from new project
      else if ("project" in b) {
        const base = projectRepo.slugify(String(b.project));
        patch.slug = await projectRepo.ensureUniqueSlug(base, String(req.params.id));
      }
      // 3) If slug provided as empty string -> regenerate from current/new project
      else if ("slug" in b && !b.slug) {
        const base = projectRepo.slugify(String(("project" in b ? b.project : current.project) || "project"));
        patch.slug = await projectRepo.ensureUniqueSlug(base, String(req.params.id));
      }

      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const updated = await projectRepo.update(req.params.id, patch);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Update failed" });
    }
  },

  async remove(req: Request, res: Response) {
    const deleted = await projectRepo.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  },

  async checkSlug(req: Request, res: Response) {
    const slug = String(req.query.slug || "").trim();
    if (!slug) return res.status(400).json({ message: "Missing slug" });
    const excludeId = req.query.excludeId
      ? String(req.query.excludeId)
      : undefined;
    const result = await projectRepo.checkSlugAvailability(slug, excludeId);
    res.json(result);
  },

  async slugifyPreview(req: Request, res: Response) {
    const input = (req.query.input ? String(req.query.input) : "").trim();
    const project = req.query.project ? String(req.query.project) : undefined;
    const client = req.query.client ? String(req.query.client) : undefined;
    const year =
      req.query.year !== undefined ? Number(req.query.year) : undefined;
    const excludeId = req.query.excludeId
      ? String(req.query.excludeId)
      : undefined;

    const base = input || projectRepo.baseSlug(project);
    const raw = projectRepo.slugify(base);
    const unique = await projectRepo.ensureUniqueSlug(base, excludeId);

    res.json({
      base,
      slug: raw,
      unique,
      available: raw === unique,
      excludeId: excludeId || null,
    });
  },

  async regenerateSlug(req: Request, res: Response) {
    const updated = await projectRepo.regenerateSlugFor(req.params.id);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  },

  async backfillSlugs(req: Request, res: Response) {
    const dryRun =
      typeof req.query.dryRun === "string"
        ? req.query.dryRun.toLowerCase() !== "false"
        : true;
    const result = await projectRepo.backfillSlugs(dryRun);
    res.json(result);
  },
};
