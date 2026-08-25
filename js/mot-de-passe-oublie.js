/**
 * mot-de-passe-oublie.js
 * Gère les deux étapes de la réinitialisation de mot de passe :
 * - mot-de-passe-oublie.html : demande du lien (POST /api/auth/mot-de-passe-oublie)
 * - reinitialiser-mot-de-passe.html : saisie du nouveau mot de passe, avec
 *   le jeton récupéré dans l'URL (?token=..., voir le lien envoyé par email)
 *   (POST /api/auth/reinitialiser-mot-de-passe)
 */

import { afficherMessage } from "./utils.js";
import { requeteAPI } from "./api.js";

// --- Étape 1 : demande du lien ---

const mdpOublieForm = document.querySelector("#mdpOublieForm");

if (mdpOublieForm) {
  const mdpOublieMessage = document.querySelector("#mdpOublieMessage");

  mdpOublieForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const identifiant = document.querySelector("#identifiant")?.value.trim();
    if (!identifiant) return;

    const submitButton = mdpOublieForm.querySelector("button[type='submit']");
    if (submitButton) submitButton.disabled = true;

    const reponse = await requeteAPI("/auth/mot-de-passe-oublie", {
      method: "POST",
      body: JSON.stringify({ identifiant }),
    });

    if (submitButton) submitButton.disabled = false;

    // La route répond toujours le même message générique par sécurité (ne
    // révèle jamais si le compte existe) — on l'affiche tel quel dans tous
    // les cas, y compris si la requête échoue techniquement, pour ne pas
    // donner d'indice différent selon le cas.
    afficherMessage(
      mdpOublieMessage,
      reponse?.message ||
        "Si un compte associé existe avec un email renseigné, un lien de réinitialisation vient de lui être envoyé.",
      "success",
      8000,
    );

    mdpOublieForm.reset();
  });
}

// --- Étape 2 : saisie du nouveau mot de passe ---

const reinitForm = document.querySelector("#reinitForm");

if (reinitForm) {
  const reinitMessage = document.querySelector("#reinitMessage");
  const reinitLienInvalide = document.querySelector("#reinitLienInvalide");
  const reinitSousTitre = document.querySelector("#reinitSousTitre");

  const token = new URLSearchParams(window.location.search).get("token");

  if (!token) {
    reinitForm.style.display = "none";
    if (reinitSousTitre) reinitSousTitre.style.display = "none";
    if (reinitLienInvalide) reinitLienInvalide.style.display = "block";
  } else {
    reinitForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nouveauMotDePasse = document.querySelector("#nouveauMotDePasse")?.value;
      const confirmerNouveauMotDePasse = document.querySelector("#confirmerNouveauMotDePasse")?.value;

      if (!nouveauMotDePasse || nouveauMotDePasse.length < 6) {
        afficherMessage(reinitMessage, "Le mot de passe doit contenir au moins 6 caractères.", "error");
        return;
      }

      if (nouveauMotDePasse !== confirmerNouveauMotDePasse) {
        afficherMessage(reinitMessage, "Les mots de passe ne correspondent pas.", "error");
        return;
      }

      const submitButton = reinitForm.querySelector("button[type='submit']");
      if (submitButton) submitButton.disabled = true;

      const reponse = await requeteAPI("/auth/reinitialiser-mot-de-passe", {
        method: "POST",
        body: JSON.stringify({ token, nouveauMotDePasse }),
      });

      if (submitButton) submitButton.disabled = false;

      if (!reponse?.message || reponse.message.toLowerCase().includes("invalide") || reponse.message.toLowerCase().includes("expiré")) {
        reinitForm.style.display = "none";
        if (reinitSousTitre) reinitSousTitre.style.display = "none";
        if (reinitLienInvalide) reinitLienInvalide.style.display = "block";
        return;
      }

      afficherMessage(reinitMessage, "Mot de passe réinitialisé avec succès ! Redirection...", "success");

      setTimeout(() => {
        window.location.href = "connexion.html";
      }, 1800);
    });
  }
}
