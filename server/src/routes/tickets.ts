import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import * as tickets from "../controllers/tickets";

const router = Router();
router.use(requireAuth);
router.get("/", tickets.listTickets);
router.get("/:id", tickets.getTicket);
router.patch("/:id", tickets.updateTicket);
router.post("/:id/messages", tickets.createMessage);
router.post("/:id/polish", tickets.polishReply);
router.post("/:id/summarize", tickets.summarizeTicket);
export default router;
