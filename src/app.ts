import express, { Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import { indexRouter } from ".";
import { requestId } from "./middleware/requestId";

const app: Application = express();

// 1. Request id must be first so every downstream middleware/handler
//    (including globalErrorHandler) can read `req.id`.
app.use(requestId);

// 2. Cookie & body parsers
app.use(cookieParser());
app.use(express.json());

// CORS Setup
const allowedOrigins = ["http://localhost:3000"].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const isAllowed =
        allowedOrigins.includes(origin) ||
        /^https:\/\/.*\.vercel\.app$/.test(origin); // Allow Vercel deployments

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "x-request-id"],
    exposedHeaders: ["Set-Cookie", "x-request-id"],
  })
);

// Better Auth API Route
app.all("/api/auth/*splat", toNodeHandler(auth));

// Health Check Route
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running successfully",
    service: "Backend API",
    version: "1.0.0",
    environment: process.env.NODE_ENV ?? "development",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1", indexRouter);

export default app;