# RYE · Raise Your Equality

RYE is a community story atlas. The local MySQL edition uses email/password accounts and a reviewer dashboard. Public visitors can read approved stories. Members can submit stories and photos for review.

## Run with XAMPP and MySQL

From this directory, start MySQL in the XAMPP Control Panel. Start Apache as well if you want to use phpMyAdmin. The app supports MySQL 8 and the MariaDB engine bundled with XAMPP. PHP 8 or later needs PDO MySQL, mbstring and Argon2id support.

For a fresh installation, run these commands in PowerShell. Replace the example address with the reviewer's email.

```powershell
npm.cmd run db:setup -- reviewer@example.com
npm.cmd run db:admin
npm.cmd run dev
```

Setup creates `rye_atlas`, a database user limited to that schema, and a reserved reviewer account. Use `RYE_MYSQL_SETUP_USER` and `RYE_MYSQL_SETUP_PASSWORD` in the setup process if your XAMPP administrator requires credentials. Rerunning setup preserves accounts, stories and review decisions. For an alternative using phpMyAdmin, run `npm.cmd run db:prepare -- reviewer@example.com`, then import the generated `.env.rye-bootstrap.sql` through the server's **Import** tab. This local file contains a database credential and belongs on your own computer.

`npm.cmd run db:admin` generates a reviewer password and shows it once in your terminal. You can supply your own password through the process environment variable `RYE_ADMIN_PASSWORD`. Running the command again resets the password and signs out existing reviewer sessions. Public registration always creates a member. A reviewer signs in on the same **Log in** page and goes directly to `/admin`.

Open the local address printed by `npm.cmd run dev` (normally `http://localhost:5173`). The local preview starts a PHP service on loopback port 8791. If PHP is installed outside XAMPP and outside your PATH, set `RYE_PHP` to its executable. For a separate built Worker preview, run `npm.cmd run db:serve` and provide the same server bindings to the Worker.

| Table | Contents |
| --- | --- |
| `users` | Display names, unique account emails, Argon2id password hashes and roles |
| `sessions` | Hashed session tokens and their expiration times |
| `stories` | Author, text, theme, publication status, reviewer and review time |
| `story_photos` | JPEGs, descriptions and optional filtered profile portraits |
| `auth_throttles` | Temporary counters for sign-up and login attempts |

The reusable schema is in `db/mysql/schema.sql`. Story text and photos are committed together. Admin approval makes both public, and declining keeps both private. The six sample stories ship with the website.

### Starting a recovered RYE database on Windows

If this checkout has a verified RYE export and its local `.env.mysql-recovery.json`, leave the XAMPP Control Panel modules stopped and run the following command from the site directory.

```powershell
npm.cmd run dev:recovered
```

The first run restores the five RYE tables under `%LOCALAPPDATA%\RYE`, checks the reviewer and table access, and keeps a copy of the verified SQL export there. It starts a separate MariaDB instance on `127.0.0.1:3317` and uses the existing website and PHP service. The terminal shows a generated RYE password once if the reviewer still needs one. Open the local website address it prints and use **Log in** with the reserved email.

Keep using `dev:recovered` for this copy. Later launches reuse its data and reviewer password. Press **Ctrl+C** in the preview terminal to stop it. If you lose the reviewer password, start the preview with `npm.cmd run dev:recovered -- --reset-admin` to generate a new one.

### Connecting a hosted database

Serve only `db/mysql/public` as the PHP document root over HTTPS. Keep its parent PHP files one directory above it. Set `RYE_MYSQL_DB_HOST`, `RYE_MYSQL_DB_PORT`, `RYE_MYSQL_DB_NAME`, `RYE_MYSQL_DB_USER`, `RYE_MYSQL_DB_PASSWORD` and a randomly generated `RYE_MYSQL_API_TOKEN` on that service. For a remote database that uses TLS, set `RYE_MYSQL_DB_CA` to the certificate file. Apply the schema and provision the reviewer on that database first.

Set the website's server bindings `RYE_MYSQL_API_URL` to the HTTPS PHP endpoint and `RYE_MYSQL_API_TOKEN` to the matching secret. The browser only calls the website's own API. The local XAMPP address is for development. Deployments without either MySQL binding keep using the earlier D1/R2 demo. Existing D1 stories and R2 photos require a separate migration before pointing a populated deployment at MySQL. Demo logins did not store real passwords, so people create a RYE password on their first database-backed registration.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git and `tar` (including Windows `tar.exe`) are required for publishing; portable publication does not require Bash

## Sites Lifecycle

The Sites initializer copies the shared starter and selects managed-linux only when `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Run `node <plugin-root>/scripts/configure-execution-profile.mjs` only when the profile is unknown for the current checkout and environment. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

Publish archives outside the source checkout or under its ignored `outputs/` directory. Local `.env*`, `.dev.vars*`, TypeScript build state, and tool runtime directories are ignored; keep the hosting manifest, migrations, and authored scripts in source control.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

For managed Linux browser QA, follow the Sites skill's managed preview reference. The daemon runs the project's Vite dev script with `--host 0.0.0.0 --port 4173 --strictPort`; use the CLI's returned URL. The ignored local profile survives the daemon's cleared environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `worker/index.ts` is the production Worker entrypoint and preserves request-scoped connector bindings
- `scripts/vite/` contains the maintained Vite integrations and the vendored Sites plugin license
- `scripts/connector-preview/` contains the local connector preview Worker and session helpers
- the remaining `scripts/` files select execution profiles and run installation, development, and builds; the plugin's helpers orchestrate the Sites lifecycle
- `dist/` contains generated deployment output; `.vinext/`, `.wrangler/`, and `.sites-runtime/` contain ignored local tool state
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` defines story storage for the D1-backed edition
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

### Story moderation in the earlier D1 demo

Use the existing Log in page. In the loopback development preview the reviewer email is `seedy@sites.test` and its local demo password is `AtlasReview!26`. You can also set `RYE_LOCAL_REVIEWER_EMAIL` in the ignored `.dev.vars` file to use your own email with that local password. The development identity provider opens the review desk after a successful login. Other demo logins open the atlas.

On the hosted site, set the server environment variable `RYE_ADMIN_EMAILS` to the comma-separated addresses of the authorized reviewers. Reviewers enter their email and a sample password on the demo form, then verify the matching account through the platform sign-in. Passwords for the hosted identity provider belong only on that provider’s sign-in page. Removing an address revokes its review access on the next request.

Migration `0002_story_review.sql` retains previously published community stories and makes new submissions pending. The public atlas, story links and photo endpoints expose submissions after approval. Reviewers can inspect the full story and photos before choosing a decision.

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
