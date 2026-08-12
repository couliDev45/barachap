/**
 * demande.js
 * Gère le formulaire de demande de service :
 * - pré-remplissage en mode modification
 * - validation et soumission via l'API (POST /api/demandes)
 * - date minimale (empêche de choisir une date passée)
 * - récupère un ?prestataireId= dans l'URL si on arrive depuis un profil
 *   prestataire (voir profil.js), pour cibler directement la demande
 *
 * Note : le champ #photo du formulaire n'est pas envoyé — la route backend
 * POST /api/demandes n'accepte pas encore de fichier/upload.
 */

import {
  lireStockage,
  afficherMessage,
  obtenirDateAujourdhui,
  trouverChampManquant,
} from "./utils.js";
import { requeteAPI } from "./api.js";

const demandeForm = document.querySelector("#demandeForm");
const message = document.querySelector("#message");
const dateInput = document.querySelector("#date");

if (dateInput) {
  dateInput.setAttribute("min", obtenirDateAujourdhui());
}

// Pré-remplissage du formulaire si on arrive en mode "modification"
// (demandeEnCours est déposé par dashboard.js, voir modifierDemande)
if (demandeForm) {
  const demandeEnCours = lireStockage("demandeEnCours", null);

  if (demandeEnCours) {
    const prestationInput = document.querySelector("#prestation");
    const nomInput = document.querySelector("#nom");
    const prenomInput = document.querySelector("#prenom");
    const telephoneInput = document.querySelector("#telephone");
    const besoinInput = document.querySelector("#besoin");
    const villeInput = document.querySelector("#ville");

    if (prestationInput) prestationInput.value = demandeEnCours.prestation || "";
    if (nomInput) nomInput.value = demandeEnCours.nom || "";
    if (prenomInput) prenomInput.value = demandeEnCours.prenom || "";
    if (telephoneInput) telephoneInput.value = demandeEnCours.telephone || "";
    if (besoinInput) besoinInput.value = demandeEnCours.besoin || "";
    if (dateInput) dateInput.value = demandeEnCours.date || "";
    if (villeInput) villeInput.value = demandeEnCours.ville || "";

    const submitButton = demandeForm.querySelector("button[type='submit']");
    if (submitButton) submitButton.textContent = "Mettre à jour la demande";
  }
}

if (demandeForm) {
  demandeForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const prestationInput = document.querySelector("#prestation");
    const nomInput = document.querySelector("#nom");
    const prenomInput = document.querySelector("#prenom");
    const telephoneInput = document.querySelector("#telephone");
    const besoinInput = document.querySelector("#besoin");
    const villeInput = document.querySelector("#ville");

    const champsObligatoires = {
      prestation: prestationInput,
      nom: nomInput,
      prenom: prenomInput,
      telephone: telephoneInput,
      besoin: besoinInput,
      date: dateInput,
      ville: villeInput,
    };

    const champManquant = trouverChampManquant(champsObligatoires);

    if (champManquant) {
      console.error(`Champ manquant dans le formulaire : #${champManquant[0]}`);
      afficherMessage(
        message,
        "Une erreur est survenue avec le formulaire. Veuillez réessayer.",
        "error",
      );
      return;
    }

    // Prestataire ciblé si on arrive depuis profil.html?id=X (voir profil.js
    // qui construit le lien "Faire une demande" avec ?prestataireId=X)
    const urlParams = new URLSearchParams(window.location.search);
    const prestataireId = urlParams.get("prestataireId") || null;

    const demande = {
      prestation: prestationInput.value.trim(),
      nom: nomInput.value.trim(),
      prenom: prenomInput.value.trim(),
      telephone: telephoneInput.value.trim(),
      besoin: besoinInput.value.trim(),
      date: dateInput.value,
      ville: villeInput.value.trim(),
      prestataireId,
    };

    const demandeEnCours = lireStockage("demandeEnCours", null);
    const enModeModification = Boolean(demandeEnCours && demandeEnCours.id);

    const submitButton = demandeForm.querySelector("button[type='submit']");
    if (submitButton) submitButton.disabled = true;

    let reponse;
    if (enModeModification) {
      // Le backend n'expose qu'une mise à jour du statut (PUT /api/demandes/:id),
      // pas une modification complète du contenu (nom, date, ville, besoin...).
      // En attendant une vraie route de mise à jour côté serveur, on recrée la
      // demande avec les nouvelles valeurs (suppression de l'ancienne + création
      // d'une nouvelle) pour que les modifications soient réellement appliquées.
      await requeteAPI(`/demandes/${demandeEnCours.id}`, { method: "DELETE" });
      reponse = await requeteAPI("/demandes", {
        method: "POST",
        body: JSON.stringify(demande),
      });
    } else {
      reponse = await requeteAPI("/demandes", {
        method: "POST",
        body: JSON.stringify(demande),
      });
    }

    if (submitButton) submitButton.disabled = false;

    if (!reponse) {
      const messageErreur = lireStockage("utilisateurConnecte", null)
        ? "Une erreur est survenue lors de l'enregistrement. Veuillez réessayer."
        : "Vous devez être connecté pour envoyer une demande.";
      afficherMessage(message, messageErreur, "error");
      return;
    }

    localStorage.removeItem("demandeEnCours");

    afficherMessage(
      message,
      enModeModification
        ? "Demande modifiée avec succès."
        : "Votre demande a bien été envoyée. Le prestataire vous contactera bientôt.",
      "success",
    );

    demandeForm.reset();

    if (enModeModification) {
      setTimeout(() => {
        window.location.href = "dashboard-client.html";
      }, 1500);
    }
  });
}
