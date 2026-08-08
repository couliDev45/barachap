/**
 * db.js
 * Configuration du pool de connexion PostgreSQL.
 * Gère la connexion avec la base de données distante ou locale avec gestion d'erreurs.
 */

import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === "production";

// Configuration de la connexion PostgreSQL avec prise en charge du SSL en production
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/barachap_db",
  ssl: isProduction || (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("sslmode=require"))
    ? { rejectUnauthorized: false }
    : false,
});

pool.on("connect", () => {
  console.log("Connecté avec succès à la base de données PostgreSQL BaraChap.");
});

pool.on("error", (err) => {
  console.error("Erreur inattendue sur la base de données PostgreSQL :", err);
});

/**
 * Exécute une requête SQL avec paramètres de manière sécurisée.
 * @param {string} text - Requête SQL avec placeholders $1, $2...
 * @param {Array} params - Tableau de paramètres
 */
export const query = (text, params) => pool.query(text, params);

export default pool;
