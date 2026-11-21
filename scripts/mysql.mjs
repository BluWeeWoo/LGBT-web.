import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const localConfig = path.join(root, ".env.mysql.json");
const bootstrap = path.join(root, ".env.rye-bootstrap.sql");
export const php = process.env.RYE_PHP || (process.platform === "win32" && existsSync("C:/xampp/php/php.exe") ? "C:/xampp/php/php.exe" : "php");

export function localAccountGrants(settings) {
  if (settings.DB_USER !== "rye_atlas_app" || settings.DB_NAME !== "rye_atlas" || !/^[0-9a-f]{64}$/.test(settings.DB_PASSWORD)) {
    throw new Error("Invalid local RYE database account configuration.");
  }
  const accounts = ["'rye_atlas_app'@'localhost'", "'rye_atlas_app'@'127.0.0.1'"];
  const grants = accounts.map(account => `CREATE USER IF NOT EXISTS ${account} IDENTIFIED BY '${settings.DB_PASSWORD}';`);
  const privileges = {
    users: "SELECT, INSERT, UPDATE", sessions: "SELECT, INSERT, DELETE",
    stories: "SELECT, INSERT, UPDATE, DELETE", story_photos: "SELECT, INSERT",
    auth_throttles: "SELECT, INSERT, UPDATE, DELETE",
  };
  for (const [table, rights] of Object.entries(privileges)) {
    grants.push(`GRANT ${rights} ON rye_atlas.${table} TO ${accounts.join(", ")};`);
  }
  return grants.join("\n");
}

function prepare(adminEmail) {
  const existing = existsSync(localConfig) ? JSON.parse(readFileSync(localConfig, "utf8")) : null;
  const email = (adminEmail || existing?.ADMIN_EMAIL || "").trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) || email.length > 254) {
    throw new Error("Supply the reviewer email, for example npm run db:setup -- reviewer@example.com");
  }
  if (existing?.ADMIN_EMAIL && email !== existing.ADMIN_EMAIL) throw new Error("This installation already has a configured reviewer email.");
  const settings = existing || {
    DB_HOST: "127.0.0.1", DB_PORT: "3306", DB_NAME: "rye_atlas", DB_USER: "rye_atlas_app",
    DB_PASSWORD: randomBytes(32).toString("hex"), ADMIN_EMAIL: email,
  };
  if (!existing) writeFileSync(localConfig, JSON.stringify(settings, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  else if (!existing.ADMIN_EMAIL) writeFileSync(localConfig, JSON.stringify({ ...settings, ADMIN_EMAIL: email }, null, 2) + "\n");
  // These fixed/local-only values can be imported through phpMyAdmin or the CLI installer.
  const schema = ["001_initial.sql", "004_connections.sql"].map(file =>
    readFileSync(path.join(root, "db/mysql/migrations", file), "utf8"));
  const grants = localAccountGrants(settings);
  const chatGrants = readFileSync(path.join(root, "db/mysql/migrations/local_chat_grants.sql"), "utf8");
  const reserve = `INSERT INTO users (id, email, display_name, role) VALUES ('${randomUUID()}', '${email}', 'RYE reviewer', 'admin') ON DUPLICATE KEY UPDATE id = id;`;
  writeFileSync(bootstrap, [
    "CREATE DATABASE IF NOT EXISTS rye_atlas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "USE rye_atlas;", ...schema, grants, chatGrants, reserve, "",
  ].join("\n"), { mode: 0o600 });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [command, email] = process.argv.slice(2);
  try {
    if (command === "setup" || command === "prepare") {
      prepare(email);
      if (command === "setup") {
        const setup = spawnSync(php, [path.join(root, "db/mysql/manage.php"), "install"], { cwd: root, stdio: "inherit", windowsHide: true });
        if (setup.error || setup.status !== 0) throw new Error("Could not install over the CLI connection. For phpMyAdmin, use npm run db:prepare and import .env.rye-bootstrap.sql.");
        unlinkSync(bootstrap);
      }
      console.log(command === "setup" ? "rye_atlas is ready. Run npm run db:admin to set the reviewer password."
        : "For a fresh installation, import .env.rye-bootstrap.sql into local phpMyAdmin, then run npm run db:admin.");
    } else if (command === "admin" || command === "migrate") {
      const result = spawnSync(php, [path.join(root, "db/mysql/manage.php"), command], { cwd: root, stdio: "inherit", windowsHide: true });
      if (result.error || result.status !== 0) process.exitCode = 1;
    } else throw new Error("Choose setup, prepare, admin or migrate.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
