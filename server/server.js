/**
 * server.js
 * Serveur API REST Express pour la plateforme BaraChap.
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import demandesRoutes from "./routes/demandes.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import servicesRoutes from "./routes/services.routes.js";
import realisationsRoutes from "./routes/realisations.routes.js";
import avisRoutes from "./routes/avis.routes.js";
import parametresRoutes from "./routes/parametres.routes.js";
import coursesRoutes from "./routes/courses.routes.js";
import pushRoutes from "./routes/push.routes.js";
import telegramRoutes from "./routes/telegram.routes.js";
import clientErrorsRoutes from "./routes/client-errors.routes.js";
import { signalerErreurServeur } from "./utils/telegram.js";

dotenv.config();

process.removeAllListeners("warning");
process.on("warning", (warning) => {
  console.warn(
    `⚠️ Avertissement Node.js (${warning.name}) : ${warning.message}`,
  );
});

const consoleErrorOriginal = console.error.bind(console);
console.error = (...args) => {
  consoleErrorOriginal(...args);
  const details = args
    .map((a) =>
      a instanceof Error
        ? a.stack || a.message
        : typeof a === "object"
          ? JSON.stringify(a)
          : String(a),
    )
    .join(" ");
  signalerErreurServeur(details).catch(() => {});
};

process.on("unhandledRejection", (raison) => {
  console.error("Promesse rejetée non gérée :", raison);
});

process.on("uncaughtException", async (erreur) => {
  console.error("Exception non interceptée — arrêt du serveur :", erreur);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  process.exit(1);
});

const app = express();
const PORT = process.env.PORT || 5000;

app.set("trust proxy", 1);

const originesAutorisees = (
  process.env.FRONTEND_URL ||
  "https://barachap.vercel.app,https://barachap.com,https://www.barachap.com"
)
  .split(",")
  .map((origine) => origine.trim())
  .filter(Boolean);

const limiteurAPI = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Trop de requêtes. Veuillez réessayer plus tard." },
});

const limiteurAuthentification = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    message: "Trop de tentatives. Veuillez réessayer dans 15 minutes.",
  },
});

const limiteurErreursClient = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Trop de signalements. Veuillez réessayer plus tard." },
});

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// --- FIX CORS PRINCIPAL ---
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const estAutorise =
        originesAutorisees.includes(origin) || origin.endsWith(".vercel.app");
      if (estAutorise) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));
app.use("/api", limiteurAPI);

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    service: "BaraChap API Backend",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", limiteurAuthentification, authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/demandes", demandesRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/realisations", realisationsRoutes);
app.use("/api/avis", avisRoutes);
app.use("/api/parametres", parametresRoutes);
app.use("/api/courses", coursesRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api/erreurs-client", limiteurErreursClient, clientErrorsRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route API introuvable." });
});

app.use((err, req, res, next) => {
  console.error("Erreur Express non gérée :", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: "Erreur serveur inattendue." });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Serveur API BaraChap démarré avec succès !`);
  console.log(` Port: http://localhost:${PORT}`);
  console.log(` Healthcheck: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});
