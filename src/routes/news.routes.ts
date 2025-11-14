import { Router } from "express";
import multer from "multer";
import { newsController } from "../controllers/news.controller";
import { authAdmin } from "../middlewares/authAdmin";

const router = Router();
const upload = multer();

router.get("/", newsController.listPublic);
router.get("/list", authAdmin, newsController.listAdmin);

router.get("/:slug", newsController.getBySlug);

router.post("/", authAdmin, upload.none(), newsController.create);
router.put("/:id", authAdmin, upload.none(), newsController.update);
router.delete("/:id", authAdmin, newsController.remove);

export default router;
