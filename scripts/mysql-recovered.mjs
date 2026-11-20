import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { localAccountGrants, php } from "./mysql.mjs";

const site = fileURLToPath(new URL("../", import.meta.url));
const mysql = "C:/xampp/mysql";
const port = "3317";
const tables = ["users", "sessions", "stories", "story_photos", "auth_throttles"];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const readJson = file => JSON.parse(readFileSync(file, "utf8"));
const binary = name => path.join(mysql, "bin", name + ".exe");

// Only restore the verified RYE logical export. The shared XAMPP data directory
// is never a working directory or a target for this command.
export function prepareInstance(parent) {
  const config = readJson(path.join(site, ".env.mysql.json"));
  const installation = hash(config.API_TOKEN || config.DB_PASSWORD).slice(0, 16);
  const folder = path.join(parent, "atlas-" + installation);
  const instance = path.join(folder, "mysql-" + port);
  if (existsSync(instance)) {
    if (readJson(path.join(instance, "instance.json")).installation !== installation ||
        !existsSync(path.join(instance, "data", "rye_atlas", "users.frm")) ||
        !existsSync(path.join(instance, "control.ini"))) throw new Error("The existing RYE data folder is incomplete: " + instance);
    return instance;
  }
  const manifestFile = path.join(site, ".env.mysql-recovery.json");
  if (!existsSync(manifestFile)) throw new Error("This checkout has no verified RYE recovery export configured.");
  const manifest = readJson(manifestFile);
  const backup = readFileSync(manifest.backupFile);
  if (manifest.format !== "rye-logical-v1" || hash(backup) !== manifest.sha256 ||
      !tables.every(name => Number.isSafeInteger(manifest.counts[name]) && manifest.counts[name] >= 0)) {
    throw new Error("The RYE recovery export does not match its verification record.");
  }
  const appGrants = localAccountGrants(config);
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const staging = mkdtempSync(path.join(folder, "install-"));
  try {
    const install = spawnSync(binary("mysql_install_db"), ["--datadir=data", "--silent"],
      { cwd: staging, windowsHide: true, stdio: "ignore", timeout: 60000 });
    if (install.error || install.status !== 0) throw new Error("XAMPP could not initialize a new RYE data folder.");
    const data = path.join(staging, "data");
    const secret = randomBytes(32).toString("hex");
    // The export encodes string and binary values as hex. The Windows bootstrap
    // reader needs each complete SQL statement on its own line.
    const statements = backup.toString("utf8").trim().split(/;[ \t]*(?:\r?\n|$)/)
      .map(line => line.trim().replace(/\s*\r?\n\s*/g, " ")).filter(Boolean);
    const emailHex = Buffer.from(config.ADMIN_EMAIL, "utf8").toString("hex");
    const counts = tables.map(name => "(SELECT COUNT(*) FROM rye_atlas." + name + ")");
    counts.push(`(SELECT COUNT(*) FROM rye_atlas.users WHERE role = 'admin' AND BINARY email = X'${emailHex}')`,
      "(SELECT COUNT(*) FROM mysql.tables_priv WHERE User = 'rye_atlas_app' AND Db = 'rye_atlas' AND Host IN ('localhost', '127.0.0.1'))",
      "@@innodb_force_recovery");
    const setup = [
      ...statements.map(statement => statement + ";"),
      "DELETE FROM mysql.global_priv WHERE User = '' OR (User = 'root' AND Host NOT IN ('localhost', '127.0.0.1'));",
      "FLUSH PRIVILEGES;",
      ...["localhost", "127.0.0.1"].flatMap(host => [
        `CREATE USER IF NOT EXISTS 'root'@'${host}' IDENTIFIED BY '${secret}';`,
        `ALTER USER 'root'@'${host}' IDENTIFIED BY '${secret}';`,
      ]),
      "GRANT SHUTDOWN ON *.* TO 'root'@'127.0.0.1';",
      appGrants, "USE rye_atlas;",
      "SELECT " + counts.join(", ") + " INTO OUTFILE 'rye-restore-check.txt';", "",
    ].join("\n");
    const inputFile = path.join(staging, "setup.sql");
    writeFileSync(inputFile, setup, { flag: "wx", mode: 0o600 });
    const input = openSync(inputFile, "r");
    try {
      const restore = spawnSync(binary("mysqld"), ["--no-defaults", "--basedir=" + mysql, "--datadir=.",
        "--bootstrap", "--skip-networking", "--max-allowed-packet=64M", "--console"],
      { cwd: data, stdio: [input, "ignore", "pipe"], encoding: "utf8", windowsHide: true, timeout: 120000 });
      if (restore.error || restore.status !== 0) {
        const code = restore.stderr?.match(/ERROR[^\n]*?\b(\d{4})\b/i)?.[1] || restore.error?.code || restore.status;
        throw new Error("XAMPP could not restore the verified RYE export into the new database (code " + code + ").");
      }
    } finally {
      closeSync(input);
      unlinkSync(inputFile);
    }
    const checkFile = path.join(data, "rye_atlas", "rye-restore-check.txt");
    const expected = [...tables.map(name => manifest.counts[name]), 1, 10, 0].join("\t");
    if (readFileSync(checkFile, "utf8").trim() !== expected) throw new Error("RYE row, reviewer or access verification failed.");
    unlinkSync(checkFile);
    writeFileSync(path.join(staging, "recovered.sql"), backup, { flag: "wx", mode: 0o600 });
    writeFileSync(path.join(staging, "control.ini"), "[client]\nuser=root\npassword=" + secret + "\n", { flag: "wx", mode: 0o600 });
    writeFileSync(path.join(staging, "instance.json"), JSON.stringify({ installation, restoredFrom: manifest.sha256 }), { flag: "wx", mode: 0o600 });
    renameSync(staging, instance);
    return instance;
  } finally {
    if (existsSync(staging) && path.dirname(realpathSync(staging)) === realpathSync(folder) && path.basename(staging).startsWith("install-")) {
      rmSync(staging, { recursive: true });
    }
  }
}

function matchesServer(instance, options) {
  const result = spawnSync(binary("mysql"), [...options, "--batch", "--skip-column-names", "--raw", "--execute=SELECT @@datadir, @@port, @@innodb_force_recovery"],
    { encoding: "utf8", windowsHide: true, timeout: 2000 });
  if (result.status !== 0) return false;
  const [directory, actualPort, recovery] = result.stdout.trim().split("\t");
  return actualPort === port && recovery === "0" &&
    path.resolve(directory).toLowerCase() === path.resolve(instance, "data").toLowerCase();
}

function databasePortInUse() {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port: Number(port) });
    socket.setTimeout(3000, () => socket.destroy(new Error("connection timed out")));
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", error => {
      if (error.code === "ECONNREFUSED") resolve(false);
      else reject(new Error("Windows could not connect to 127.0.0.1:" + port + " (" + (error.code || error.message) + ")."));
    });
  });
}

async function run() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 1 || args[0] !== "--reset-admin")) throw new Error("Use dev:recovered with the optional --reset-admin flag.");
  if (process.platform !== "win32" || !process.env.LOCALAPPDATA || !existsSync(binary("mysqld"))) {
    throw new Error("This recovery uses the Windows XAMPP installation at C:/xampp.");
  }
  if (!existsSync(path.join(site, ".env.mysql.json"))) throw new Error("The local RYE MySQL configuration is missing.");
  const occupied = await databasePortInUse();
  const instance = prepareInstance(path.join(process.env.LOCALAPPDATA, "RYE"));
  const client = ["--defaults-file=" + path.join(instance, "control.ini"), "--protocol=TCP", "--host=127.0.0.1", "--port=" + port, "--connect-timeout=1"];
  if (occupied && !matchesServer(instance, client)) throw new Error("Another server is using port " + port + ". Check that service before starting RYE.");
  if (!occupied) {
    const log = path.join(instance, "mysql.log");
    const pidFile = path.join(instance, "mysql.pid");
    const server = spawn(binary("mysqld"), ["--no-defaults", "--basedir=" + mysql, "--datadir=" + path.join(instance, "data"),
      "--bind-address=127.0.0.1", "--port=" + port, "--pid-file=" + pidFile, "--log-error=" + log], { cwd: instance, windowsHide: true, stdio: "ignore", detached: true });
    let failed = false;
    server.once("error", () => { failed = true; });
    server.unref();
    process.once("exit", () => {
      if (server.pid && server.exitCode === null && existsSync(pidFile) && Number(readFileSync(pidFile, "utf8").trim()) === server.pid && matchesServer(instance, client)) {
        spawnSync(binary("mysqladmin"), [...client, "shutdown"], { windowsHide: true, stdio: "ignore", timeout: 15000 });
      }
    });
    process.once("SIGINT", () => process.exit(130));
    process.once("SIGTERM", () => process.exit(143));
    const deadline = Date.now() + 20000;
    while (!matchesServer(instance, client)) {
      if (failed || server.exitCode !== null || Date.now() >= deadline) throw new Error("The recovered database could not start on port " + port + ". Check " + log);
      await delay(300);
    }
  }
  console.log("RYE database ready on 127.0.0.1:" + port + ".");
  process.env.RYE_MYSQL_DB_HOST = "127.0.0.1";
  process.env.RYE_MYSQL_DB_PORT = port;
  const password = /^password=([0-9a-f]{64})$/m.exec(readFileSync(path.join(instance, "control.ini"), "utf8"))?.[1];
  if (!password) throw new Error("The recovered database control configuration is invalid.");
  const migrate = spawnSync(php, [path.join(site, "db/mysql/manage.php"), "migrate-local"], {
    cwd: site, windowsHide: true, stdio: "inherit",
    env: { ...process.env, RYE_MYSQL_SETUP_USER: "root", RYE_MYSQL_SETUP_PASSWORD: password },
  });
  if (migrate.error || migrate.status !== 0) throw new Error("Could not migrate the recovered database.");
  const command = args.includes("--reset-admin") ? "admin" : "init-admin";
  const admin = spawnSync(php, [path.join(site, "db/mysql/manage.php"), command], { cwd: site, windowsHide: true, stdio: "inherit" });
  if (admin.error || admin.status !== 0) throw new Error("Could not initialize the reviewer login for the recovered database.");
  process.argv = [process.execPath, path.join(site, "scripts/hostinger.mjs"), "preview"];
  await import("./hostinger.mjs");
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  run().catch(error => { console.error(error.message); process.exitCode = 1; });
}
