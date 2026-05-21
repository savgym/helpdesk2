import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import * as stats from "../controllers/stats";

const router = Router();
router.use(requireAuth);
router.get("/", stats.getDashboardStats);
export default router;
