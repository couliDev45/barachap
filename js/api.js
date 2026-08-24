/**
 * api.js
 * Client API Frontend pour BaraChap.
 * Fait la liaison entre le Frontend et l'API Backend REST Express/PostgreSQL.
 */
import { lireStockage, ecrireStockage } from "./utils.js";
import { signalerErreurClient } from "./erreurs-client.js";

// URL de base de l'API (toujours le backend Render, en local comme en production)
const API_BASE_URL = "https://barachap-web.onrender.com/api";

/**
 * Effectue une requête HTTP à l'API Backend.
 * Fallback automatique vers le localStorage si le serveur API n'est pas joignable.
 *
 * Signale sur Telegram (via signalerErreurClient) uniquement :
 * - les erreurs serveur (statut HTTP >= 500) — un bug backend, pas une
 *   erreur normale de l'utilisateur
 * - les pannes réseau pures (backend totalement injoignable — détecté via
 *   `error instanceof TypeError`, le type d'erreur que `fetch` lève
 *   spécifiquement quand la requête n'obtient aucune réponse HTTP)
 * Ne signale JAMAIS les erreurs 4xx (401 mauvais mot de passe, 400 champ
 * manquant, 403 non autorisé...) : ce sont des retours normaux de l'usage
 * du site, pas des anomalies à surveiller — les signaler noierait les
 * vraies pannes sous du bruit.
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

      if (response.status >= 500) {
        signalerErreurClient(
          `Erreur ${response.status} sur ${endpoint} : ${errorData.message || "sans détail"}`,
        );
      }

      throw new Error(errorData.message || `Erreur serveur ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    // `fetch` lève une TypeError (pas une Error classique) quand la requête
    // échoue avant même d'obtenir une réponse HTTP — DNS, CORS, serveur à
    // l'arrêt, coupure réseau... C'est ce cas-là qu'on distingue ici du 5xx
    // déjà signalé juste au-dessus (qui lève une Error normale).
    if (error instanceof TypeError) {
      signalerErreurClient(`Backend injoignable sur ${endpoint} : ${error.message}`);
    }

    console.warn(`API indisponible (${endpoint}), utilisation du mode secours localStorage:`, error.message);
    return null;
  }
}
