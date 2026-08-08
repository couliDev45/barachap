/**
 * prestataire.js
 * Gère les fonctionnalités du tableau de bord Prestataire :
 * - Acceptation et refus des demandes reçues
 * - Ajout de services et réalisations
 */

import { afficherNotification } from "./utils.js";

// Gestion des boutons Accepter / Refuser dans le tableau des demandes
const tableDemandesRecues = document.querySelector("#tableDemandesRecues");

if (tableDemandesRecues) {
  tableDemandesRecues.addEventListener("click", (e) => {
    const btnAccepter = e.target.closest(".btn-accepter");
    const btnRefuser = e.target.closest(".btn-refuser");

    if (btnAccepter) {
      const row = btnAccepter.closest("tr");
      const statusBadge = row.querySelector(".status");
      if (statusBadge) {
        statusBadge.className = "status acceptee";
        statusBadge.textContent = "Acceptée";
      }
      btnAccepter.parentElement.innerHTML = `<button class="btn-secondary">Contacter</button>`;
      afficherNotification("Demande acceptée avec succès.", "success");
    }

    if (btnRefuser) {
      const row = btnRefuser.closest("tr");
      const statusBadge = row.querySelector(".status");
      if (statusBadge) {
        statusBadge.className = "status refusee";
        statusBadge.textContent = "Refusée";
      }
      btnRefuser.parentElement.innerHTML = `<span style="font-size: 13px; color: #999;">Refusée</span>`;
      afficherNotification("Demande refusée.", "warning");
    }
  });
}

// Ajout rapide de service
const btnAddService = document.querySelector("#btnAddService");
if (btnAddService) {
  btnAddService.addEventListener("click", () => {
    const nomService = prompt("Entrez le titre du nouveau service (ex: Débouchage évier) :");
    if (nomService && nomService.trim()) {
      afficherNotification(`Le service "${nomService.trim()}" a bien été ajouté à votre profil.`, "success");
    }
  });
}

// Publication de réalisation
const btnAddRealisation = document.querySelector("#btnAddRealisation");
if (btnAddRealisation) {
  btnAddRealisation.addEventListener("click", () => {
    const nomRealisation = prompt("Entrez le titre de votre réalisation :");
    if (nomRealisation && nomRealisation.trim()) {
      afficherNotification(`La réalisation "${nomRealisation.trim()}" a été publiée avec succès.`, "success");
    }
  });
}
