import type { stories, StoryMedia } from "../db/schema";
import { excerpt, type Flag, type Topic, type Voice } from "./voices";

export const storyIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AtlasRecord = Pick<typeof stories.$inferSelect,
  "id" | "author" | "name" | "place" | "title" | "body" | "flag" | "topic" | "status" | "createdAt" | "reviewedAt"
> & { media: Omit<StoryMedia, "album"> | null };

export function storyVoice(row: AtlasRecord, user: string | null): Voice {
  return {
    id: row.id, name: row.name, place: row.place, title: row.title, body: row.body,
    flag: row.flag as Flag, topic: row.topic as Topic, quote: excerpt(row.body),
    sample: false, mine: row.author === user,
    photos: row.media?.descriptions.map((description, index) => ({
      src: `/api/stories/photo?id=${row.id}&index=${index}`, description,
      portraitSrc: index === 0 && row.media?.usePhotoAsPortrait && row.media.hasPortraitPrint
        ? `/api/stories/photo?id=${row.id}&index=portrait` : undefined,
    })),
    usePhotoAsPortrait: row.media?.usePhotoAsPortrait ?? false,
  };
}
