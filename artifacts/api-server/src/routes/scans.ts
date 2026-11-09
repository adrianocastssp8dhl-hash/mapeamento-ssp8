import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import {
  ListScansQueryParams, ListScansResponse, CreateScanBody, CreateScanResponse,
  GetScanParams, GetScanResponse, UpdateScanParams, UpdateScanBody, UpdateScanResponse,
  DeleteScanParams,
} from "@workspace/api-zod";
import {
  syncCreateScan,
  syncDeleteScan,
  syncUpdateScan,
} from "../lib/google-sheets-sync";

const router: IRouter = Router();
const projection = `SELECT s.id, s.collaborator_id AS "collaboratorId", c.name AS "collaboratorName",
  s.product_id AS "productId", s.quantity, s.scanned_at AS "scannedAt"
  FROM scans s JOIN collaborators c ON c.id=s.collaborator_id`;

router.get("/scans", async (req, res): Promise<void> => {
  // Preserve calendar days in Sao Paulo; generated schemas expect Date objects.
  const query: Record<string, unknown> = { ...req.query };
  for (const key of ["dateFrom", "dateTo"]) {
    if (query[key] !== undefined) {
      const raw = query[key];
      if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        res.status(400).json({ error: "Use datas no formato AAAA-MM-DD." });
        return;
      }
      const date = new Date(raw + "T00:00:00Z");
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
        res.status(400).json({ error: "Data inválida." });
        return;
      }
      query[key] = date;
    }
  }
  const parsed = ListScansQueryParams.safeParse(query);
  if (!parsed.success) {
    res.status(400).json({ error: "Filtros inválidos." });
    return;
  }
  const { q, collaboratorId, dateFrom, dateTo, page, limit } = parsed.data;
  if (dateFrom && dateTo && dateFrom > dateTo) {
    res.status(400).json({ error: "A data inicial deve ser anterior à data final." });
    return;
  }
  const conditions: string[] = [];
  const values: (number | string)[] = [];
  const add = (condition: string, value: string | number) => {
    values.push(value);
    conditions.push(condition.replace("?", `$${values.length}`));
  };
  if (q?.trim()) {
    const escaped = q.trim().replace(/[\\%_]/g, "\\$&");
    values.push(`%${escaped}%`);
    conditions.push(`(s.product_id ILIKE $${values.length} OR c.name ILIKE $${values.length})`);
  }
  if (collaboratorId) add("s.collaborator_id = ?", collaboratorId);
  if (dateFrom) add("s.scanned_at >= (?::date::timestamp AT TIME ZONE 'America/Sao_Paulo')", dateFrom.toISOString().slice(0, 10));
  if (dateTo) add("s.scanned_at < ((?::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')", dateTo.toISOString().slice(0, 10));
  const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
  const [{ rows: [total] }, { rows }] = await Promise.all([
    pool.query(`SELECT count(*)::int AS total FROM scans s JOIN collaborators c ON c.id=s.collaborator_id${where}`, values),
    pool.query(`${projection}${where} ORDER BY s.scanned_at DESC,s.id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, (page - 1) * limit]),
  ]);
  res.json(ListScansResponse.parse({ items: rows, total: total.total, page, limit }));
});

router.post("/scans", async (req, res): Promise<void> => {
  const parsed = CreateScanBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.productId.trim()) {
    res.status(400).json({ error: "Informe colaborador, ID do produto, quantidade positiva e horário válido." });
    return;
  }
  const body = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(19374022)");
    const { rows: [row] } = await client.query(
      `INSERT INTO scans (collaborator_id,product_id,quantity,scanned_at)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [body.collaboratorId, body.productId.trim(), body.quantity, body.scannedAt],
    );
    const { rows: [scan] } = await client.query(`${projection} WHERE s.id=$1`, [row.id]);
    await syncCreateScan(scan);
    await client.query("COMMIT");
    res.status(201).json(CreateScanResponse.parse(scan));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.get("/scans/:id", async (req, res): Promise<void> => {
  const params = GetScanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Registro inválido." });
    return;
  }
  const { rows: [row] } = await pool.query(`${projection} WHERE s.id=$1`, [params.data.id]);
  if (!row) {
    res.status(404).json({ error: "Bipagem não encontrada." });
    return;
  }
  res.json(GetScanResponse.parse(row));
});

router.put("/scans/:id", async (req, res): Promise<void> => {
  const params = UpdateScanParams.safeParse(req.params);
  const parsed = UpdateScanBody.safeParse(req.body);
  if (!params.success || !parsed.success || !parsed.data.productId.trim()) {
    res.status(400).json({ error: "Dados inválidos. Verifique produto, quantidade e horário." });
    return;
  }
  const body = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      `UPDATE scans SET collaborator_id=$1,product_id=$2,quantity=$3,scanned_at=$4 WHERE id=$5`,
      [body.collaboratorId, body.productId.trim(), body.quantity, body.scannedAt, params.data.id],
    );
    if (!rowCount) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Bipagem não encontrada." });
      return;
    }
    const { rows: [row] } = await client.query(`${projection} WHERE s.id=$1`, [params.data.id]);
    await syncUpdateScan(row);
    await client.query("COMMIT");
    res.json(UpdateScanResponse.parse(row));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.delete("/scans/:id", async (req, res): Promise<void> => {
  const params = DeleteScanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Registro inválido." });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [scan] } = await client.query(
      "SELECT id FROM scans WHERE id=$1 FOR UPDATE",
      [params.data.id],
    );
    if (!scan) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Bipagem não encontrada." });
      return;
    }
    await syncDeleteScan(scan.id);
    await client.query("DELETE FROM scans WHERE id=$1", [params.data.id]);
    await client.query("COMMIT");
    res.status(204).end();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export default router;
