import { Router } from "express";
import multer from "multer";
import { catalogController } from "../controllers/catalog.controller";
import { authAdmin } from "../middlewares/authAdmin";

const router = Router();
const upload = multer();

router.get("/", catalogController.listPublic);
router.get("/list", catalogController.listAdmin);

// redirect thẳng tới PDF (optional, tiện cho FE)
router.get("/:slug/open", catalogController.openBySlug);
router.get("/:slug", catalogController.getBySlug);

/** ADMIN */
router.post("/", authAdmin, catalogController.create);
router.post(
  "/upload",
  authAdmin,
  upload.single("file"),
  catalogController.uploadFile
);
router.put(
  "/:id/file",
  authAdmin,
  upload.single("file"),
  catalogController.replaceFile
);
router.put("/:id", authAdmin, catalogController.update);
router.delete("/:id", authAdmin, catalogController.remove);

export default router;
