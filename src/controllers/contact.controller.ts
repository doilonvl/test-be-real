import { Request, Response } from "express";
import { contactRepo } from "../repositories/contact.repo";
import { sendContactEmail } from "../services/sendContactEmail";

const HONEYPOT_FIELD = "website"; // field ẩn ở FE chặn bot

export const contactController = {
  // Guest submit form
  async create(req: Request, res: Response) {
    try {
      // honeypot
      if (req.body && typeof req.body[HONEYPOT_FIELD] === "string" && req.body[HONEYPOT_FIELD].trim() !== "") {
        return res.status(202).json({ message: "Accepted" });
      }

      // Lưu DB trước
      const contact = await contactRepo.create({
        fullName: req.body.fullName,
        email: req.body.email,
        organisation: req.body.organisation,
        phone: req.body.phone,
        message: req.body.message,
        city: req.body.city,
        country: req.body.country,
        address: req.body.address,
      });

      const enforce = String(process.env.ENFORCE_MAIL_DELIVERY || "false") === "true";
      if (enforce) {
        await sendContactEmail({
          fullName: contact.fullName,
          email: contact.email,
          organisation: contact.organisation,
          phone: contact.phone,
          message: contact.message,
          city: contact.city,
          country: contact.country,
          address: contact.address,
        });
      } else {
        sendContactEmail({
          fullName: contact.fullName,
          email: contact.email,
          organisation: contact.organisation,
          phone: contact.phone,
          message: contact.message,
          city: contact.city,
          country: contact.country,
          address: contact.address,
        }).catch((e) => console.error("[MAIL] Failed:", e?.message));
      }

      return res.status(201).json({ message: "Submitted", id: contact._id });
    } catch (err: any) {
      return res.status(400).json({ message: err?.message || "Bad Request" });
    }
  },

  // Admin list (read-only)
  async list(req: Request, res: Response) {
    const { page, limit, q, dateFrom, dateTo } = req.query as any;
    const result = await contactRepo.list({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      q: q ? String(q) : undefined,
      dateFrom: dateFrom ? String(dateFrom) : undefined,
      dateTo: dateTo ? String(dateTo) : undefined,
    });
    res.json(result);
  },

  // Admin get detail (read-only)
  async getOne(req: Request, res: Response) {
    const doc = await contactRepo.getById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  },
};
