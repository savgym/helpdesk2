import { Router } from "express";
import * as inbound from "../controllers/inbound";

const router = Router();
router.post("/email", inbound.receiveEmail);
export default router;
