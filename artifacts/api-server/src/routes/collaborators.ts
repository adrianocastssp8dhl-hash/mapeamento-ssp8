import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import {
  ListCollaboratorsResponse, CreateCollaboratorBody, CreateCollaboratorResponse,
  UpdateCollaboratorParams, UpdateCollaboratorBody, UpdateCollaboratorResponse,
  DeleteCollaboratorParams,
} from "@workspace/api-zod";

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
  const { rowCount } = await pool.query(
    "UPDATE collaborators SET name=$1 WHERE id=$2", [body.data.name.trim(), params.data.id]);
  if (!rowCount) {
    res.status(404).json({ error: "Colaborador não encontrado." });
    return;
  }
  const { rows: [row] } = await pool.query(`${totals} WHERE c.id=$1 GROUP BY c.id`, [params.data.id]);
  res.json(UpdateCollaboratorResponse.parse(row));
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
