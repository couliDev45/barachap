/**
 * api.js
 * Client API Frontend pour BaraChap.
 * Fait la liaison entre le Frontend et l'API Backend REST Express/PostgreSQL.
 */
import { lireStockage, ecrireStockage } from "./utils.js";

// URL de base de l'API (toujours le backend Render, en local comme en production)
const API_BASE_URL = "https://barachap-web.onrender.com/api";

/**
 * Effectue une requête HTTP à l'API Backend.
 * Fallback automatique vers le localStorage si le serveur API n'est pas joignable.
 */
export async function requeteAPI(endpoint, options = {}) {
  const token = lireStockage("jwt_token", null);
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erreur serveur ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn(`API indisponible (${endpoint}), utilisation du mode secours localStorage:`, error.message);
    return null;
  }
}
