import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";
import prisma from "../lib/prisma";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/role", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body as { role?: string };
    const requestingUserId = res.locals.session.user.id;

    if (id === requestingUserId) {
      return res.status(400).json({ error: "You cannot change your own role" });
    }

    if (role !== "ADMIN" && role !== "AGENT") {
      return res.status(400).json({ error: "Invalid role" });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const requestingUserId = res.locals.session.user.id;

    if (id === requestingUserId) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
