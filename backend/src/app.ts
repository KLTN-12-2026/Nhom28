import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import swaggerUi from "swagger-ui-express";
import { z, ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { db, env, allowedOrigins } from "./config/index.js";
import { auth } from "./middlewares/auth.js";
import { authRouter } from "./routes/auth.js";
import { catalog } from "./routes/catalog.js";
import { personal } from "./routes/personal.js";
import { plans } from "./routes/plans.js";
import { ai } from "./routes/ai.js";
import { admin } from "./routes/admin.js";
import { reports } from "./routes/reports.js";
import { discover } from "./routes/discover.js";
import { hydration } from "./routes/hydration.js";
import { AppError, wrap, ok, token } from "./utils/core.js";
export const app = express();
app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 1000,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, error: "Quá nhiều yêu cầu. Hãy thử lại sau." },
  }),
);
app.use("/api", (req, res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.header("origin") &&
    !allowedOrigins.includes(req.header("origin")!)
  )
    return next(new AppError(403, "Nguồn yêu cầu không hợp lệ."));
  next();
});
app.get(
  "/api/health",
  wrap(async (req, res) => {
    await db.$queryRaw`SELECT 1`;
    ok(res, {
      status: "ok",
      database: "mysql",
      aiConfigured: !!env.OPENAI_API_KEY && !!env.OPENAI_MODEL,
    });
  }),
);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/public", discover);
const api = express.Router();
api.use(auth);
api.use(
  rateLimit({
    windowMs: 60000,
    limit: 300,
    keyGenerator: (req) => req.user.id,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      error: "Bạn đã gửi quá nhiều yêu cầu. Hãy thử lại sau một phút.",
    },
  }),
);
api.use(catalog);
api.use(personal);
api.use(hydration);
api.use(plans);
api.use("/ai", ai);
api.use("/admin", admin);
api.use(reports);
const uploads = path.resolve("uploads");
fs.mkdirSync(uploads, { recursive: true });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
});
api.post(
  "/uploads",
  upload.single("image"),
  wrap(async (req, res) => {
    if (!req.file) throw new AppError(400, "Chọn ảnh JPG, PNG hoặc WebP.");
    const b = req.file.buffer;
    let extension = "";
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) extension = "jpg";
    if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
      extension = "png";
    if (
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP"
    )
      extension = "webp";
    if (!extension) throw new AppError(400, "Định dạng ảnh không hỗ trợ.");
    const name = token() + "." + extension;
    await fs.promises.writeFile(path.join(uploads, name), b);
    ok(res, { url: "/uploads/" + name });
  }),
);
api.put(
  "/users/avatar",
  wrap(async (req, res) => {
    const { avatar } = z
      .object({
        avatar: z.string().regex(/^\/uploads\/[a-f0-9]+\.(jpg|png|webp)$/),
      })
      .parse(req.body);
    await db.user.update({ where: { id: req.user.id }, data: { avatar } });
    ok(res, { avatar });
  }),
);
app.use("/api/v1", api);
app.use(
  "/uploads",
  express.static(uploads, {
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  }),
);
const paths: any = {};
for (const [route, methods] of Object.entries({
  "/auth/register": ["post"],
  "/auth/login": ["post"],
  "/auth/me": ["get"],
  "/auth/refresh": ["post"],
  "/auth/logout": ["post"],
  "/auth/forgot-password": ["post"],
  "/auth/reset-password": ["post"],
  "/users/profile": ["get", "put"],
  "/users/goals": ["get", "put"],
  "/foods": ["get", "post"],
  "/foods/{id}": ["get", "put", "delete"],
  "/recipes": ["get", "post"],
  "/recipes/{id}": ["get", "put", "delete"],
  "/meal-logs": ["get", "post"],
  "/meal-logs/{id}": ["put", "delete"],
  "/measurements": ["get", "post"],
  "/hydration": ["get", "post"],
  "/hydration/goal": ["put"],
  "/hydration/{id}": ["delete"],
  "/public/explore": ["get"],
  "/meal-plans": ["get", "post"],
  "/meal-plans/{id}": ["get", "put", "delete"],
  "/meal-plans/{id}/apply": ["post"],
  "/ai/generate-meal-plan": ["post"],
  "/ai/recommendation-history": ["get"],
  "/ai/chat": ["post"],
  "/shopping-lists": ["get"],
  "/analytics/dashboard": ["get"],
  "/analytics/export": ["get"],
  "/admin/dashboard": ["get"],
  "/admin/users": ["get"],
  "/admin/audit-logs": ["get"],
})) {
  paths[route] = Object.fromEntries(
    methods.map((method) => [
      method,
      {
        summary: method.toUpperCase() + " " + route,
        tags: [route.split("/")[1]],
        security: [{ cookieAuth: [] }],
        ...(route.includes("{id}")
          ? {
              parameters: [
                {
                  name: "id",
                  in: "path",
                  required: true,
                  schema: { type: "string" },
                },
              ],
            }
          : {}),
        ...(["post", "put"].includes(method)
          ? {
              requestBody: {
                content: {
                  "application/json": {
                    schema: { type: "object", additionalProperties: true },
                  },
                },
              },
            }
          : {}),
        responses: {
          "200": { description: "JSON envelope: {success:true,data,meta?}" },
          "400": { description: "Validation error" },
          "401": { description: "Unauthenticated" },
          "403": { description: "Forbidden" },
        },
      },
    ]),
  );
}
const spec = {
  openapi: "3.0.3",
  info: {
    title: "NutriAI API",
    version: "1.0.0",
    description:
      "Đăng nhập trước, dùng cookie HttpOnly và x-csrf-token trả trong /auth/me cho request ghi dữ liệu. Xem docs/api.md để có schema request và luồng đầy đủ.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      cookieAuth: { type: "apiKey", in: "cookie", name: "access" },
    },
  },
  paths,
};
app.get("/api/openapi.json", (_, res) => res.json(spec));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(spec));
app.use((req, res) =>
  res.status(404).json({ success: false, error: "Không tìm thấy endpoint." }),
);
app.use(
  (
    error: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: error.issues
          .map((i) => i.path.join(".") + ": " + i.message)
          .join("; "),
      });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const status =
        error.code === "P2002" ? 409 : error.code === "P2025" ? 404 : 400;
      res.status(status).json({
        success: false,
        error:
          error.code === "P2002"
            ? "Dữ liệu đã tồn tại."
            : "Dữ liệu không hợp lệ hoặc không còn tồn tại.",
      });
      return;
    }
    if (error instanceof multer.MulterError) {
      res.status(400).json({ success: false, error: "Ảnh phải nhỏ hơn 3MB." });
      return;
    }
    const status = error instanceof AppError ? error.status : 500;
    if (status === 500)
      console.error("Request failed:", error.name, error.code || "INTERNAL");
    res.status(status).json({
      success: false,
      error: status === 500 ? "Có lỗi xử lý. Vui lòng thử lại." : error.message,
    });
  },
);
