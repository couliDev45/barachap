/**
 * taxi-moto.js
 * Gère la commande d'une course taxi-moto :
 * - deux cartes Leaflet/OpenStreetMap (gratuit, sans clé API) pour choisir
 *   départ et destination en cliquant, ou "Ma position actuelle" pour le départ
 * - reverse-geocoding léger via Nominatim (un seul appel par point posé, pas
 *   en continu) pour afficher une adresse lisible plutôt que des coordonnées
 * - soumission de la course (POST /api/courses) et suivi en direct par
 *   sondage (GET /api/courses) jusqu'à ce qu'un chauffeur accepte
 * - barrière de connexion propre à cette page
 */

import { lireStockage } from "./utils.js";
import { requeteAPI } from "./api.js";

const courseForm = document.querySelector("#courseForm");

// Cette page ne s'exécute que si elle contient réellement le formulaire de course
if (courseForm) {
  const courseFormTitre = document.querySelector("#courseFormTitre");
  const courseGateConnexion = document.querySelector("#courseGateConnexion");
  const utilisateurConnecte = lireStockage("utilisateurConnecte", null);

  // --- Barrière de connexion (même logique que demande.html, propre à cette page) ---
  if (!utilisateurConnecte && courseGateConnexion) {
    if (courseFormTitre) courseFormTitre.style.display = "none";
    courseForm.style.display = "none";
    courseGateConnexion.style.display = "block";

    const retour = encodeURIComponent(window.location.pathname.split("/").pop() + window.location.search);
    const lienConnexion = document.querySelector("#courseGateLienConnexion");
    const lienInscription = document.querySelector("#courseGateLienInscription");
    if (lienConnexion) lienConnexion.href = `connexion.html?retour=${retour}`;
    if (lienInscription) lienInscription.href = `inscription.html?retour=${retour}`;
  } else {
    initialiserFormulaireCourse();
  }
}

function initialiserFormulaireCourse() {
  const utilisateurConnecte = lireStockage("utilisateurConnecte", null);

  // Centre par défaut : Abidjan
  const CENTRE_DEFAUT = [5.36, -4.0083];

  const courseNom = document.querySelector("#courseNom");
  const courseTelephone = document.querySelector("#courseTelephone");
  if (courseNom && utilisateurConnecte?.nom_complet) courseNom.value = utilisateurConnecte.nom_complet;
  if (courseTelephone && utilisateurConnecte?.telephone) courseTelephone.value = utilisateurConnecte.telephone;

  const carteDepart = L.map("carteDepart").setView(CENTRE_DEFAUT, 13);
  const carteDestination = L.map("carteDestination").setView(CENTRE_DEFAUT, 13);

  [carteDepart, carteDestination].forEach((carte) => {
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(carte);
  });

  let marqueurDepart = null;
  let marqueurDestination = null;
  let pointDepart = null; // { lat, lng, adresse }
  let pointDestination = null;

  // Reverse-geocoding léger : un seul appel par point posé, jamais en continu
  // (respecte la politique d'usage de Nominatim, le service gratuit d'OpenStreetMap)
  async function adresseDepuisCoordonnees(lat, lng) {
    try {
      const reponse = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      );
      if (!reponse.ok) throw new Error("Échec reverse-geocoding");
      const data = await reponse.json();
      return data.display_name || null;
    } catch {
      return null;
    }
  }

  async function definirPoint(type, lat, lng) {
    const estDepart = type === "depart";
    const carte = estDepart ? carteDepart : carteDestination;
    const label = document.querySelector(estDepart ? "#departAdresseLabel" : "#destinationAdresseLabel");

    if (estDepart) {
      if (marqueurDepart) marqueurDepart.setLatLng([lat, lng]);
      else marqueurDepart = L.marker([lat, lng]).addTo(carte);
    } else {
      if (marqueurDestination) marqueurDestination.setLatLng([lat, lng]);
      else marqueurDestination = L.marker([lat, lng]).addTo(carte);
    }

    carte.panTo([lat, lng]);
    if (label) label.textContent = "Localisation en cours...";

    const adresse = await adresseDepuisCoordonnees(lat, lng);
    const point = { lat, lng, adresse };

    if (estDepart) pointDepart = point;
    else pointDestination = point;

    if (label) label.textContent = adresse || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  carteDepart.on("click", (e) => definirPoint("depart", e.latlng.lat, e.latlng.lng));
  carteDestination.on("click", (e) => definirPoint("destination", e.latlng.lat, e.latlng.lng));

  const btnMaPosition = document.querySelector("#btnMaPosition");
  if (btnMaPosition) {
    btnMaPosition.addEventListener("click", () => {
      if (!navigator.geolocation) {
        afficherMessageCourse("La géolocalisation n'est pas disponible sur cet appareil.");
        return;
      }
      btnMaPosition.disabled = true;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          btnMaPosition.disabled = false;
          definirPoint("depart", position.coords.latitude, position.coords.longitude);
          carteDepart.setView([position.coords.latitude, position.coords.longitude], 15);
        },
        () => {
          btnMaPosition.disabled = false;
          afficherMessageCourse("Impossible d'obtenir votre position. Cliquez sur la carte pour la définir manuellement.");
        },
      );
    });
  }

  const courseMessage = document.querySelector("#courseMessage");
  function afficherMessageCourse(texte) {
    if (courseMessage) courseMessage.textContent = texte;
  }

  // --- Soumission de la course ---

  const btnCommanderMoto = document.querySelector("#btnCommanderMoto");
  if (btnCommanderMoto) {
    btnCommanderMoto.addEventListener("click", async () => {
      const nom = courseNom?.value.trim();
      const telephone = courseTelephone?.value.trim();

      if (!nom || !telephone) {
        afficherMessageCourse("Veuillez indiquer votre nom et votre téléphone.");
        return;
      }
      if (!pointDepart) {
        afficherMessageCourse("Veuillez indiquer votre point de départ.");
        return;
      }
      if (!pointDestination) {
        afficherMessageCourse("Veuillez indiquer votre destination.");
        return;
      }

      btnCommanderMoto.disabled = true;
      afficherMessageCourse("");

      const reponse = await requeteAPI("/courses", {
        method: "POST",
        body: JSON.stringify({
          nom,
          telephone,
          departLat: pointDepart.lat,
          departLng: pointDepart.lng,
          departAdresse: pointDepart.adresse,
          destinationLat: pointDestination.lat,
          destinationLng: pointDestination.lng,
          destinationAdresse: pointDestination.adresse,
        }),
      });

      btnCommanderMoto.disabled = false;

      if (!reponse?.course) {
        afficherMessageCourse(reponse?.message || "Impossible de commander la moto pour le moment.");
        return;
      }

      demarrerSuivi(reponse.course.id);
    });
  }

  // --- Suivi en direct de la course ---

  function demarrerSuivi(courseId) {
    courseForm.style.display = "none";
    if (courseFormTitre) courseFormTitre.style.display = "none";

    const courseSuivi = document.querySelector("#courseSuivi");
    const courseSuiviTitre = document.querySelector("#courseSuiviTitre");
    const courseSuiviDetail = document.querySelector("#courseSuiviDetail");
    const btnAnnulerCourse = document.querySelector("#btnAnnulerCourse");

    if (courseSuivi) courseSuivi.style.display = "block";

    let intervalId = null;

    async function verifierStatut() {
      const reponse = await requeteAPI("/courses");
      const course = reponse?.courses?.find((c) => c.id === courseId);
      if (!course) return;

      if (course.statut === "Acceptée" || course.statut === "En cours") {
        if (courseSuiviTitre) courseSuiviTitre.textContent = "Chauffeur trouvé !";
        if (courseSuiviDetail) {
          courseSuiviDetail.textContent = "Votre chauffeur a été notifié et arrive vers votre position.";
        }
        if (btnAnnulerCourse) btnAnnulerCourse.style.display = "none";
        clearInterval(intervalId);
      } else if (course.statut === "Terminée") {
        if (courseSuiviTitre) courseSuiviTitre.textContent = "Course terminée";
        if (courseSuiviDetail) courseSuiviDetail.textContent = "Merci d'avoir utilisé BaraChap !";
        clearInterval(intervalId);
      } else if (course.statut === "Annulée") {
        if (courseSuiviTitre) courseSuiviTitre.textContent = "Course annulée";
        clearInterval(intervalId);
      }
    }

    intervalId = setInterval(verifierStatut, 5000);
    verifierStatut();

    if (btnAnnulerCourse) {
      btnAnnulerCourse.addEventListener("click", async () => {
        if (!confirm("Voulez-vous vraiment annuler cette course ?")) return;
        await requeteAPI(`/courses/${courseId}/statut`, {
          method: "PUT",
          body: JSON.stringify({ statut: "Annulée" }),
        });
        clearInterval(intervalId);
        if (courseSuiviTitre) courseSuiviTitre.textContent = "Course annulée";
        if (btnAnnulerCourse) btnAnnulerCourse.style.display = "none";
      });
    }
  }
}
