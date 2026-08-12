/**
 * services.js
 * Gère la page de recherche rapide de prestataires (services.html) :
 * - chargement des vrais prestataires (GET /api/users/prestataires)
 * - recherche par mot-clé (barre de recherche)
 * - filtrage par catégorie (boutons de filtre)
 *
 * Note : pas de photo ni de note affichées sur les cartes générées — il n'y
 * a ni upload de photo ni système d'avis côté backend pour l'instant. Les
 * cartes statiques de démonstration montraient des photos/notes fictives ;
 * mieux vaut ne rien afficher que d'inventer des données.
 */

import { requeteAPI } from "./api.js";

const searchInput = document.querySelector("input[type='search']");
const cardsContainer = document.querySelector("#prestatairesGrid");

function echapperHTML(texte) {
  const div = document.createElement("div");
  div.textContent = texte ?? "";
  return div.innerHTML;
}

function construireCarte(prestataire) {
  const categorie = (prestataire.metier || "").toLowerCase();
  const ville = [prestataire.ville, prestataire.quartier].filter(Boolean).join(" - ");

  return `
    <div class="advantage-card" data-category="${echapperHTML(categorie)}">
      <h3>${echapperHTML(prestataire.nom_complet)}</h3>
      <p class="metier">${echapperHTML(prestataire.metier)}</p>
      <span>${echapperHTML(ville)}</span>
      <a href="profil.html?id=${prestataire.id}" class="btn-primary"> Voir le profil </a>
    </div>
  `;
}

function attacherFiltreEtRecherche() {
  const cards = document.querySelectorAll(".advantage-card");

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      const recherche = searchInput.value.toLowerCase().trim();
      cards.forEach((card) => {
        const metierEl = card.querySelector(".metier");
        const metier = metierEl ? metierEl.textContent.toLowerCase() : "";
        card.style.display = metier.includes(recherche) ? "block" : "none";
      });
    });
  }

  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      cards.forEach((card) => {
        const category = card.dataset.category;
        card.style.display = filter === "all" || category === filter ? "block" : "none";
      });
    });
  });
}

async function chargerPrestataires() {
  const reponse = await requeteAPI("/users/prestataires");
  const prestataires = reponse?.prestataires || [];

  if (cardsContainer) {
    cardsContainer.innerHTML = prestataires.length
      ? prestataires.map(construireCarte).join("")
      : `<p>Aucun prestataire disponible pour le moment.</p>`;
  }

  attacherFiltreEtRecherche();
}

if (cardsContainer) {
  chargerPrestataires();
}
