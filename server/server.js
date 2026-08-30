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

/**
 * CORS — autorise plusieurs origines plutôt qu'une seule chaîne exacte.
 * Auparavant, seule FRONTEND_URL (la prod) était acceptée : toute requête
 * venant d'une URL de preview Vercel (créée automatiquement à chaque push
 * sur une branche, ex. barachap-git-<branche>-<compte>.vercel.app) était
 * bloquée par le navigateur avant même d'atteindre cette route, empêchant
 * de tester quoi que ce soit en pré-production.
 *
 * Autorisé désormais :
 * - FRONTEND_URL exact (la prod, inchangé)
 * - Tout sous-domaine *.vercel.app commençant par "barachap" (couvre la
 *   prod ET toutes les previews générées pour ce projet, quelle que soit
 *   la branche ou le compte Vercel)
 * - localhost sur n'importe quel port (serveur de dev Vite en local)
 * - Requêtes sans en-tête Origin (Postman, curl, apps mobiles/Capacitor)
 */
const FRONTEND_URL = process.env.FRONTEND_URL || "";
const ORIGINES_AUTORISEES_REGEX = [
  /^https:\/\/barachap[a-z0-9-]*\.vercel\.app$/,
  /^http:\/\/localhost:\d+$/,
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origin === FRONTEND_URL) return callback(null, true);
      if (ORIGINES_AUTORISEES_REGEX.some((regex) => regex.test(origin))) {
        return callback(null, true);
      }
      callback(new Error(`Origine non autorisée par CORS : ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

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
app.use("/api/courses", coursesRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api/erreurs-client", clientErrorsRoutes);

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
