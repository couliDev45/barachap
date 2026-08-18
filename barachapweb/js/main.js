/**
 * main.js
 * Point d'entrée du site : charge les scripts nécessaires via les modules ES.
 * Chaque script gère lui-même la détection de présence de ses éléments dans le DOM,
 * donc l'importer sur une page qui ne les utilise pas ne pose aucun problème.
 *
 * ⚠️ Nécessite d'ajouter type="module" sur la balise <script> qui charge ce fichier,
 * et d'ajouter `export` devant les fonctions de utils.js qui doivent être partagées.
 */

import "./api.js";
import "./menu.js";
import "./utils.js";
import "./services.js";
import "./prestataires.js";
import "./profil.js";
import "./demande.js";
import "./dashboard.js";
import "./auth.js";
import "./prestataire.js";
import "./admin.js";
import "./hero.js";
import "./taxi-moto.js";
import "./accueil.js";
