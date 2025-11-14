import mongoose from "mongoose";
import { Request, Response } from "express";
import { productRepo } from "../repositories/productNode.repo";
import ProductNode from "../models/ProductNode";
import { detectLocale, localizeDoc, localizeList } from "../utils/localize";
import { ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";

const L_FIELDS = ["tagline", "description", "title"];
const slugify = (text: string) =>
  String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const escRe = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
function liftPlainToI18n(b: any, keys = ["tagline", "description", "title"]) {
  for (const k of keys) {
    if (!b?.[`${k}_i18n`] && b?.[k]) {
      b[`${k}_i18n`] = { vi: b[k] }; // mặc định VI
    }
  }
}
async function makeUniqueSlugForParent(
  parentId: string | null,
  base: string,
  excludeId?: string
) {
  const root = base || "node";
  const regex = new RegExp(`^${escRe(root)}(?:-(\\d+))?$`, "i");

  const filter: any = { slug: { $regex: regex } };
  if (parentId === null) filter.parent = null;
  else if (parentId) filter.parent = new mongoose.Types.ObjectId(parentId);
  if (excludeId) filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
  const siblings = await ProductNode.find(filter).select("slug").lean();
  if (!siblings.length) return root;

  let hasRoot = false;
  let maxN = 1;
  for (const s of siblings) {
    const m = String(s.slug).match(regex);
    if (!m) continue;
    if (m[1]) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxN) maxN = n;
    } else {
      hasRoot = true;
    }
  }
  return hasRoot ? `${root}-${maxN + 1}` : root;
}

export const productController = {
  async createProduct(req: Request, res: Response) {
    try {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      liftPlainToI18n(body, ["tagline", "description", "title"]);
      const product = await productRepo.create(req.body);
      res.status(201).json(product);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  },

  async getProducts(req: Request, res: Response) {
    const { page, limit, sort, type, q } = req.query as Record<string, string>;
    const locale =
      (req.query.locale as "vi" | "en") ||
      detectLocale(req.headers["accept-language"] as string);

    const result = await productRepo.list({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 12,
      sort: (sort as any) ?? "-createdAt",
      type: ["category", "group", "item"].includes(String(type))
        ? (type as any)
        : undefined,
      isPublished: true,
      q,
    });

    res.setHeader("Vary", "Accept-Language");
    res.json({
      ...result,
      items: localizeList(result.items, locale, L_FIELDS),
    });
  },

  async getProductBySlug(req: Request, res: Response) {
    const locale =
      (req.query.locale as "vi" | "en") ||
      detectLocale(req.headers["accept-language"] as string);

    const { slug } = req.params;
    const product = await productRepo.getBySlug(slug, locale);
    if (!product) return res.status(404).json({ message: "Not found" });

    res.setHeader("Vary", "Accept-Language");
    res.json(localizeDoc(product.toObject(), locale, L_FIELDS));
  },

  async updateProduct(req: Request, res: Response) {
    try {
      let b: any = req.body;
      if (typeof b === "string") {
        try {
          b = JSON.parse(b);
        } catch {}
      }
      liftPlainToI18n(b, ["tagline", "description", "title"]);
      if (!b || typeof b !== "object") {
        return res.status(400).json({ message: "Missing JSON body" });
      }

      const current = await ProductNode.findById(req.params.id).lean();
      if (!current || Array.isArray(current))
        return res.status(404).json({ message: "Not found" });

      let targetParent: string | null =
        b.parent === null
          ? null
          : typeof b.parent === "string"
          ? b.parent
          : current.parent
          ? String(current.parent)
          : null;

      // Build patch
      const patch: any = {};

      if ("title" in b) patch.title = String(b.title);
      if ("type" in b) patch.type = b.type; // "category" | "group" | "item"
      if ("parent" in b) patch.parent = b.parent === null ? null : b.parent; // mongoose sẽ cast ObjectId
      if ("tagline" in b) patch.tagline = b.tagline ?? undefined;
      if ("description" in b) patch.description = b.description ?? undefined;

      if ("tagline_i18n" in b) patch.tagline_i18n = b.tagline_i18n ?? undefined;
      if ("description_i18n" in b)
        patch.description_i18n = b.description_i18n ?? undefined;
      if ("title_i18n" in b) patch.title_i18n = b.title_i18n ?? undefined;
      if ("slug_i18n" in b) patch.slug_i18n = b.slug_i18n ?? undefined;

      if ("thumbnail" in b) patch.thumbnail = b.thumbnail ?? undefined;
      if ("images" in b) patch.images = Array.isArray(b.images) ? b.images : [];
      if ("specs" in b) patch.specs = b.specs || {};
      if ("order" in b) patch.order = Number(b.order);
      if ("isPublished" in b) patch.isPublished = !!b.isPublished;

      // QUY TẮC SLUG:
      // 1) Nếu client GỬI slug -> chuẩn hoá + ép unique theo parent đích
      if ("slug" in b && b.slug) {
        const base = slugify(String(b.slug));
        patch.slug = await makeUniqueSlugForParent(
          targetParent,
          base,
          req.params.id
        );
      }
      // 2) Nếu KHÔNG gửi slug nhưng CÓ đổi title -> slug tự đổi theo title (unique theo parent đích)
      else if ("title" in b) {
        const base = slugify(String(b.title));
        patch.slug = await makeUniqueSlugForParent(
          targetParent,
          base,
          req.params.id
        );
      }
      // 3) Nếu KHÔNG gửi slug & KHÔNG đổi title, nhưng CÓ đổi parent -> đảm bảo không đụng hàng ở parent mới
      else if ("parent" in b) {
        const base = slugify(String(current.slug));
        patch.slug = await makeUniqueSlugForParent(
          targetParent,
          base,
          req.params.id
        );
      }

      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }

      // Lưu: pre('validate') của model sẽ tự tính lại ancestors + path từ parent/slug mới
      const updated = await productRepo.update(req.params.id, patch);
      if (!updated) return res.status(404).json({ message: "Not found" });

      res.json(updated);
    } catch (err: any) {
      console.error("[PRODUCT UPDATE]", err);
      res.status(400).json({ message: err?.message || "Update failed" });
    }
  },
  async deleteProduct(req: Request, res: Response) {
    const { id } = req.params;
    await productRepo.delete(id);
    res.json({ message: "Deleted successfully" });
  },

  async listRoot(req: Request, res: Response) {
    const { page, limit, sort, type, isPublished } = req.query as any;
    const locale =
      (req.query.locale as any) ||
      detectLocale(req.headers["accept-language"] as string);

    const result = await productRepo.listRoot({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      sort: (sort as any) || "order",
      type,
      isPublished:
        typeof isPublished === "string" ? isPublished === "true" : undefined,
    });
    res.setHeader("Vary", "Accept-Language");
    if (shouldLocalize(req)) {
      return res.json({
        ...result,
        items: localizeList(
          result.items.map((i) => i.toObject?.() || i),
          locale,
          L_FIELDS
        ),
      });
    }
    res.json(result);
  },

  async listChildren(req: Request, res: Response) {
    const { path, parentId, page, limit, sort, type, isPublished } =
      req.query as any;
    const locale =
      (req.query.locale as any) ||
      detectLocale(req.headers["accept-language"] as string);

    const result = await productRepo.listChildren({
      path: path ? String(path) : undefined,
      parentId: typeof parentId === "string" ? parentId : undefined,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      sort: (sort as any) || "order",
      type,
      isPublished:
        typeof isPublished === "string" ? isPublished === "true" : undefined,
    });
    res.setHeader("Vary", "Accept-Language");
    if (shouldLocalize(req)) {
      return res.json({
        ...result,
        items: localizeList(
          result.items.map((i) => i.toObject?.() || i),
          locale,
          L_FIELDS
        ),
      });
    }
    res.json(result);
  },

  async getNodeWithChildren(req: Request, res: Response) {
    const { path, sort } = req.query as any;
    if (!path) return res.status(400).json({ message: "Missing 'path' query" });
    const locale =
      (req.query.locale as any) ||
      detectLocale(req.headers["accept-language"] as string);

    const data = await productRepo.getNodeWithChildrenByPath(
      String(path),
      (sort as any) || "order"
    );
    if (!data) return res.status(404).json({ message: "Node not found" });
    res.setHeader("Vary", "Accept-Language");
    if (!shouldLocalize(req)) return res.json(data);

    const node = localizeDoc(
      data.node.toObject?.() || data.node,
      locale,
      L_FIELDS
    );
    const children = localizeList(
      data.children.map((c) => c.toObject?.() || c),
      locale,
      L_FIELDS
    );
    return res.json({ node, children, breadcrumbs: data.breadcrumbs });
  },

  async search(req: Request, res: Response) {
    const { q, page, limit } = req.query as any;
    const result = await productRepo.search({
      q: String(q || "").trim(),
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
    res.json(result);
  },
};
function shouldLocalize(
  req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>
): boolean {
  if (req.query && (req.query as any).locale) return true;

  const acceptLang = req.headers["accept-language"];
  return typeof acceptLang === "string" && acceptLang.trim().length > 0;
}
