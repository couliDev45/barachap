/**
 * server.js
 * Serveur API REST Express pour la plateforme BaraChap.
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import demandesRoutes from "./routes/demandes.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import servicesRoutes from "./routes/services.routes.js";
import realisationsRoutes from "./routes/realisations.routes.js";
import avisRoutes from "./routes/avis.routes.js";
import parametresRoutes from "./routes/parametres.routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration des Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint de santé (Healthcheck)
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    service: "BaraChap API Backend",
    timestamp: new Date().toISOString(),
  });
});

// Enregistrement des routes API
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/demandes", demandesRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/realisations", realisationsRoutes);
app.use("/api/avis", avisRoutes);
app.use("/api/parametres", parametresRoutes);

// Gestion des routes inexistantes (404)
app.use((req, res) => {
  res.status(404).json({ message: "Route API introuvable." });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Serveur API BaraChap démarré avec succès !`);
  console.log(` Port: http://localhost:${PORT}`);
  console.log(` Healthcheck: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});
