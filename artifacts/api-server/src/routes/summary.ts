import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { GetSummaryResponse, ListProductsResponse } from "@workspace/api-zod";

const router: IRouter = Router();
router.get("/summary", async (_req, res): Promise<void> => {
  const { rows: [row] } = await pool.query(`SELECT count(*)::int AS "totalScans",
    coalesce(sum(quantity),0)::float8 AS "totalQuantity",
    count(DISTINCT product_id)::int AS "uniqueProducts",
    (SELECT count(*)::int FROM collaborators) AS collaborators,
    count(*) FILTER (WHERE (scanned_at AT TIME ZONE 'America/Sao_Paulo')::date =
      (now() AT TIME ZONE 'America/Sao_Paulo')::date)::int AS "todayScans",
    coalesce(sum(quantity) FILTER (WHERE (scanned_at AT TIME ZONE 'America/Sao_Paulo')::date =
      (now() AT TIME ZONE 'America/Sao_Paulo')::date),0)::float8 AS "todayQuantity"
    FROM scans`);
  res.json(GetSummaryResponse.parse(row));
});
router.get("/products", async (_req, res): Promise<void> => {
  const { rows } = await pool.query(`SELECT product_id AS "productId",count(*)::int AS "scanCount",
    sum(quantity)::float8 AS "totalQuantity",count(DISTINCT collaborator_id)::int AS "collaboratorCount",
    max(scanned_at) AS "lastScannedAt" FROM scans GROUP BY product_id ORDER BY max(scanned_at) DESC,product_id`);
  res.json(ListProductsResponse.parse(rows));
});
export default router;
