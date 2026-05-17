import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import usersRouter from "./routes/users";
import ticketsRouter from "./routes/tickets";
import inboundRouter from "./routes/inbound";

const app = express();

app.use(helmet());

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173").split(",");
app.use(cors({ origin: allowedOrigins, credentials: true }));

if (process.env.NODE_ENV === "production") {
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts, please try again later" },
  });
  app.use("/api/auth/sign-in", loginLimiter);
}

app.all("/api/auth/*path", (req, res, next) => {
  toNodeHandler(auth)(req, res).catch((err: unknown) => {
    console.error("[Better Auth Error]", err);
    next(err);
  });
});

// Inbound webhook — larger body limit before the global 50 kb cap
app.use("/api/inbound", express.json({ limit: "5mb" }), express.urlencoded({ extended: true, limit: "5mb" }));
app.use("/api/inbound", inboundRouter);

app.use(express.json({ limit: "50kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/users", usersRouter);
app.use("/api/tickets", ticketsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
