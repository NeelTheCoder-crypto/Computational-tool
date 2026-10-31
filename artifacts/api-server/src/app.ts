import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

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

// In production the built website is served from the same server, so the
// whole app runs as one service. STATIC_DIR points at the Vite build output.
const staticDir = process.env["STATIC_DIR"];
if (staticDir) {
  const root = path.resolve(staticDir);
  app.use(express.static(root, { index: false, maxAge: "1h" }));
  // Any other GET that isn't an API call gets index.html so client-side
  // routes like /browse and /carrier/12 work on reload.
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(root, "index.html"));
  });
}

export default app;
