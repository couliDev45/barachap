/**
 * services.js
 * Gère la page de recherche de prestataires :
 * - recherche par mot-clé (barre de recherche)
 * - filtrage par catégorie (boutons de filtre)
 */

const searchInput = document.querySelector("input[type='search']");
const cards = document.querySelectorAll(".advantage-card");

// Vérifie que la barre de recherche existe
if (searchInput) {
  searchInput.addEventListener("input", function () {
    // Texte saisi par l'utilisateur
    const recherche = searchInput.value.toLowerCase().trim();

    // Parcourt toutes les cartes
    cards.forEach(function (card) {
      // Récupère le métier
      const metier = card.querySelector(".metier").textContent.toLowerCase();

      // Affiche ou cache la carte
      if (metier.includes(recherche)) {
        card.style.display = "block";
      } else {
        card.style.display = "none";
      }
    });
  });
}

// sélection de tous les boutons de filtre
const filterButtons = document.querySelectorAll(".filter-btn");
// écouter le clic sur chaque bouton
filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    cards.forEach((card) => {
      const category = card.dataset.category;
      if (filter === "all" || category === filter) {
        card.style.display = "block";
      } else {
        card.style.display = "none";
      }
    });
  });
});
