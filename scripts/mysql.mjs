import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const localConfig = path.join(root, ".env.mysql.json");
const devVars = path.join(root, ".dev.vars");
const bootstrap = path.join(root, ".env.rye-bootstrap.sql");
const bridgeURL = "http://127.0.0.1:8791/index.php";
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
  if (existing && email !== existing.ADMIN_EMAIL) throw new Error("This installation already has a configured reviewer email.");
  const settings = existing || {
    DB_HOST: "127.0.0.1", DB_PORT: "3306", DB_NAME: "rye_atlas", DB_USER: "rye_atlas_app",
    DB_PASSWORD: randomBytes(32).toString("hex"), API_TOKEN: randomBytes(32).toString("hex"), ADMIN_EMAIL: email,
  };
  if (!existing) writeFileSync(localConfig, JSON.stringify(settings, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  // These fixed/local-only values can be imported through phpMyAdmin or the CLI installer.
  if (!/^[0-9a-f]{64}$/.test(settings.API_TOKEN)) throw new Error("Invalid local setup configuration.");
  const schema = readFileSync(path.join(root, "db/mysql/schema.sql"), "utf8");
  const grants = localAccountGrants(settings);
  const reserve = `INSERT INTO users (id, email, display_name, role) VALUES ('${randomUUID()}', '${email}', 'RYE reviewer', 'admin') ON DUPLICATE KEY UPDATE id = id;`;
  writeFileSync(bootstrap, [schema, grants, reserve, ""].join("\n"), { mode: 0o600 });
  return settings;
}

function enable(settings) {
  const contents = existsSync(devVars) ? readFileSync(devVars, "utf8") : "";
  const rest = contents.split(/\r?\n/).filter(line => !/^\s*(?:RYE_MYSQL_API_URL|RYE_MYSQL_API_TOKEN)\s*=/.test(line));
  while (rest.length && !rest.at(-1).trim()) rest.pop();
  writeFileSync(devVars, [...rest, "RYE_MYSQL_API_URL=" + bridgeURL, "RYE_MYSQL_API_TOKEN=" + settings.API_TOKEN, ""].join("\n"), { mode: 0o600 });
}

export function startLocalDatabaseBridge() {
  const child = spawn(php, ["-d", "display_errors=0", "-S", "127.0.0.1:8791", "-t", path.join(root, "db/mysql/public")],
    { cwd: root, stdio: ["ignore", "ignore", "inherit"], windowsHide: true });
  child.on("error", error => console.error("Could not start the local PHP database service.", error.message));
  return child;
}

export function usingLocalDatabase() {
  return existsSync(localConfig) && existsSync(devVars) &&
    readFileSync(devVars, "utf8").split(/\r?\n/).some(line => line === "RYE_MYSQL_API_URL=" + bridgeURL);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [command, email] = process.argv.slice(2);
  try {
    if (command === "setup" || command === "prepare") {
      const settings = prepare(email);
      if (command === "setup") {
        const setup = spawnSync(php, [path.join(root, "db/mysql/manage.php"), "install"], { cwd: root, stdio: "inherit", windowsHide: true });
        if (setup.error || setup.status !== 0) throw new Error("Could not install over the CLI connection. For phpMyAdmin, use npm run db:prepare and import .env.rye-bootstrap.sql.");
        unlinkSync(bootstrap);
      }
      enable(settings);
      console.log(command === "setup" ? "rye_atlas is ready. Run npm run db:admin to set the reviewer password."
        : "Import .env.rye-bootstrap.sql into local phpMyAdmin, then run npm run db:admin. Restart the website after setup.");
    } else if (command === "admin") {
      const result = spawnSync(php, [path.join(root, "db/mysql/manage.php"), "admin"], { cwd: root, stdio: "inherit", windowsHide: true });
      if (result.error || result.status !== 0) process.exitCode = 1;
    } else if (command === "serve") {
      startLocalDatabaseBridge();
    } else throw new Error("Choose setup, prepare, admin or serve.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
