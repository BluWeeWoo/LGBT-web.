import { sqliteTable, text, index, integer } from "drizzle-orm/sqlite-core";

export type StoryMedia = {
  album: string;
  descriptions: string[];
  usePhotoAsPortrait: boolean;
  hasPortraitPrint?: boolean;
};

export const stories = sqliteTable(
  "stories",
  {
    id: text("id").primaryKey(),
    author: text("author").notNull(),
    name: text("name").notNull(),
    place: text("place").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    flag: text("flag").notNull(),
    topic: text("topic").notNull(),
    createdAt: text("created_at").notNull(),
    media: text("media", { mode: "json" }).$type<StoryMedia>(),
    removing: integer("removing", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [index("stories_by_date").on(table.createdAt)],
);
