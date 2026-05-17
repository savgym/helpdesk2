import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";
import * as users from "../controllers/users";

const router = Router();

router.get("/", requireAuth, users.listUsers);
router.post("/", requireAuth, requireAdmin, users.createUser);
router.patch("/:id/role", requireAuth, requireAdmin, users.updateRole);
router.patch("/:id", requireAuth, requireAdmin, users.updateUser);
router.delete("/:id", requireAuth, requireAdmin, users.deleteUser);

export default router;
