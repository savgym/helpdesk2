import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import * as tickets from "../controllers/tickets";

const router = Router();
router.use(requireAuth);
router.get("/", tickets.listTickets);
router.get("/:id", tickets.getTicket);
export default router;
