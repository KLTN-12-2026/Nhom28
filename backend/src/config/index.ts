import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
export const env = z
  .object({
    DATABASE_URL: z.string().startsWith("mysql://"),
    PORT: z.coerce.number().default(5000),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    FRONTEND_URL: z.string().url().default("http://localhost:5173"),
    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    OPENAI_API_KEY: z.string().default(""),
    OPENAI_MODEL: z.string().default(""),
    AI_ENABLED: z.string().default("true"),
    AI_FALLBACK_ENABLED: z.string().default("true"),
  })
  .parse(process.env);
export const db = new PrismaClient();
export const allowedOrigins =
  env.NODE_ENV === "development"
    ? [env.FRONTEND_URL, "http://127.0.0.1:5173"]
    : [env.FRONTEND_URL];
