import { Router } from "express";
import { productController } from "../controllers/productNode.controller";
import { authAdmin } from "../middlewares/authAdmin";

const router = Router();

// ---- các route "đọc" cho phân cấp ----
router.get("/root", productController.listRoot);
router.get("/children", productController.listChildren);
router.get("/node", productController.getNodeWithChildren);
router.get("/search", productController.search);

router.get("/", productController.getProducts);
router.get("/:slug", productController.getProductBySlug);

router.post("/", authAdmin, productController.createProduct);
router.put("/:id", authAdmin, productController.updateProduct);
router.delete("/:id", authAdmin, productController.deleteProduct);

export default router;
