import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { stories } from "../../../../db/schema";
import { photoKey } from "../../../../lib/story-photo-storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id") || "";
  const slot = params.get("index") || "";
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const missing = () => new Response(null, { status: 404, headers });
  if (!id || (slot !== "portrait" && !/^\d+$/.test(slot))) return missing();
  try {
    const [row] = await getDb().select({ media: stories.media }).from(stories)
      .where(and(eq(stories.id, id), eq(stories.removing, false)));
    if (!row?.media) return missing();
    const index = slot === "portrait" ? "portrait" : Number(slot);
    if (index === "portrait" ? !row.media.usePhotoAsPortrait || !row.media.hasPortraitPrint : index >= row.media.descriptions.length)
      return missing();
    if (!env.BUCKET) throw Error("Photo storage is unavailable.");
    const photo = await env.BUCKET.get(photoKey(id, row.media, index));
    return photo
      ? new Response(photo.body, { headers: { ...headers, "Content-Type": "image/jpeg" } })
      : missing();
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
