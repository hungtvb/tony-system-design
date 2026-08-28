import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/**
 * Auth.js (NextAuth v5) tables — required by @auth/drizzle-adapter.
 * Mirror the canonical adapter schema; keep field names stable.
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  // app-specific
  passwordHash: varchar("password_hash", { length: 255 }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => [
    {
      compoundKey: index("account_compound_key").on(
        account.provider,
        account.providerAccountId,
      ),
    },
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: varchar("sessionToken", { length: 255 }).primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [
    {
      compoundKey: index("verification_token_compound_key").on(
        vt.identifier,
        vt.token,
      ),
    },
  ],
);

/** Status of a saved design. */
export const designStatusEnum = pgEnum("design_status", [
  "draft",
  "published",
]);

/**
 * A saved system-design canvas.
 *
 * canvasData holds the portable graph model:
 *   { nodes: CanvasNode[], edges: CanvasEdge[], meta: {...} }
 * See src/lib/types.ts for the schema. Stored as jsonb so it round-trips
 * without a migration every time we add a block property.
 */
export const designs = pgTable(
  "designs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    status: designStatusEnum("status").notNull().default("draft"),
    canvasData: jsonb("canvas_data").notNull(),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (design) => [
    index("design_user_idx").on(design.userId),
    index("design_public_idx").on(design.isPublic),
  ],
);

/** Persisted results of a validation / simulation / quiz run. */
export const testRuns = pgTable(
  "test_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    designId: uuid("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 32 }).notNull(), // validation | simulation | quiz
    result: jsonb("result").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (run) => [index("testrun_design_idx").on(run.designId)],
);

/** Seed quiz problems (system-design interview classics). */
export const quizProblems = pgTable(
  "quiz_problems",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    prompt: text("prompt").notNull(),
    requirements: jsonb("requirements").notNull(), // rubric
    scaleTarget: jsonb("scale_target"), // {rps, dataSize, ...}
    difficulty: varchar("difficulty", { length: 16 }).notNull().default("medium"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (q) => [index("quiz_slug_idx").on(q.slug)],
);

export type User = typeof users.$inferSelect;
export type Design = typeof designs.$inferSelect;
export type TestRun = typeof testRuns.$inferSelect;
export type QuizProblem = typeof quizProblems.$inferSelect;
