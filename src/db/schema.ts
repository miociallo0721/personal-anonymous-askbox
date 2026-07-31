import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const questionStatuses = ["unread", "read", "replied", "ignored", "spam"] as const;
export type QuestionStatus = (typeof questionStatuses)[number];

export const questions = sqliteTable(
  "questions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    content: text("content").notNull(),
    status: text("status", { enum: questionStatuses }).notNull().default("unread"),
    ipHash: text("ip_hash").notNull(),
    userAgentHash: text("user_agent_hash").notNull(),
    spamScore: integer("spam_score").notNull().default(0),
    isBlocked: integer("is_blocked", { mode: "boolean" }).notNull().default(false),
    telegramNotified: integer("telegram_notified", { mode: "boolean" }).notNull().default(false),
    telegramMessageId: integer("telegram_message_id"),
    telegramError: text("telegram_error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    repliedAt: integer("replied_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("questions_created_at_idx").on(table.createdAt),
    index("questions_status_idx").on(table.status),
    index("questions_ip_hash_idx").on(table.ipHash),
    index("questions_telegram_notified_idx").on(table.telegramNotified),
  ],
);

export const blockedSources = sqliteTable(
  "blocked_sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ipHash: text("ip_hash").notNull(),
    reason: text("reason").notNull().default("管理员封禁"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("blocked_sources_ip_hash_unique").on(table.ipHash)],
);

export const adminSessions = sqliteTable(
  "admin_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tokenHash: text("token_hash").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("admin_sessions_token_hash_unique").on(table.tokenHash),
    index("admin_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const adminLoginAttempts = sqliteTable(
  "admin_login_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ipHash: text("ip_hash").notNull(),
    succeeded: integer("succeeded", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("admin_login_attempts_ip_created_idx").on(table.ipHash, table.createdAt)],
);

export const answers = sqliteTable(
  "answers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("answers_question_id_unique").on(table.questionId)],
);

export const cardAspects = ["1:1", "4:5", "9:16"] as const;
export type CardAspect = (typeof cardAspects)[number];

export const cards = sqliteTable(
  "cards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    answerId: integer("answer_id")
      .notNull()
      .references(() => answers.id, { onDelete: "cascade" }),
    aspect: text("aspect", { enum: cardAspects }).notNull(),
    theme: text("theme").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    contentHash: text("content_hash").notNull(),
    rendererVersion: text("renderer_version").notNull(),
    pageNumber: integer("page_number").notNull().default(1),
    pageCount: integer("page_count").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("cards_answer_id_idx").on(table.answerId),
    index("cards_created_at_idx").on(table.createdAt),
    index("cards_content_hash_idx").on(table.contentHash),
  ],
);

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type Answer = typeof answers.$inferSelect;
export type NewAnswer = typeof answers.$inferInsert;
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
