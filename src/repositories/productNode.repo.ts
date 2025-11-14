import { FilterQuery, SortOrder, Types } from "mongoose";
import ProductNode from "../models/ProductNode";
import { IProductNode } from "../models/ProductNode";

export type ListOpts = {
  page?: number;
  limit?: number;
  sort?: "order" | "-order" | "title" | "-title" | "createdAt" | "-createdAt";
  type?: "category" | "group" | "item";
  isPublished?: boolean;
  q?: string;
};
function mapSort(sort?: ListOpts["sort"]): Record<string, SortOrder> {
  switch (sort) {
    case "order":
      return { order: 1 };
    case "-order":
      return { order: -1 };
    case "title":
      return { title: 1 };
    case "-title":
      return { title: -1 };
    case "createdAt":
      return { createdAt: 1 };
    case "-createdAt":
    default:
      return { createdAt: -1 };
  }
}
export const productRepo = {
  async create(data: Partial<IProductNode>) {
    const product = new ProductNode(data);
    return product.save();
  },

  async getAll() {
    return ProductNode.find({ isPublished: true }).sort({ order: 1 });
  },

  async getBySlug(slug: string, locale: string) {
    return ProductNode.findOne({ slug });
  },

  async update(id: string, data: Partial<IProductNode>) {
    const doc = await ProductNode.findById(id);
    if (!doc) return null;

    Object.assign(doc, data);
    await doc.validate();
    return doc.save();
  },
  async delete(id: string) {
    return ProductNode.findByIdAndDelete(id);
  },

  async listRoot(opts: ListOpts = {}) {
    const { page = 1, limit = 20, sort = "order", type, isPublished } = opts;

    const filter: FilterQuery<IProductNode> = { parent: null };
    if (type) filter.type = type;
    if (typeof isPublished === "boolean") filter.isPublished = isPublished;

    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sort.startsWith("-") ? sort.slice(1) : sort] = sort.startsWith("-")
      ? -1
      : 1;

    const [items, total] = await Promise.all([
      ProductNode.find(filter)
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(limit),
      ProductNode.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  },

  async listChildren(
    params: { path?: string; parentId?: string | null } & ListOpts
  ) {
    const {
      path,
      parentId,
      page = 1,
      limit = 20,
      sort = "order",
      type,
      isPublished,
    } = params;

    const filter: FilterQuery<IProductNode> = {};
    if (type) filter.type = type;
    if (typeof isPublished === "boolean") filter.isPublished = isPublished;

    if (path) {
      const parent = await ProductNode.findOne({ path }).select("_id");
      if (!parent) return { items: [], total: 0, page, limit };
      filter.parent = parent._id;
    } else if (parentId === null) {
      filter.parent = null;
    } else if (parentId) {
      filter.parent = new Types.ObjectId(parentId);
    } else {
      return { items: [], total: 0, page, limit };
    }

    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sort.startsWith("-") ? sort.slice(1) : sort] = sort.startsWith("-")
      ? -1
      : 1;

    const [items, total] = await Promise.all([
      ProductNode.find(filter)
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(limit),
      ProductNode.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  },

  async getNodeWithChildrenByPath(
    path: string,
    childSort: "order" | "-order" = "order"
  ) {
    const node = await ProductNode.findOne({ path });
    if (!node) return null;

    const sortObj: Record<string, 1 | -1> = {};
    sortObj[childSort.startsWith("-") ? childSort.slice(1) : childSort] =
      childSort.startsWith("-") ? -1 : 1;

    const children = await ProductNode.find({ parent: node._id }).sort(sortObj);

    const breadcrumbs = [
      ...node.ancestors.map((a: { title: any; slug: any }) => ({
        title: a.title,
        slug: a.slug,
      })),
      { title: node.title, slug: node.slug },
    ];

    return { node, children, breadcrumbs };
  },

  async search(params: { q: string; page?: number; limit?: number }) {
    const { q, page = 1, limit = 20 } = params;

    if (!q?.trim()) {
      return { items: [], total: 0, page, limit };
    }

    const filter: FilterQuery<IProductNode> = {
      $text: { $search: q.trim() },
    };

    const [items, total] = await Promise.all([
      ProductNode.find(filter)
        .select({ score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" } })
        .skip((page - 1) * limit)
        .limit(limit),
      ProductNode.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  },
  async list(opts: ListOpts = {}) {
    const page = Math.max(1, Number(opts.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(opts.limit ?? 12)));
    const skip = (page - 1) * limit;

    const filter: FilterQuery<IProductNode> = {};
    if (typeof opts.isPublished === "boolean")
      filter.isPublished = opts.isPublished;
    else filter.isPublished = true;

    if (opts.type) filter.type = opts.type;

    if (opts.q) {
      const rx = new RegExp(String(opts.q), "i");
      filter.$or = [
        { title: rx },
        { slug: rx },
        { "title_i18n.vi": rx },
        { "title_i18n.en": rx },
      ];
    }

    const sortObj = mapSort(opts.sort);

    const [items, total] = await Promise.all([
      ProductNode.find(filter).sort(sortObj).skip(skip).limit(limit).lean(),
      ProductNode.countDocuments(filter),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  },
};
