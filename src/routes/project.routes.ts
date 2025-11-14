import { Router } from "express";
import { projectController } from "../controllers/project.controller";
import multer from "multer";
import { authAdmin } from "../middlewares/authAdmin";

const router = Router();
const upload = multer();

router.get("/", projectController.listPublic);

router.get("/by-slug/:slug", projectController.getOneBySlugPublic);
router.get("/slug/check", authAdmin, projectController.checkSlug);
router.get("/slugify", authAdmin, projectController.slugifyPreview);
router.post("/:id/slug/regenerate", authAdmin, projectController.regenerateSlug);
router.post("/slugs/backfill", authAdmin, projectController.backfillSlugs);

router.get("/list", authAdmin, projectController.listAdmin);

router.get("/:id", projectController.getOne);
router.post("/", authAdmin, upload.none(), projectController.create);
router.put("/:id", authAdmin, upload.none(), projectController.update);
router.delete("/:id", authAdmin, projectController.remove);

export default router;
