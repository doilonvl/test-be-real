import Catalog, { ICatalog } from "../models/Catalog";
import { FilterQuery } from "mongoose";

export type CatalogListOpts = {
  page?: number; limit?: number;
  q?: string; year?: number;
  includeUnpublished?: boolean;
  sort?: "year" | "-year" | "createdAt" | "-createdAt" | "title" | "-title";
};

export const catalogRepo = {
  async create(data: Partial<ICatalog>) {
    const doc = new Catalog(data);
    return doc.save();
  },

  async update(id: string, data: Partial<ICatalog>) {
    const doc = await Catalog.findById(id);
    if (!doc) return null;
    Object.assign(doc, data);
    return doc.save();
  },

  async delete(id: string) {
    return Catalog.findByIdAndDelete(id);
  },

  async getById(id: string) {
    return Catalog.findById(id);
  },

  async getBySlug(slug: string) {
    return Catalog.findOne({ slug });
  },

  async list(opts: CatalogListOpts = {}) {
    const {
      page = 1, limit = 50, q, year,
      includeUnpublished = false, sort
    } = opts;

    const filter: FilterQuery<ICatalog> = {};
    if (!includeUnpublished) filter.isPublished = true;
    if (q?.trim()) filter.$text = { $search: q.trim() };
    if (typeof year === "number") filter.year = year;

    const sortObj: Record<string,1|-1> =
      sort ? { [sort.startsWith("-") ? sort.slice(1) : sort]: sort.startsWith("-") ? -1 : 1 }
           : { year: -1, createdAt: -1 };

    const [items, total] = await Promise.all([
      Catalog.find(filter).sort(sortObj).skip((page-1)*limit).limit(limit),
      Catalog.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },
};
