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

    // "Mon espace" toujours accessible depuis n'importe quelle page une fois
    // connecté (avant, le tableau de bord n'était visible qu'une fois, juste
    // après la connexion — impossible d'y revenir en naviguant ailleurs).
    // Le préfixe (ex: "pages/" depuis l'accueil, "" depuis une page interne)
    // est déduit du lien Connexion existant, pour rester correct partout.
    const prefixe = lienConnexion.getAttribute("href").replace("connexion.html", "");
    const cibles = {
      admin: "dashboard-admin.html",
      prestataire: "dashboard-prestataire.html",
      client: "dashboard-client.html",
    };
    const cible = cibles[utilisateurConnecte.role] || cibles.client;
    const nomPageActuelle = window.location.pathname.split("/").pop();

    const dejaPresent = nav && (nav.querySelector(`a[href$="${cible}"]`) || nomPageActuelle === cible);

    if (nav && !dejaPresent) {
      const lienEspace = document.createElement("a");
      lienEspace.href = prefixe + cible;
      lienEspace.textContent = "Mon espace";
      if (navToggle) {
        lienEspace.addEventListener("click", () => {
          nav.classList.remove("nav-open");
          navToggle.setAttribute("aria-expanded", "false");
        });
      }
      nav.insertBefore(lienEspace, lienConnexion);
    }
  } else {
    lienConnexion.textContent = "Connexion";
  }
}

// Icône Taxi-moto dans la navigation, sur toutes les pages (la réservation
// elle-même reste ouverte à tous, la connexion n'est demandée qu'au moment
// de commander — même logique que pour une demande de service classique).
if (nav) {
  const nomPageActuelle = window.location.pathname.split("/").pop();

  if (nomPageActuelle !== "taxi-moto.html") {
    const dansPages = window.location.pathname.includes("/pages/");
    const profondeur = dansPages ? "" : "pages/";
    const prefixeAssets = dansPages ? "../" : "";

    const lienTaxi = document.createElement("a");
    lienTaxi.href = `${profondeur}taxi-moto.html`;
    lienTaxi.innerHTML = `<img src="${prefixeAssets}assets/icones/taxi-icon.jpg" alt="" style="width: 18px; height: 18px; vertical-align: middle; border-radius: 4px; margin-right: 6px; object-fit: cover;" />Taxi-moto`;

    if (navToggle) {
      lienTaxi.addEventListener("click", () => {
        nav.classList.remove("nav-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    }

    // Inséré en tête de nav pour une bonne visibilité
    nav.insertBefore(lienTaxi, nav.firstChild);
  }
}
