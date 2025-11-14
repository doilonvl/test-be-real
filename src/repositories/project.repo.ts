import Project, { IProject } from "../models/Project";
import { FilterQuery, isValidObjectId } from "mongoose";

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function baseSlug(project?: string) {
  return slugify(project || "project");
}

export async function ensureUniqueSlug(base: string, excludeId?: string) {
  const baseSlugStr = slugify(base);
  let candidate = baseSlugStr;
  let i = 1;
  while (true) {
    const existing = await Project.findOne({ slug: candidate })
      .collation({ locale: "en", strength: 2 })
      .lean();
    if (
      !existing ||
      (excludeId && String((existing as any)._id) === String(excludeId))
    ) {
      return candidate;
    }
    i += 1;
    candidate = `${baseSlugStr}-${i}`;
  }
}

async function checkSlugAvailabilityInternal(slug: string, excludeId?: string) {
  const s = slugify(slug);
  const existing = await Project.findOne({ slug: s })
    .collation({ locale: "en", strength: 2 })
    .lean();
  if (
    !existing ||
    (excludeId && String((existing as any)._id) === String(excludeId))
  ) {
    return { available: true, suggestion: s };
  }
  const suggestion = await ensureUniqueSlug(s, excludeId);
  return { available: false, suggestion };
}

async function regenerateSlugFor(id: string) {
  const doc = await Project.findById(id);
  if (!doc) return null;
  const base = baseSlug(doc.project);
  doc.slug = await ensureUniqueSlug(base, String(doc._id));
  return doc.save();
}

async function backfillSlugs(dryRun = true) {
  const candidates = await Project.find({
    $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }],
  });

  const items: Array<{ id: string; from: string | null; to: string }> = [];
  let updated = 0;

  for (const doc of candidates) {
    const from = (doc.slug as any) || null;
    const to = await ensureUniqueSlug(baseSlug(doc.project), String(doc._id));
    items.push({ id: String(doc._id), from, to });
    if (!dryRun) {
      doc.slug = to;
      await doc.save();
      updated += 1;
    }
  }

  return {
    dryRun,
    totalCandidates: candidates.length,
    updated,
    items,
  };
}

export type ProjectListOpts = {
  page?: number;
  limit?: number;
  sort?: "year" | "-year" | "createdAt" | "-createdAt";
  q?: string;
  client?: string;
  year?: number;
  includeUnpublished?: boolean;
};

export const projectRepo = {
  async create(data: Partial<IProject>) {
    const doc = new Project(data);
    if (!doc.slug) {
      const base = baseSlug(doc.project);
      doc.slug = await ensureUniqueSlug(base);
    } else {
      doc.slug = await ensureUniqueSlug(String(doc.slug));
    }
    return doc.save();
  },

  async update(id: string, data: Partial<IProject>) {
    const doc = await Project.findById(id);
    if (!doc) return null;
    const prev = {
      project: doc.project,
      client: doc.client,
      year: doc.year,
      slug: doc.slug,
    } as any;

    Object.assign(doc, data);

    if (data.slug !== undefined) {
      const raw = String(data.slug || "").trim();
      if (raw) {
        doc.slug = await ensureUniqueSlug(raw, String(doc._id));
      } else {
        const base = baseSlug(doc.project);
        doc.slug = await ensureUniqueSlug(base, String(doc._id));
      }
    } else if (!prev.slug) {
      const base = baseSlug(doc.project);
      doc.slug = await ensureUniqueSlug(base, String(doc._id));
    }

    return doc.save();
  },

  async delete(id: string) {
    return Project.findByIdAndDelete(id);
  },

  async getById(id: string) {
    return Project.findById(id);
  },

  async getBySlug(slug: string) {
    return Project.findOne({ slug }).collation({ locale: "en", strength: 2 });
  },

  async getPublicBySlug(slug: string) {
    return Project.findOne({ slug, isPublished: true }).collation({
      locale: "en",
      strength: 2,
    });
  },

  async getByIdOrSlug(idOrSlug: string) {
    if (isValidObjectId(idOrSlug)) {
      const byId = await Project.findById(idOrSlug);
      if (byId) return byId;
    }
    return Project.findOne({ slug: idOrSlug }).collation({
      locale: "en",
      strength: 2,
    });
  },

  async list(opts: ProjectListOpts = {}) {
    const {
      page = 1,
      limit = 20,
      sort,
      q,
      client,
      year,
      includeUnpublished = false,
    } = opts;

    const filter: FilterQuery<IProject> = {};
    if (!includeUnpublished) filter.isPublished = true;

    if (q?.trim()) filter.$text = { $search: q.trim() };
    if (client?.trim()) filter.client = new RegExp(client.trim(), "i");
    if (typeof year === "number") filter.year = year;

    let sortObj: Record<string, 1 | -1> = { year: -1, createdAt: -1 };
    if (sort) {
      sortObj = {};
      sortObj[sort.startsWith("-") ? sort.slice(1) : sort] = sort.startsWith(
        "-"
      )
        ? -1
        : 1;
    }

    const [items, total] = await Promise.all([
      Project.find(filter)
        .collation({ locale: "en", strength: 2 })
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(limit),
      Project.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  },

  slugify,
  baseSlug,
  ensureUniqueSlug,
  checkSlugAvailability: checkSlugAvailabilityInternal,
  regenerateSlugFor,
  backfillSlugs,
};
