import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.all("/api/auth/*", (req, res, next) => {
  toNodeHandler(auth)(req, res).catch((err: unknown) => {
    console.error("[Better Auth Error]", err);
    next(err);
  });
});

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

export default app;
