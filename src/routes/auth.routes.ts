import { Router } from "express";
import multer from "multer";
import { authController, loginLimiter } from "../controllers/auth.controller";
import { authAdmin } from "../middlewares/authAdmin";

const router = Router();
const upload = multer();

router.post("/login", loginLimiter, authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", authAdmin, authController.me);

export default router;
