import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import {
  ListCollaboratorsResponse, CreateCollaboratorBody, CreateCollaboratorResponse,
  UpdateCollaboratorParams, UpdateCollaboratorBody, UpdateCollaboratorResponse,
  DeleteCollaboratorParams,
} from "@workspace/api-zod";
import { syncCollaboratorRename } from "../lib/google-sheets-sync";

const router: IRouter = Router();
const totals = `SELECT c.id, c.name, count(s.id)::int AS "scanCount",
  coalesce(sum(s.quantity),0)::float8 AS "totalQuantity"
  FROM collaborators c LEFT JOIN scans s ON s.collaborator_id=c.id`;

router.get("/collaborators", async (_req, res): Promise<void> => {
  const { rows } = await pool.query(`${totals} GROUP BY c.id ORDER BY c.id`);
  res.json(ListCollaboratorsResponse.parse(rows));
});

router.post("/collaborators", async (req, res): Promise<void> => {
  const parsed = CreateCollaboratorBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.name.trim()) {
    res.status(400).json({ error: "Informe um nome válido com até 120 caracteres." });
    return;
  }
  const { rows: [row] } = await pool.query(
    "INSERT INTO collaborators (name) VALUES ($1) RETURNING id,name", [parsed.data.name.trim()]);
  res.status(201).json(CreateCollaboratorResponse.parse({ ...row, scanCount: 0, totalQuantity: 0 }));
});

router.put("/collaborators/:id", async (req, res): Promise<void> => {
  const params = UpdateCollaboratorParams.safeParse(req.params);
  const body = UpdateCollaboratorBody.safeParse(req.body);
  if (!params.success || !body.success || !body.data.name.trim()) {
    res.status(400).json({ error: "Nome ou colaborador inválido." });
    return;
  }
  const newName = body.data.name.trim();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [collaborator] } = await client.query(
      "SELECT name FROM collaborators WHERE id=$1 FOR UPDATE",
      [params.data.id],
    );
    if (!collaborator) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Colaborador não encontrado." });
      return;
    }
    const { rows: [scanCount] } = await client.query(
      "SELECT count(*)::int AS total FROM scans WHERE collaborator_id=$1",
      [params.data.id],
    );
    await client.query(
      "UPDATE collaborators SET name=$1 WHERE id=$2",
      [newName, params.data.id],
    );
    if (collaborator.name !== newName && scanCount.total > 0) {
      await syncCollaboratorRename(params.data.id, newName);
    }
    const { rows: [row] } = await client.query(
      `${totals} WHERE c.id=$1 GROUP BY c.id`,
      [params.data.id],
    );
    await client.query("COMMIT");
    res.json(UpdateCollaboratorResponse.parse(row));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.delete("/collaborators/:id", async (req, res): Promise<void> => {
  const params = DeleteCollaboratorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Colaborador inválido." });
    return;
  }
  const { rowCount } = await pool.query("DELETE FROM collaborators WHERE id=$1", [params.data.id]);
  if (!rowCount) {
    res.status(404).json({ error: "Colaborador não encontrado." });
    return;
  }
  res.status(204).end();
});

export default router;
