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

/**
 * Node.js affiche ses propres avertissements internes (dépréciations,
 * warnings expérimentaux...) via console.error par défaut — sans ce
 * correctif, ils étaient donc pris pour de vraies erreurs applicatives et
 * envoyaient une fausse alerte 🔴 sur Telegram (ex. l'avertissement SSL de
 * la librairie pg). On retire l'écouteur "warning" par défaut de Node et on
 * le remplace par le nôtre, qui utilise console.warn (jamais intercepté) :
 * l'avertissement reste visible dans les logs Render, mais ne déclenche
 * plus d'alerte. Les vraies erreurs applicatives, elles, continuent de
 * passer par console.error normalement, juste en dessous.
 */
process.removeAllListeners("warning");
process.on("warning", (warning) => {
  console.warn(`⚠️ Avertissement Node.js (${warning.name}) : ${warning.message}`);
});

/**
 * Alerte Telegram automatique sur les erreurs serveur.
 * On intercepte console.error une seule fois ici, au démarrage : toutes les
 * routes du projet appellent déjà console.error(...) dans leurs blocs
 * catch — cette interception les couvre TOUTES sans avoir à modifier
 * chaque fichier de route individuellement. L'appel console.error d'origine
 * continue de s'exécuter normalement (logs Render inchangés), on ajoute
 * juste l'envoi Telegram en plus. Anti-spam intégré dans signalerErreurServeur.
 *
 * Les erreurs passées via logger.error (Winston — voir db.js et le
 * middleware d'authentification) sont couvertes séparément, directement
 * dans utils/logger.js — console.error seul ne les intercepte pas.
 *
 * Les erreurs côté navigateur (JS cassé chez un client/chauffeur) arrivent
 * par une route dédiée (voir routes/client-errors.routes.js) et utilisent
 * un canal Telegram séparé (signalerErreurClient) pour ne jamais masquer
 * une vraie panne serveur.
 */
const consoleErrorOriginal = console.error.bind(console);
console.error = (...args) => {
  consoleErrorOriginal(...args);

  const details = args
    .map((a) => (a instanceof Error ? a.stack || a.message : typeof a === "object" ? JSON.stringify(a) : String(a)))
    .join(" ");

  signalerErreurServeur(details).catch(() => {});
};

// Filet de sécurité pour les erreurs qui échapperaient aux blocs try/catch
// existants (promesse rejetée non gérée, exception non interceptée).
process.on("unhandledRejection", (raison) => {
  console.error("Promesse rejetée non gérée :", raison);
});

process.on("uncaughtException", async (erreur) => {
  console.error("Exception non interceptée — arrêt du serveur :", erreur);

  // Une exception non interceptée laisse le process dans un état dont on
  // ne peut plus garantir la fiabilité (état interne potentiellement
  // corrompu) — on l'arrête volontairement plutôt que de continuer à
  // servir des requêtes dans cet état. Render redémarre automatiquement
  // le service après un arrêt : c'est le comportement normal et voulu ici,
  // pas une panne à corriger manuellement.
  // Le court délai laisse le temps à l'alerte Telegram ci-dessus de partir
  // avant la coupure — process.exit() ne garantit pas qu'une requête
  // réseau en vol arrive à destination.
  await new Promise((resolve) => setTimeout(resolve, 2000));
  process.exit(1);
});

const app = express();
const PORT = process.env.PORT || 5000;
const originesAutorisees = (process.env.FRONTEND_URL || "https://barachap.vercel.app")
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
  message: { message: "Trop de tentatives. Veuillez réessayer dans 15 minutes." },
});

const limiteurErreursClient = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Trop de signalements. Veuillez réessayer plus tard." },
});

// Configuration des Middlewares
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || originesAutorisees.includes(origin)) return callback(null, true);
    // Sans en-tête CORS, le navigateur bloque l'accès à la réponse tout en
    // évitant de transformer une origine inconnue en erreur 500 serveur.
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));
app.use("/api", limiteurAPI);

// Endpoint de santé (Healthcheck)
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    service: "BaraChap API Backend",
    timestamp: new Date().toISOString(),
  });
});

// Enregistrement des routes API
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

// Gestion des routes inexistantes (404)
app.use((req, res) => {
  res.status(404).json({ message: "Route API introuvable." });
});

// Filet de sécurité final : capture toute erreur transmise via next(err)
// qui n'aurait pas été gérée localement dans une route.
app.use((err, req, res, next) => {
  console.error("Erreur Express non gérée :", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: "Erreur serveur inattendue." });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Serveur API BaraChap démarré avec succès !`);
  console.log(` Port: http://localhost:${PORT}`);
  console.log(` Healthcheck: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});
