/**
 * profil.js
 * Affiche le profil réel d'un prestataire sur profil.html, à partir de
 * l'id transmis dans l'URL (?id=X, voir services.js / prestataires.js qui
 * construisent ce lien depuis les cartes de résultats).
 * Route utilisée : GET /api/users/prestataires/:id (publique, pas de JWT requis).
 *
 * bio et photo_url viennent de PUT /api/users/me (voir prestataire.js) — si le
 * prestataire ne les a pas encore renseignés, on retombe sur une phrase
 * générique et l'image d'exemple du gabarit plutôt que de rien afficher.
 *
 * Sections non connectées, faute de données correspondantes côté backend :
 * - La note (rating-badge) et les avis clients : aucune table d'avis n'existe.
 */

import { requeteAPI } from "./api.js";

const profilNom = document.querySelector("#profilNom");

// Cette page ne s'exécute que si elle contient réellement un profil à charger
if (profilNom) {
  const urlParams = new URLSearchParams(window.location.search);
  const prestataireId = urlParams.get("id");

  const profilPhoto = document.querySelector("#profilPhoto");
  const profilMetier = document.querySelector("#profilMetier");
  const profilVille = document.querySelector("#profilVille");
  const profilApropos = document.querySelector("#profilApropos");
  const profilDemandeLink = document.querySelector("#profilDemandeLink");
  const profilServicesListe = document.querySelector("#profilServicesListe");
  const profilGalerie = document.querySelector("#profilGalerie");

  function echapperHTML(texte) {
    const div = document.createElement("div");
    div.textContent = texte ?? "";
    return div.innerHTML;
  }

  async function chargerProfil() {
    if (!prestataireId) {
      if (profilNom) profilNom.textContent = "Prestataire introuvable";
      if (profilApropos) profilApropos.textContent = "Aucun identifiant de prestataire fourni.";
      return;
    }

    const reponse = await requeteAPI(`/users/prestataires/${prestataireId}`);

    if (!reponse?.prestataire) {
      profilNom.textContent = "Prestataire introuvable";
      if (profilApropos) profilApropos.textContent = "Ce profil n'existe pas ou n'est plus disponible.";
      if (profilDemandeLink) profilDemandeLink.style.display = "none";
      return;
    }

    const { prestataire, services, realisations } = reponse;
    const villeAffichee = [prestataire.ville, prestataire.quartier].filter(Boolean).join(" - ");

    profilNom.textContent = prestataire.nom_complet;
    if (profilMetier) profilMetier.textContent = prestataire.metier || "";
    if (profilVille) profilVille.textContent = villeAffichee;
    if (profilPhoto && prestataire.photo_url) profilPhoto.src = prestataire.photo_url;
    if (profilApropos) {
      profilApropos.textContent =
        prestataire.bio?.trim() ||
        `${prestataire.nom_complet} propose des services de ${prestataire.metier || "prestation"} à ${villeAffichee || "proximité"}.`;
    }
    if (profilDemandeLink) {
      profilDemandeLink.href = `demande.html?prestataireId=${prestataire.id}`;
    }

    if (profilServicesListe) {
      profilServicesListe.innerHTML = services?.length
        ? services.map((s) => `<li>${echapperHTML(s.titre)}</li>`).join("")
        : `<li>Aucun service renseigné pour le moment.</li>`;
    }

    if (profilGalerie) {
      const images = (realisations || []).filter((r) => r.photo_url);
      if (images.length) {
        const titre = profilGalerie.querySelector("h3");
        profilGalerie.innerHTML = "";
        if (titre) profilGalerie.appendChild(titre);
        images.forEach((r) => {
          const img = document.createElement("img");
          img.src = r.photo_url;
          img.alt = r.titre || "Réalisation";
          profilGalerie.appendChild(img);
        });
      }
      // Si aucune réalisation avec photo n'existe, on laisse les images
      // d'exemple du gabarit HTML plutôt que d'afficher une galerie vide.
    }
  }

  chargerProfil();
}

