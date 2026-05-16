import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";
import * as users from "../controllers/users";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/", users.listUsers);
router.post("/", users.createUser);
router.patch("/:id/role", users.updateRole);
router.delete("/:id", users.deleteUser);

export default router;
