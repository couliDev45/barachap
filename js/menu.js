const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".nav");

// Vérifie que le menu existe sur la page
if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("nav-open");

    navToggle.setAttribute("aria-expanded", isOpen);
  });

  // Ferme le menu lorsqu'on clique sur un lien
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("nav-open");

      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

// Reflète le vrai état de connexion sur TOUTE page (pas seulement les 3
// dashboards) : sans ça, une session pourtant active sur services.html,
// prestataires.html, profil.html, demande.html ou l'accueil affichait
// toujours "Connexion" en dur, donnant l'impression d'être déconnecté à
// chaque changement de page alors que le token restait valide.
// Cible tout lien de nav pointant vers connexion.html, quel que soit le
// texte actuellement écrit en dur dans le HTML (Connexion ou Déconnexion).
const lienConnexion = document.querySelector('.nav a[href$="connexion.html"]');

if (lienConnexion) {
  const utilisateurConnecte = JSON.parse(localStorage.getItem("utilisateurConnecte") || "null");

  if (utilisateurConnecte) {
    lienConnexion.textContent = "Déconnexion";
    lienConnexion.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem("jwt_token");
      localStorage.removeItem("utilisateurConnecte");
      window.location.href = "connexion.html";
    });

    // Le préfixe (ex: "pages/" depuis l'accueil, "" depuis une page interne)
    // est déduit du lien Connexion existant, pour rester correct partout.
    const prefixe = lienConnexion.getAttribute("href").replace("connexion.html", "");
    const nomPageActuelle = window.location.pathname.split("/").pop();

    function ajouterLienNav(texte, cible) {
      const dejaPresent = nav && (nav.querySelector(`a[href$="${cible}"]`) || nomPageActuelle === cible);
      if (!nav || dejaPresent) return;

      const lien = document.createElement("a");
      lien.href = prefixe + cible;
      lien.textContent = texte;
      if (navToggle) {
        lien.addEventListener("click", () => {
          nav.classList.remove("nav-open");
          navToggle.setAttribute("aria-expanded", "false");
        });
      }
      nav.insertBefore(lien, lienConnexion);
    }

    // "Mon espace" toujours accessible depuis n'importe quelle page une fois
    // connecté (avant, le tableau de bord n'était visible qu'une fois, juste
    // après la connexion — impossible d'y revenir en naviguant ailleurs).
    const cibles = {
      admin: "dashboard-admin.html",
      prestataire: "dashboard-prestataire.html",
      client: "dashboard-client.html",
    };
    ajouterLienNav("Mon espace", cibles[utilisateurConnecte.role] || cibles.client);

    // "Mon compte" : accès direct à la gestion du compte (email, photo, mot
    // de passe) depuis n'importe quelle page, sans repasser par le dashboard.
    // Absent pour un admin, qui n'a pas de profil public/photo à gérer.
    if (utilisateurConnecte.role !== "admin") {
      ajouterLienNav("Mon compte", "mon-compte.html");
    }
  } else {
    lienConnexion.textContent = "Connexion";
  }
}

// Icône Taxi-moto dans la navigation, sur toutes les pages (la réservation
// elle-même reste ouverte à tous, la connexion n'est demandée qu'au moment
// de commander — même logique que pour une demande de service classique).
// Emoji plutôt qu'une image : pas de fichier à charger, donc pas de risque
// d'image cassée (chemin ou casse incorrecte) qui casse l'alignement.
// Inséré juste avant Connexion/Déconnexion (comme "Mon espace") plutôt qu'en
// tout premier — pour éviter tout style CSS propre au "premier" élément de
// la nav qui pourrait expliquer un désalignement.
if (nav) {
  const nomPageActuelle = window.location.pathname.split("/").pop();

  if (nomPageActuelle !== "taxi-moto.html") {
    const dansPages = window.location.pathname.includes("/pages/");
    const profondeur = dansPages ? "" : "pages/";

    const lienTaxi = document.createElement("a");
    lienTaxi.href = `${profondeur}taxi-moto.html`;
    lienTaxi.textContent = "🏍️ Taxi-moto";

    if (navToggle) {
      lienTaxi.addEventListener("click", () => {
        nav.classList.remove("nav-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    }

    const pointInsertion = document.querySelector('.nav a[href$="connexion.html"]');
    if (pointInsertion) {
      nav.insertBefore(lienTaxi, pointInsertion);
    } else {
      // Page sans lien connexion.html dans sa nav (ex: connexion.html elle-même)
      nav.appendChild(lienTaxi);
    }
  }
}
