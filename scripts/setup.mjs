import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = path.join(root, "backend", ".env");
if (!fs.existsSync(config)) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const user = (await rl.question("MySQL username [root]: ")) || "root";
  const password = await rl.question(
    "MySQL password (chỉ lưu trong backend/.env): ",
  );
  rl.close();
  fs.writeFileSync(
    config,
    fs
      .readFileSync(path.join(root, "backend", ".env.example"), "utf8")
      .replace(
        "root:YOUR_PASSWORD",
        encodeURIComponent(user) + ":" + encodeURIComponent(password),
      ),
  );
}
let content = fs.readFileSync(config, "utf8");
content = content
  .replace(
    "replace_with_a_random_secret_at_least_32_characters",
    crypto.randomBytes(48).toString("hex"),
  )
  .replace(
    "replace_with_another_random_secret_at_least_32_characters",
    crypto.randomBytes(48).toString("hex"),
  );
fs.writeFileSync(config, content);
const databaseUrl = content.match(/^DATABASE_URL=(.+)$/m)?.[1].trim();
if (!databaseUrl) throw new Error("Missing DATABASE_URL");
const url = new URL(databaseUrl);
const { default: mysql } = await import("mysql2/promise");
const connection = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
});
const dbName = url.pathname.slice(1);
if (!/^[a-zA-Z0-9_]+$/.test(dbName)) throw new Error("Invalid database name");
await connection.query(
  "CREATE DATABASE IF NOT EXISTS `" +
    dbName +
    "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
);
await connection.end();
console.log("MySQL connected. Database ready.");
if (!process.argv.includes("--database-only"))
  for (const command of ["db:generate", "db:migrate", "db:seed"])
    execFileSync(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", command],
      { cwd: root, stdio: "inherit", shell: process.platform === "win32" },
    );
