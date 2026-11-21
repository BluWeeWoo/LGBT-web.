import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { php } from "./mysql.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = path.join(root, "out");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

export function serve() {
  if (!existsSync(path.join(out, "index.html"))) throw new Error("Build the website first with npm run build.");
  const port = process.env.RYE_DEV_PORT || "5173";
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("Set RYE_DEV_PORT to a valid TCP port.");
  }
  console.log("RYE website: http://127.0.0.1:" + port);
  return run(php, ["-d", "display_errors=0", "-S", "127.0.0.1:" + port, "-t", out, path.join(root, "db/mysql/router.php")]);
}

function packageSite() {
  const dist = path.join(root, "dist");
  mkdirSync(dist, { recursive: true });
  const bundle = mkdtempSync(path.join(dist, "hostinger-"));
  cpSync(out, path.join(bundle, "public_html"), { recursive: true });
  cpSync(path.join(root, "deploy/hostinger"), path.join(bundle, "public_html"), { recursive: true });
  const backend = path.join(bundle, "db/mysql");
  mkdirSync(backend, { recursive: true });
  for (const item of ["accounts.php", "chat.php", "connection.php", "manage.php", "migrate.php", "photo-files.php", "stories.php", "migrations", "public"]) {
    cpSync(path.join(root, "db/mysql", item), path.join(backend, item), { recursive: true });
  }
  cpSync(path.join(root, ".env.mysql.example.json"), path.join(bundle, ".env.mysql.example.json"));
  mkdirSync(path.join(bundle, "storage/story-photos"), { recursive: true });
  console.log("Hostinger package: " + bundle);
}

const command = process.argv[2];
try {
  if (!["preview", "serve", "package"].includes(command)) throw new Error("Choose preview, serve or package.");
  if (command !== "serve") {
    process.exitCode = run(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "build"]);
  }
  if (!process.exitCode) {
    if (command === "package") packageSite();
    else process.exitCode = serve();
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
