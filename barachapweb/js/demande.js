/**
 * demande.js
 * Gère le formulaire de demande de service :
 * - pré-remplissage en mode modification
 * - validation et soumission
 * - date minimale (empêche de choisir une date passée)
 * Dépend de utils.js (lireStockage, ecrireStockage, afficherMessage, obtenirDateAujourdhui, trouverChampManquant).
 */

import {
  lireStockage,
  ecrireStockage,
  afficherMessage,
  obtenirDateAujourdhui,
  trouverChampManquant,
} from "./utils.js";

const demandeForm = document.querySelector("#demandeForm");
const message = document.querySelector("#message");
const dateInput = document.querySelector("#date");

// Empêche de choisir une date passée
if (dateInput) {
  dateInput.setAttribute("min", obtenirDateAujourdhui());
}

// Pré-remplissage du formulaire si on arrive en mode "modification"
if (demandeForm) {
  const demandeEnCours = lireStockage("demandeEnCours", null);

  if (demandeEnCours) {
    const prestationInput = document.querySelector("#prestation");
    const nomInput = document.querySelector("#nom");
    const prenomInput = document.querySelector("#prenom");
    const telephoneInput = document.querySelector("#telephone");
    const besoinInput = document.querySelector("#besoin");
    const villeInput = document.querySelector("#ville");

    if (prestationInput)
      prestationInput.value = demandeEnCours.prestation || "";
    if (nomInput) nomInput.value = demandeEnCours.nom || "";
    if (prenomInput) prenomInput.value = demandeEnCours.prenom || "";
    if (telephoneInput) telephoneInput.value = demandeEnCours.telephone || "";
    if (besoinInput) besoinInput.value = demandeEnCours.besoin || "";
    if (dateInput) dateInput.value = demandeEnCours.date || "";
    if (villeInput) villeInput.value = demandeEnCours.ville || "";

    // Adapte le libellé du bouton pour indiquer qu'on modifie
    const submitButton = demandeForm.querySelector("button[type='submit']");
    if (submitButton) submitButton.textContent = "Mettre à jour la demande";
  }
}

if (demandeForm) {
  demandeForm.addEventListener("submit", function (event) {
    event.preventDefault();

    // Récupère chaque champ individuellement pour éviter un crash
    // si l'un d'eux est absent du DOM (ex: mauvais id ou champ optionnel)
    const prestationInput = document.querySelector("#prestation");
    const nomInput = document.querySelector("#nom");
    const prenomInput = document.querySelector("#prenom");
    const telephoneInput = document.querySelector("#telephone");
    const besoinInput = document.querySelector("#besoin");
    const villeInput = document.querySelector("#ville");
    const photoInput = document.querySelector("#photo");

    // Vérifie que les champs obligatoires existent bien dans le HTML
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

    // Création de l'objet demande
    const demande = {
      prestation: prestationInput.value.trim(),
      nom: nomInput.value.trim(),
      prenom: prenomInput.value.trim(),
      telephone: telephoneInput.value.trim(),
      besoin: besoinInput.value.trim(),
      date: dateInput.value,
      ville: villeInput.value.trim(),
      photo:
        photoInput && photoInput.files[0] ? photoInput.files[0].name : null,
      statut: "En attente",
      dateCreation: new Date().toISOString(),
    };

    try {
      // Récupère les anciennes demandes
      let demandes = lireStockage("demandes", []);
      if (!Array.isArray(demandes)) {
        demandes = [];
      }

      // Vérifie si on est en mode modification
      const indexModificationStr = localStorage.getItem("indexModification");
      const enModeModification =
        indexModificationStr !== null &&
        demandes[parseInt(indexModificationStr, 10)];

      if (enModeModification) {
        const indexModification = parseInt(indexModificationStr, 10);

        // Conserve le statut et la date de création d'origine
        demande.statut = demandes[indexModification].statut;
        demande.dateCreation = demandes[indexModification].dateCreation;

        // Remplace la demande existante au lieu d'en ajouter une nouvelle
        demandes[indexModification] = demande;

        // Nettoie les infos de modification
        localStorage.removeItem("demandeEnCours");
        localStorage.removeItem("indexModification");
      } else {
        // Ajoute la nouvelle demande
        demandes.push(demande);
      }

      // Sauvegarde la liste mise à jour
      ecrireStockage("demandes", demandes);

      // Retour visuel de succès à l'utilisateur
      afficherMessage(
        message,
        enModeModification
          ? "Demande modifiée avec succès."
          : "Votre demande a bien été envoyée. Le prestataire vous contactera bientôt.",
        "success",
      );

      demandeForm.reset();

      // Redirige vers le dashboard uniquement après une modification réussie
      if (enModeModification) {
        setTimeout(() => {
          window.location.href = "dashboard-client.html";
        }, 1500);
      }
    } catch (erreur) {
      // Peut arriver si le localStorage est plein, désactivé,
      // ou si le JSON stocké est corrompu
      console.error("Erreur lors de la sauvegarde de la demande :", erreur);
      afficherMessage(
        message,
        "Une erreur est survenue lors de l'enregistrement. Veuillez réessayer.",
        "error",
      );
    }
  });
}
