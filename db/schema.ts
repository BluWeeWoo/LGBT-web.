import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

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
  },
  (table) => [index("stories_by_date").on(table.createdAt)],
);
