import { and, desc, eq, lt, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { stories } from "../../../db/schema";
import { excerpt, flagThemes, topics } from "../../../lib/voices";

export const dynamic = "force-dynamic";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

function visible(row: typeof stories.$inferSelect, user: string | null) {
  return {
    id: row.id,
    name: row.name,
    place: row.place,
    title: row.title,
    body: row.body,
    flag: row.flag,
    topic: row.topic,
    quote: excerpt(row.body),
    sample: false,
    mine: row.author === user,
  };
}

export async function GET(request: Request) {
  const user = request.headers.get("oai-authenticated-user-id");
  const params = new URL(request.url).searchParams;
  try {
    const db = getDb();
    if (params.has("id")) {
      const [row] = await db
        .select()
        .from(stories)
        .where(eq(stories.id, params.get("id")!))
        .limit(1);
      return row
        ? reply({ story: visible(row, user) })
        : reply({ error: "This story is no longer available." }, 404);
    }
    const cursor = params.get("cursor")?.split("|");
    if (cursor && (cursor.length !== 2 || !uuid.test(cursor[1])))
      return reply({ error: "Invalid page." }, 400);
    const after = cursor
      ? or(
          lt(stories.createdAt, cursor[0]),
          and(eq(stories.createdAt, cursor[0]), lt(stories.id, cursor[1])),
        )
      : undefined;
    const rows = await db
      .select()
      .from(stories)
      .where(after)
      .orderBy(desc(stories.createdAt), desc(stories.id))
      .limit(25);
    const page = rows.slice(0, 24);
    const last = page.at(-1);
    return reply({
      stories: page.map((row) => visible(row, user)),
      signedIn: Boolean(user),
      cursor:
        rows.length > page.length && last
          ? last.createdAt + "|" + last.id
          : null,
    });
  } catch {
    return reply(
      { error: "Community stories could not be loaded. Please try again." },
      503,
    );
  }
}

function writeAccess(request: Request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin)
    return { error: reply({ error: "Please use the form on RYE." }, 403) };
  const user = request.headers.get("oai-authenticated-user-id");
  if (!user)
    return {
      error: reply(
        { error: "Please sign in to share or manage your story." },
        401,
      ),
    };
  return { user };
}

export async function POST(request: Request) {
  const access = writeAccess(request);
  if (access.error) return access.error;
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply({ error: "Use the story form to publish." }, 415);
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: "Your story is missing." }, 400);
  let value;
  try {
    const decoder = new TextDecoder();
    let total = 0,
      raw = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > 36000) {
        await reader.cancel();
        return reply({ error: "Your story is too long." }, 413);
      }
      raw += decoder.decode(chunk.value, { stream: true });
    }
    value = JSON.parse(raw + decoder.decode());
  } catch {
    return reply({ error: "Your story could not be read." }, 400);
  }
  if (
    !value ||
    typeof value !== "object" ||
    value.consent !== true ||
    typeof value.id !== "string" ||
    !uuid.test(value.id)
  )
    return reply({ error: "Preview your story and confirm publication." }, 400);
  for (const [key, max] of [
    ["name", 55],
    ["place", 65],
    ["title", 100],
    ["body", 6000],
  ] as const) {
    if (typeof value[key] !== "string" || value[key].trim().length > max)
      return reply({ error: "Please check the story fields." }, 400);
    value[key] = value[key].trim();
  }
  if (
    !value.title ||
    value.body.length < 20 ||
    !Object.hasOwn(flagThemes, value.flag) ||
    !topics.includes(value.topic)
  )
    return reply(
      {
        error:
          "Add a title, a story of at least 20 characters, and a valid theme.",
      },
      400,
    );
  const db = getDb();
  try {
    await db
      .insert(stories)
      .values({
        id: value.id,
        author: access.user!,
        name: value.name || "Anonymous",
        place: value.place,
        title: value.title,
        body: value.body,
        flag: value.flag,
        topic: value.topic,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing();
    const [row] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, value.id));
    if (!row || row.author !== access.user)
      return reply({ error: "Please reopen the form to publish." }, 409);
    return reply({ story: visible(row, access.user!) }, 201);
  } catch {
    return reply(
      {
        error:
          "Your story could not be published. Your text is still here to retry.",
      },
      503,
    );
  }
}

export async function DELETE(request: Request) {
  const access = writeAccess(request);
  if (access.error) return access.error;
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!uuid.test(id))
    return reply({ error: "This story could not be found." }, 404);
  try {
    const removed = await getDb()
      .delete(stories)
      .where(and(eq(stories.id, id), eq(stories.author, access.user!)))
      .returning({ id: stories.id });
    return removed.length
      ? reply({ removed: true })
      : reply({ error: "This story could not be found." }, 404);
  } catch {
    return reply({ error: "Removal failed. Please try again." }, 503);
  }
}
