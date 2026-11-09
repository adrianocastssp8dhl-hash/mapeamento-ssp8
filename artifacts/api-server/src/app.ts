import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { GoogleSheetsSyncError } from "./lib/google-sheets-sync";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const code = err?.code ?? err?.cause?.code;
  if (code === "23505") {
    res.status(409).json({ error: "Já existe um colaborador com esse nome." });
    return;
  }
  if (code === "23503") {
    if (req.method === "DELETE") {
      res.status(409).json({ error: "Este colaborador possui bipagens. Reatribua ou exclua os registros antes de removê-lo." });
    } else {
      res.status(400).json({ error: "O colaborador selecionado não existe mais. Atualize a página e tente novamente." });
    }
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Dados JSON inválidos." });
    return;
  }
  if (err instanceof GoogleSheetsSyncError) {
    req.log.warn({ err }, "Google Sheets synchronization failed");
    res.status(503).json({ error: err.message });
    return;
  }
  req.log.error({ err }, "Request failed");
  res.status(500).json({ error: "Não foi possível concluir a operação. Tente novamente." });
};
app.use(errorHandler);

export default app;
