import Contact, { IContact } from "../models/Contact";
import { FilterQuery } from "mongoose";

export const contactRepo = {
  async create(data: Partial<IContact>) {
    const doc = new Contact(data);
    return doc.save();
  },

  async list(params: {
    page?: number; limit?: number; q?: string;
    dateFrom?: string; dateTo?: string;
  }) {
    const { page = 1, limit = 20, q, dateFrom, dateTo } = params;
    const filter: FilterQuery<IContact> = {};

    if (q?.trim()) {
      const rx = new RegExp(q.trim(), "i");
      Object.assign(filter, {
        $or: [
          { fullName: rx }, { email: rx }, { organisation: rx },
          { phone: rx }, { message: rx }, { city: rx },
          { country: rx }, { address: rx }
        ]
      });
    }

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) (filter.createdAt as any).$gte = new Date(dateFrom);
      if (dateTo) (filter.createdAt as any).$lte = new Date(dateTo);
    }

    const [items, total] = await Promise.all([
      Contact.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Contact.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  async getById(id: string) {
    return Contact.findById(id);
  },
};
