# RYE · Raise Your Equality

RYE is a community story atlas. Members use email and password to submit stories and photos. Reviewers approve or decline submissions from the review desk.

MySQL or MariaDB stores accounts, sessions, story text, photo descriptions, and moderation decisions. Uploaded JPEGs and optional portrait prints live under `storage/story-photos/`, outside the web root. PHP serves them through the story API after checking publication status or reviewer access. The sample stories and their images ship with the frontend.

## Run locally on Windows

Use Node.js 22.13+, PHP 8.2+ with PDO MySQL, mbstring and Argon2id, and XAMPP MySQL or MariaDB. Start MySQL in the XAMPP Control Panel, then run these commands from the checkout.

```powershell
npm.cmd ci
npm.cmd run db:setup -- reviewer@example.com
npm.cmd run db:admin
npm.cmd run dev
```

Replace the example with your reviewer's email. `db:setup` creates the local `rye_atlas` database and its limited application account. It also upgrades existing RYE tables. For an XAMPP administrator with custom credentials, set `RYE_MYSQL_SETUP_USER` and `RYE_MYSQL_SETUP_PASSWORD` before setup. For PHP outside XAMPP and your PATH, set `RYE_PHP` to the executable path.

The admin command creates or resets the reviewer password and signs out older reviewer sessions. It prints a generated password once. Open the preview URL, which defaults to `http://127.0.0.1:5173`. `npm run dev` builds the frontend before starting PHP. To reuse a completed build, run `npm run start`.

If you already have a verified RYE recovery export and the local `.env.mysql-recovery.json`, `npm run dev:recovered` starts the separate recovered MariaDB instance and applies the photo migration before launching the site. It uses the same private upload folder.

## Prepare a Hostinger deployment

1. In hPanel, add a **Custom PHP/HTML** website and enable HTTPS. Select PHP 8.2 or later with PDO MySQL, mbstring and Argon2id support. Node.js is used to build the frontend on your computer.
2. Extract the prepared Hostinger archive, or build the bundle from source with `npm ci` and `npm run build:hostinger`. The build prints the new bundle directory under `dist/`.
3. In hPanel, create a MySQL database and user. Open phpMyAdmin for that database and import `db/mysql/migrations/001_initial.sql` from the bundle. The SQL creates tables in the selected database and works with Hostinger-assigned database names.
4. Upload the bundle contents to the domain's directory so its `public_html/`, `db/` and `storage/` directories are siblings. Include `public_html/.htaccess`, which routes `/api/` to PHP. If File Manager opens directly inside `public_html`, go up one level for the private files.
5. Copy `.env.mysql.example.json` to `.env.mysql.json` beside `public_html/`. Fill in the database details displayed by hPanel, your reviewer email and the exact HTTPS origin of the site, with no trailing slash. Give PHP write access to `storage/story-photos/`. Keep the upload directory and database credentials private.
6. From the domain directory over SSH, run `php db/mysql/manage.php init-admin`. Use the generated password on the site's Log in page. If your plan has no SSH, create your reviewer account through Sign up while access is restricted, verify the account is yours in phpMyAdmin and change that account's `role` from `member` to `admin`. Log in again to open the review desk.
7. Check the deployment by signing up with a member account and submitting a story with a photo. Approve it as the reviewer and confirm that both the story and its photo become visible to a signed-out visitor.

See [Hostinger's website setup guide](https://www.hostinger.com/support/1583214-how-to-add-a-website-in-hostinger/) and [database import guide](https://www.hostinger.com/support/1864324-how-to-upload-and-set-up-your-database-at-hostinger/).

## Upgrade an existing PHP/MySQL installation

Take a database export and back up `storage/story-photos/`. Stop incoming requests while the migration runs. Restore the exported database into the Hostinger database if moving hosts, then run `php db/mysql/manage.php migrate` from the domain directory before taking the site online. To prepare an upgraded export when the host lacks SSH, run the command on a local copy first, then upload the resulting database export and matching photo folder together.

The migration runner adds filesystem metadata, copies the existing MySQL JPEGs and portrait prints into the private storage folder, and removes the old BLOB columns after copying succeeds. Rerun it after correcting a failed copy. The files numbered `002` and `003` are used by the runner for this upgrade. Fresh databases only need `001_initial.sql`.

For future uploads and deploys, keep `.env.mysql.json` and the existing `storage/story-photos/` folder in place. Back up the database and photo folder together.
