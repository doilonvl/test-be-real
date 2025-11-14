// news.controller.ts
import { Request, Response } from "express";
import { newsRepo } from "../repositories/news.repo";
import mongoose from "mongoose";
import News from "../models/News";

// ===== helpers =====
type Locale = "vi" | "en";
const DEFAULT_LOCALE: Locale = "vi";

const detectLocale = (h?: string): Locale =>
  /en/i.test(h || "") ? "en" : "vi";

const shouldLocalize = (req: Request) => {
  const raw = String((req.query as any)?.raw ?? "").toLowerCase();
  return !(raw === "1" || raw === "true");
};

const pickI18n = (i18n: any, locale: Locale) =>
  (i18n && (i18n[locale] || i18n[DEFAULT_LOCALE])) || undefined;

const localizeNewsDoc = (doc: any, locale: Locale) => {
  const o = doc?.toObject ? doc.toObject() : { ...doc };
  o.title = pickI18n(o.title_i18n, locale) ?? o.title ?? "";
  o.excerpt = pickI18n(o.excerpt_i18n, locale) ?? o.excerpt ?? "";
  o.content = pickI18n(o.content_i18n, locale) ?? o.content ?? "";
  return o;
};

// Tự nâng field thường -> i18n.vi (để admin gửi đơn giản vẫn ok)
const liftPlainToI18n = (b: any) => {
  if (!b?.title_i18n && b?.title) b.title_i18n = { vi: b.title };
  if (!b?.excerpt_i18n && b?.excerpt) b.excerpt_i18n = { vi: b.excerpt };
  if (!b?.content_i18n && b?.content) b.content_i18n = { vi: b.content };
};

// ===== slug utils (giữ nguyên logic hiện tại) =====
const slugify = (text: string) =>
  String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const escRe = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

async function makeUniqueNewsSlug(base: string, excludeId?: string) {
  const root = base || "post";
  const regex = new RegExp(`^${escRe(root)}(?:-(\\d+))?$`, "i");
  const matchFilter: any = { slug: { $regex: regex } };
  if (excludeId)
    matchFilter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
  const docs = await News.find(matchFilter).select("slug").lean();

  if (!docs.length) return root;
  let maxN = 1,
    hasRoot = false;
  for (const d of docs) {
    const m = String(d.slug).match(regex);
    if (!m) continue;
    if (!m[1]) hasRoot = true;
    else {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxN) maxN = n;
    }
  }
  return hasRoot ? `${root}-${maxN + 1}` : root;
}

const toNum = (v: any) => (v === undefined || v === "" ? undefined : Number(v));

// ===== Controller =====
export const newsController = {
  async listPublic(req: Request, res: Response) {
    const { page, limit, q, sort, locale: qLocale } = req.query as any;
    const locale: Locale =
      (qLocale as Locale) ||
      detectLocale(req.headers["accept-language"] as string);

    const result = await newsRepo.list({
      page: toNum(page) || 1,
      limit: toNum(limit) || 20,
      q: q ? String(q) : undefined,
      includeUnpublished: false,
      sort: (sort as any) || undefined,
    });

    res.setHeader("Vary", "Accept-Language");
    if (!shouldLocalize(req)) return res.json(result);

    const items = result.items.map((d) => localizeNewsDoc(d, locale));
    return res.json({ ...result, items });
  },

  async getBySlug(req: Request, res: Response) {
    const doc = await newsRepo.getBySlug(req.params.slug);
    if (!doc || !doc.isPublished)
      return res.status(404).json({ message: "Not found" });

    const locale: Locale =
      ((req.query as any).locale as Locale) ||
      detectLocale(req.headers["accept-language"] as string);

    res.setHeader("Vary", "Accept-Language");
    if (!shouldLocalize(req)) return res.json(doc);
    return res.json(localizeNewsDoc(doc, locale));
  },

  async listAdmin(req: Request, res: Response) {
    const { page, limit, q, sort, locale: qLocale } = req.query as any;
    const locale: Locale =
      (qLocale as Locale) ||
      detectLocale(req.headers["accept-language"] as string);

    const result = await newsRepo.list({
      page: toNum(page) || 1,
      limit: toNum(limit) || 20,
      q: q ? String(q) : undefined,
      includeUnpublished: true,
      sort: (sort as any) || "-createdAt",
    });

    res.setHeader("Vary", "Accept-Language");
    if (!shouldLocalize(req)) return res.json(result);

    const items = result.items.map((d) => localizeNewsDoc(d, locale));
    return res.json({ ...result, items });
  },

  async create(req: Request, res: Response) {
    try {
      let b: any = req.body;
      if (typeof b === "string") {
        try {
          b = JSON.parse(b);
        } catch {}
      }
      if (!b || typeof b !== "object")
        return res.status(400).json({ message: "Missing JSON body" });

      // yêu cầu tối thiểu
      if (!b.title || !b.content)
        return res
          .status(400)
          .json({ message: "title and content are required" });

      // map field thường -> i18n.vi (nếu dev nhập đơn ngữ)
      liftPlainToI18n(b);

      const created = await newsRepo.create({
        title: String(b.title),
        title_i18n: b.title_i18n,
        excerpt: b.excerpt ? String(b.excerpt) : undefined,
        excerpt_i18n: b.excerpt_i18n,
        content: String(b.content),
        content_i18n: b.content_i18n,
        cover: b.cover ? String(b.cover) : undefined,
        images: Array.isArray(b.images) ? b.images : [],
        author: b.author ? String(b.author) : undefined,
        isPublished: b.isPublished !== undefined ? !!b.isPublished : true,
        publishedAt: b.publishedAt ? new Date(b.publishedAt) : new Date(),
      });

      res.status(201).json(created);
    } catch (e: any) {
      res.status(400).json({ message: e?.message || "Create failed" });
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
      if (!b || typeof b !== "object")
        return res.status(400).json({ message: "Missing JSON body" });

      // map field thường -> i18n.vi nếu gửi đơn ngữ
      liftPlainToI18n(b);

      const patch: any = {};

      // i18n fields (ưu tiên nếu client gửi)
      if ("title_i18n" in b) patch.title_i18n = b.title_i18n ?? undefined;
      if ("excerpt_i18n" in b) patch.excerpt_i18n = b.excerpt_i18n ?? undefined;
      if ("content_i18n" in b) patch.content_i18n = b.content_i18n ?? undefined;

      // fields thường (vẫn cho phép cập nhật)
      if ("title" in b) patch.title = String(b.title);
      if ("excerpt" in b)
        patch.excerpt = b.excerpt ? String(b.excerpt) : undefined;
      if ("content" in b) patch.content = String(b.content);
      if ("cover" in b) patch.cover = b.cover ? String(b.cover) : undefined;
      if ("images" in b) patch.images = Array.isArray(b.images) ? b.images : [];
      if ("author" in b) patch.author = b.author ? String(b.author) : undefined;
      if ("isPublished" in b) patch.isPublished = !!b.isPublished;
      if ("publishedAt" in b)
        patch.publishedAt = b.publishedAt
          ? new Date(b.publishedAt)
          : new Date();

      // slug logic
      if (!("slug" in b) && "title" in b) {
        const base = slugify(b.title);
        patch.slug = await makeUniqueNewsSlug(base, req.params.id);
      } else if ("slug" in b && b.slug) {
        patch.slug = await makeUniqueNewsSlug(
          slugify(String(b.slug)),
          req.params.id
        );
      }

      if (Object.keys(patch).length === 0)
        return res.status(400).json({ message: "No fields to update" });

      const updated = await newsRepo.update(req.params.id, patch);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e?.message || "Update failed" });
    }
  },

  async remove(req: Request, res: Response) {
    const deleted = await newsRepo.delete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  },
};
