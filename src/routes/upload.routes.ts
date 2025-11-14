import { Router } from "express";
import { uploadController } from "../controllers/upload.controller";

const router = Router();
router.post("/single", ...uploadController.single);
router.post("/multi", ...uploadController.multi);

export default router;
