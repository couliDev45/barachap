/**
 * prestataires.js
 * Gère la page de recherche avancée de prestataires (prestataires.html) :
 * - chargement des vrais prestataires (GET /api/users/prestataires)
 * - recherche par mot-clé + filtres Catégorie / Ville / Quartier
 *
 * Le filtrage se fait côté client après un chargement unique : plus simple
 * et plus fiable qu'un filtrage serveur par correspondance textuelle,
 * surtout pour la catégorie "Taxi-moto / Chauffeur" qui doit correspondre
 * à deux métiers différents en base (Taxi-moto ET Chauffeur).
 *
 * Note : pas de photo ni de note affichées — pas d'upload de photo ni de
 * système d'avis côté backend pour l'instant.
 */

import { requeteAPI } from "./api.js";

const searchInput = document.querySelector("#searchQuery");
const filterCategory = document.querySelector("#filterCategory");
const filterVille = document.querySelector("#filterVille");
const filterQuartier = document.querySelector("#filterQuartier");
const cardsContainer = document.querySelector("#prestatairesList");

let prestatairesData = [];

function echapperHTML(texte) {
  const div = document.createElement("div");
  div.textContent = texte ?? "";
  return div.innerHTML;
}

// Normalise pour comparaison : minuscules, sans accents (ex: "Séguéla" -> "seguela")
function normaliser(texte) {
  return (texte || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function construireCarte(prestataire) {
  const categorie = normaliser(prestataire.metier);
  const ville = normaliser(prestataire.ville);
  const quartier = normaliser(prestataire.quartier);
  const villeAffichee = [prestataire.ville, prestataire.quartier].filter(Boolean).join(" - ");

  return `
    <div class="advantage-card" data-category="${categorie}" data-ville="${ville}" data-quartier="${quartier}">
      <h3>${echapperHTML(prestataire.nom_complet)}</h3>
      <p class="metier">${echapperHTML(prestataire.metier)}</p>
      <span>${echapperHTML(villeAffichee)}</span>
      <a href="profil.html?id=${prestataire.id}" class="btn-primary" style="display: inline-block; width: 100%; text-decoration: none;">Voir profil</a>
    </div>
  `;
}

function correspondCategorie(card, filtre) {
  if (filtre === "all") return true;
  const categorie = card.dataset.category;
  // Cas particulier : l'option "taxi-moto" du filtre couvre deux métiers
  if (filtre === "taxi-moto") {
    return categorie === "taxi-moto" || categorie === "chauffeur";
  }
  return categorie === filtre;
}

function appliquerFiltres() {
  const recherche = normaliser(searchInput?.value.trim());
  const categorie = filterCategory?.value || "all";
  const ville = filterVille?.value || "all";
  const quartier = filterQuartier?.value || "all";

  document.querySelectorAll(".advantage-card").forEach((card) => {
    const metierTexte = normaliser(card.querySelector(".metier")?.textContent);

    const matchRecherche = !recherche || metierTexte.includes(recherche);
    const matchCategorie = correspondCategorie(card, categorie);
    const matchVille = ville === "all" || card.dataset.ville === ville;
    const matchQuartier = quartier === "all" || card.dataset.quartier === quartier;

    card.style.display =
      matchRecherche && matchCategorie && matchVille && matchQuartier ? "block" : "none";
  });
}

[searchInput, filterCategory, filterVille, filterQuartier].forEach((el) => {
  if (!el) return;
  el.addEventListener(el.tagName === "SELECT" ? "change" : "input", appliquerFiltres);
});

async function chargerPrestataires() {
  const reponse = await requeteAPI("/users/prestataires");
  prestatairesData = reponse?.prestataires || [];

  if (cardsContainer) {
    cardsContainer.innerHTML = prestatairesData.length
      ? prestatairesData.map(construireCarte).join("")
      : `<p>Aucun prestataire disponible pour le moment.</p>`;
  }
}

if (cardsContainer) {
  chargerPrestataires();
}
