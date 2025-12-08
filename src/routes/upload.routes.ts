import { Router } from "express";
import { uploadController } from "../controllers/upload.controller";
import { authAdmin } from "../middlewares/authAdmin";
import rateLimit from "express-rate-limit";

const router = Router();

const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/single", authAdmin, uploadLimiter, ...uploadController.single);
router.post("/multi", authAdmin, uploadLimiter, ...uploadController.multi);

export default router;
