import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const collaboratorsTable = pgTable("collaborators", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});
export const insertCollaboratorSchema = createInsertSchema(collaboratorsTable).omit({ id: true });
export type InsertCollaborator = z.infer<typeof insertCollaboratorSchema>;
export type Collaborator = typeof collaboratorsTable.$inferSelect;
