import News, { INews } from "../models/News";
import { FilterQuery } from "mongoose";

export type NewsListOpts = {
  page?: number;
  limit?: number;
  q?: string;
  includeUnpublished?: boolean;
  sort?: "publishedAt" | "-publishedAt" | "createdAt" | "-createdAt" | "title" | "-title";
};

export const newsRepo = {
  async create(data: Partial<INews>) {
    const doc = new News(data);
    return doc.save();
  },

  async update(id: string, data: Partial<INews>) {
    const doc = await News.findById(id);
    if (!doc) return null;
    Object.assign(doc, data);
    return doc.save();
  },

  async delete(id: string) {
    return News.findByIdAndDelete(id);
  },

  async getBySlug(slug: string) {
    return News.findOne({ slug });
  },

  async getById(id: string) {
    return News.findById(id);
  },

  async list(opts: NewsListOpts = {}) {
    const {
      page = 1,
      limit = 20,
      q,
      includeUnpublished = false,
      sort,
    } = opts;

    const filter: FilterQuery<INews> = {};
    if (!includeUnpublished) filter.isPublished = true;
    if (q?.trim()) filter.$text = { $search: q.trim() };

    const sortObj: Record<string, 1 | -1> =
      sort ? { [sort.startsWith("-") ? sort.slice(1) : sort]: sort.startsWith("-") ? -1 : 1 }
           : { publishedAt: -1, createdAt: -1 };

    const [items, total] = await Promise.all([
      News.find(filter).sort(sortObj).skip((page - 1) * limit).limit(limit),
      News.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  },
};
