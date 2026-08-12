/**
 * admin.js
 * Gère les fonctionnalités du panneau d'administration (`/admin`) :
 * - Gestion des onglets de navigation (.tab-btn / .tab-content) — pure UI
 * - Statistiques globales (GET /api/admin/stats)
 * - Validation et rejet des prestataires en attente (GET pending, PUT validate/:id)
 * - Liste globale des utilisateurs + suspension (GET users, PUT users/:id/suspend)
 * - Gestion des catégories (GET/POST/DELETE /api/admin/categories)
 * Dépend de utils.js (afficherNotification) et api.js (requeteAPI).
 *
 * ⚠️ La modération des publications (onglet 4) n'a pas de route backend
 * (aucune table "avis"/publications à modérer n'existe côté serveur) :
 * cet onglet reste visuel/local pour l'instant.
 */

import { afficherNotification } from "./utils.js";
import { requeteAPI } from "./api.js";

function echapperHTML(texte) {
  const div = document.createElement("div");
  div.textContent = texte ?? "";
  return div.innerHTML;
}

function formaterDate(valeur) {
  if (!valeur) return "";
  return String(valeur).slice(0, 10);
}

// --- Onglets (pure UI, inchangé) ---
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

if (tabButtons.length > 0) {
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTabId = btn.dataset.tab;
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.querySelector(`#${targetTabId}`)?.classList.add("active");
    });
  });
}

// --- Statistiques globales ---
async function chargerStatsAdmin() {
  const reponse = await requeteAPI("/admin/stats");
  const stats = reponse?.stats;
  if (!stats) return;

  const totalUsersEl = document.querySelector("#statTotalUsers");
  const totalPrestatairesEl = document.querySelector("#statPrestatairesActifs");
  const totalEnAttenteEl = document.querySelector("#cntEnAttente");
  const totalDemandesEl = document.querySelector("#statDemandesTotales");

  if (totalUsersEl) totalUsersEl.textContent = stats.totalUsers;
  if (totalPrestatairesEl) totalPrestatairesEl.textContent = stats.totalPrestataires;
  if (totalEnAttenteEl) totalEnAttenteEl.textContent = stats.totalEnAttente;
  if (totalDemandesEl) totalDemandesEl.textContent = stats.totalDemandes;
}

chargerStatsAdmin();

// --- Validation des prestataires en attente ---

const tableValidationPrestataires = document.querySelector("#tableValidationPrestataires");

function construireLignePrestataireEnAttente(prestataire) {
  const villeZone = [prestataire.ville, prestataire.quartier].filter(Boolean).join(" - ");

  return `
    <tr data-id="${prestataire.id}">
      <td><strong>${echapperHTML(prestataire.nom_complet)}</strong></td>
      <td>${echapperHTML(prestataire.metier)}</td>
      <td>${echapperHTML(villeZone)}</td>
      <td>${echapperHTML(prestataire.telephone)}</td>
      <td>${formaterDate(prestataire.created_at)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-success btn-valider-prestataire">Valider</button>
          <button class="btn-danger btn-rejeter-prestataire">Rejeter</button>
        </div>
      </td>
    </tr>
  `;
}

async function chargerPrestatairesEnAttente() {
  if (!tableValidationPrestataires) return;

  const reponse = await requeteAPI("/admin/pending");
  const prestataires = reponse?.pendingPrestataires || [];

  tableValidationPrestataires.innerHTML = prestataires.length
    ? prestataires.map(construireLignePrestataireEnAttente).join("")
    : `<tr><td colspan="6">Aucun prestataire en attente.</td></tr>`;
}

if (tableValidationPrestataires) {
  chargerPrestatairesEnAttente();

  tableValidationPrestataires.addEventListener("click", async (e) => {
    const btnValider = e.target.closest(".btn-valider-prestataire");
    const btnRejeter = e.target.closest(".btn-rejeter-prestataire");
    if (!btnValider && !btnRejeter) return;

    const row = (btnValider || btnRejeter).closest("tr");
    const id = row?.dataset.id;
    const nom = row?.querySelector("td strong")?.textContent || "Le prestataire";
    if (!id) return;

    const action = btnValider ? "Valider" : "Rejeter";

    const reponse = await requeteAPI(`/admin/validate/${id}`, {
      method: "PUT",
      body: JSON.stringify({ action }),
    });

    if (!reponse) {
      afficherNotification("Impossible de traiter cette demande pour le moment.", "error");
      return;
    }

    afficherNotification(
      btnValider ? `${nom} a été validé avec succès.` : `La demande de ${nom} a été rejetée.`,
      btnValider ? "success" : "warning",
    );

    chargerPrestatairesEnAttente();
    chargerStatsAdmin();
  });
}

// --- Liste globale des utilisateurs + suspension ---

const tableUtilisateurs = document.querySelector("#tableUtilisateurs");

function construireLigneUtilisateur(user) {
  const estSuspendu = user.statut_validation === "Suspendu";
  const labelBouton = estSuspendu ? "Réactiver" : "Suspendre";
  const statutAffiche = user.statut_validation || "Actif";

  return `
    <tr data-id="${user.id}">
      <td>${echapperHTML(user.nom_complet)}</td>
      <td>${echapperHTML(user.role)}</td>
      <td>${echapperHTML(user.telephone)}</td>
      <td><span class="status ${estSuspendu ? "refusee" : "acceptee"}">${echapperHTML(statutAffiche)}</span></td>
      <td><button class="btn-danger btn-supprimer-user">${labelBouton}</button></td>
    </tr>
  `;
}

async function chargerUtilisateurs() {
  if (!tableUtilisateurs) return;

  const reponse = await requeteAPI("/admin/users");
  const users = reponse?.users || [];

  tableUtilisateurs.innerHTML = users.map(construireLigneUtilisateur).join("");
}

if (tableUtilisateurs) {
  chargerUtilisateurs();

  tableUtilisateurs.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("btn-supprimer-user")) return;

    const row = e.target.closest("tr");
    const id = row?.dataset.id;
    const userName = row?.querySelector("td")?.textContent;
    if (!id) return;

    if (!confirm(`Voulez-vous changer le statut de "${userName}" ?`)) return;

    const reponse = await requeteAPI(`/admin/users/${id}/suspend`, { method: "PUT" });

    if (!reponse) {
      afficherNotification("Impossible de mettre à jour cet utilisateur pour le moment.", "error");
      return;
    }

    afficherNotification(reponse.message || `${userName} mis à jour.`, "warning");
    chargerUtilisateurs();
  });
}

// --- Catégories ---

const btnAddCategory = document.querySelector("#btnAddCategory");
const newCategoryInput = document.querySelector("#newCategoryInput");
const tableCategories = document.querySelector("#tableCategories");

function construireLigneCategorie(cat) {
  return `
    <tr data-id="${cat.id}">
      <td>${echapperHTML(cat.nom)}</td>
      <td>${cat.nombre_prestataires ?? 0}</td>
      <td><button class="btn-danger btn-delete-cat">Supprimer</button></td>
    </tr>
  `;
}

async function chargerCategories() {
  if (!tableCategories) return;

  const reponse = await requeteAPI("/admin/categories");
  const categories = reponse?.categories || [];

  tableCategories.innerHTML = categories.map(construireLigneCategorie).join("");
}

if (tableCategories) {
  chargerCategories();
}

if (btnAddCategory && newCategoryInput && tableCategories) {
  btnAddCategory.addEventListener("click", async () => {
    const nomCat = newCategoryInput.value.trim();
    if (!nomCat) {
      afficherNotification("Veuillez saisir un nom de catégorie.", "warning");
      return;
    }

    btnAddCategory.disabled = true;
    const reponse = await requeteAPI("/admin/categories", {
      method: "POST",
      body: JSON.stringify({ nom: nomCat }),
    });
    btnAddCategory.disabled = false;

    if (!reponse) {
      afficherNotification("Impossible de créer la catégorie pour le moment (existe peut-être déjà).", "error");
      return;
    }

    newCategoryInput.value = "";
    afficherNotification(`Catégorie "${nomCat}" ajoutée avec succès.`, "success");
    chargerCategories();
  });

  tableCategories.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("btn-delete-cat")) return;

    const row = e.target.closest("tr");
    const id = row?.dataset.id;
    const catName = row.querySelector("td")?.textContent;
    if (!id) return;

    if (!confirm(`Voulez-vous vraiment supprimer la catégorie "${catName}" ?`)) return;

    const reponse = await requeteAPI(`/admin/categories/${id}`, { method: "DELETE" });

    if (!reponse) {
      afficherNotification("Impossible de supprimer cette catégorie pour le moment.", "error");
      return;
    }

    afficherNotification(`Catégorie "${catName}" supprimée.`, "warning");
    chargerCategories();
  });
}

// --- Modération des publications ---
// ⚠️ Aucune route backend : reste local/visuel pour l'instant.
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("btn-delete-pub")) {
    const row = e.target.closest("tr");
    if (confirm("Voulez-vous supprimer cette publication ?")) {
      row.remove();
      afficherNotification("Publication supprimée avec succès.", "success");
    }
  }
});
