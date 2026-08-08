/**
 * admin.js
 * Gère les fonctionnalités du panneau d'administration (`/admin`) :
 * - Gestion des onglets de navigation (.tab-btn / .tab-content)
 * - Validation et rejet des prestataires en attente
 * - Ajout et suppression de catégories de services
 * - Modération des utilisateurs et des publications
 */

import { afficherNotification } from "./utils.js";

// Gestion des onglets Admin
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

if (tabButtons.length > 0) {
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTabId = btn.dataset.tab;

      tabButtons.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      const targetContent = document.querySelector(`#${targetTabId}`);
      if (targetContent) {
        targetContent.classList.add("active");
      }
    });
  });
}

// Validation des prestataires
const tableValidationPrestataires = document.querySelector("#tableValidationPrestataires");
const cntEnAttente = document.querySelector("#cntEnAttente");

if (tableValidationPrestataires) {
  tableValidationPrestataires.addEventListener("click", (e) => {
    const btnValider = e.target.closest(".btn-valider-prestataire");
    const btnRejeter = e.target.closest(".btn-rejeter-prestataire");

    if (btnValider) {
      const row = btnValider.closest("tr");
      const nom = row.querySelector("td strong")?.textContent || "Le prestataire";
      row.remove();
      décrémenterAttente();
      afficherNotification(`${nom} a été validé avec succès.`, "success");
    }

    if (btnRejeter) {
      const row = btnRejeter.closest("tr");
      const nom = row.querySelector("td strong")?.textContent || "Le prestataire";
      row.remove();
      décrémenterAttente();
      afficherNotification(`La demande de ${nom} a été rejetée.`, "warning");
    }
  });
}

function décrémenterAttente() {
  if (cntEnAttente) {
    let current = parseInt(cntEnAttente.textContent, 10) || 0;
    if (current > 0) {
      cntEnAttente.textContent = current - 1;
    }
  }
}

// Ajout et suppression de catégories
const btnAddCategory = document.querySelector("#btnAddCategory");
const newCategoryInput = document.querySelector("#newCategoryInput");
const tableCategories = document.querySelector("#tableCategories");

if (btnAddCategory && newCategoryInput && tableCategories) {
  btnAddCategory.addEventListener("click", () => {
    const nomCat = newCategoryInput.value.trim();
    if (!nomCat) {
      afficherNotification("Veuillez saisir un nom de catégorie.", "warning");
      return;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${nomCat}</td>
      <td>0</td>
      <td><button class="btn-danger btn-delete-cat">Supprimer</button></td>
    `;
    tableCategories.appendChild(tr);
    newCategoryInput.value = "";
    afficherNotification(`Catégorie "${nomCat}" ajoutée avec succès.`, "success");
  });

  tableCategories.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-delete-cat")) {
      const row = e.target.closest("tr");
      const catName = row.querySelector("td")?.textContent;
      if (confirm(`Voulez-vous vraiment supprimer la catégorie "${catName}" ?`)) {
        row.remove();
        afficherNotification(`Catégorie "${catName}" supprimée.`, "warning");
      }
    }
  });
}

// Suppression / Modération d'utilisateurs et de publications
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("btn-supprimer-user")) {
    const row = e.target.closest("tr");
    const userName = row.querySelector("td")?.textContent;
    if (confirm(`Voulez-vous suspendre l'utilisateur "${userName}" ?`)) {
      row.style.opacity = "0.4";
      e.target.disabled = true;
      e.target.textContent = "Suspendu";
      afficherNotification(`Utilisateur ${userName} suspendu.`, "warning");
    }
  }

  if (e.target.classList.contains("btn-delete-pub")) {
    const row = e.target.closest("tr");
    if (confirm("Voulez-vous supprimer cette publication ?")) {
      row.remove();
      afficherNotification("Publication supprimée avec succès.", "success");
    }
  }
});
