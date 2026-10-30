import { app } from "./app.js";
import { db, env } from "./config/index.js";
await db.$connect();
const server = app.listen(env.PORT, "127.0.0.1", () =>
  console.log(`NutriAI API: http://localhost:${env.PORT}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close(() => {
      db.$disconnect().finally(() => process.exit(0));
    });
  });
