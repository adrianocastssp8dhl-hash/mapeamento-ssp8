import { pgTable, serial, text, integer, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { collaboratorsTable } from "./collaborators";

export const scansTable = pgTable("scans", {
  id: serial("id").primaryKey(),
  collaboratorId: integer("collaborator_id").notNull().references(() => collaboratorsTable.id, { onDelete: "restrict" }),
  productId: text("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("scans_collaborator_idx").on(t.collaboratorId),
  index("scans_scanned_at_idx").on(t.scannedAt),
  index("scans_product_idx").on(t.productId),
  check("scans_positive_quantity", sql`${t.quantity} between 1 and 1000000`),
]);
export const insertScanSchema = createInsertSchema(scansTable).omit({ id: true });
export type InsertScan = z.infer<typeof insertScanSchema>;
export type Scan = typeof scansTable.$inferSelect;
