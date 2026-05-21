import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// CAP messages composed or parsed by users
export const capMessages = mysqlTable("cap_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // "composed" = built via form, "parsed" = pasted XML
  type: mysqlEnum("type", ["composed", "parsed"]).notNull(),
  identifier: varchar("identifier", { length: 255 }),
  sender: varchar("sender", { length: 255 }),
  // CAP status: Actual, Exercise, System, Test, Draft
  status: varchar("status", { length: 32 }),
  // Severity from first info block
  severity: varchar("severity", { length: 32 }),
  // Msgtype: Alert, Update, Cancel, Ack, Error
  msgType: varchar("msgType", { length: 32 }),
  // Full CAP v1.2 XML
  xml: text("xml").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CapMessage = typeof capMessages.$inferSelect;
export type InsertCapMessage = typeof capMessages.$inferInsert;
