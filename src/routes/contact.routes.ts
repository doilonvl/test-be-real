import { Router } from "express";
import rateLimit from "express-rate-limit";
import { contactController } from "../controllers/contact.controller";
import { authAdmin } from "../middlewares/authAdmin";

const router = Router();

const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/", contactLimiter, contactController.create);

router.get("/", authAdmin, contactController.list);
router.get("/:id", authAdmin, contactController.getOne);

export default router;
