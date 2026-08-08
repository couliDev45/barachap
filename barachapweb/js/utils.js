/**
 * utils.js
 * Fonctions utilitaires réutilisables à travers le site BaraChap.
 */

/**
 * Récupère et parse une valeur JSON depuis le localStorage.
 * Retourne une valeur par défaut si la clé est absente ou si le JSON est corrompu.
 * @param {string} cle - La clé du localStorage.
 * @param {*} valeurParDefaut - La valeur à retourner en cas d'échec (ex: []).
 * @returns {*}
 */
export function lireStockage(cle, valeurParDefaut = null) {
  try {
    const donneesStockees = localStorage.getItem(cle);
    if (!donneesStockees) return valeurParDefaut;

    const donnees = JSON.parse(donneesStockees);
    return donnees;
  } catch (erreur) {
    console.error(
      `Erreur lors de la lecture de "${cle}" dans le localStorage :`,
      erreur,
    );
    return valeurParDefaut;
  }
}

/**
 * Enregistre une valeur (sera convertie en JSON) dans le localStorage.
 * @param {string} cle - La clé du localStorage.
 * @param {*} valeur - La valeur à enregistrer.
 * @returns {boolean} true si la sauvegarde a réussi, false sinon.
 */
export function ecrireStockage(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch (erreur) {
    console.error(
      `Erreur lors de l'écriture de "${cle}" dans le localStorage :`,
      erreur,
    );
    return false;
  }
}

/**
 * Affiche un message de succès ou d'erreur dans un élément donné,
 * puis l'efface automatiquement après un délai.
 * @param {HTMLElement} element - L'élément où afficher le message.
 * @param {string} texte - Le texte à afficher.
 * @param {"success"|"error"} type - Le type de message.
 * @param {number} delai - Délai en ms avant effacement (défaut 5000).
 */
export function afficherMessage(
  element,
  texte,
  type = "success",
  delai = 5000,
) {
  if (!element) return;

  element.textContent = texte;
  element.classList.remove("success", "error");
  element.classList.add(type);

  setTimeout(() => {
    element.classList.remove("success", "error");
    element.textContent = "";
  }, delai);
}

/**
 * Affiche une notification flottante (toast) avec icône selon le type.
 * Nécessite dans le HTML : <div id="notification"><span id="notification-message"></span></div>
 * @param {string} message - Le texte à afficher.
 * @param {"success"|"error"|"warning"} type - Le type de notification.
 */
export function afficherNotification(message, type = "success") {
  const notification = document.querySelector("#notification");
  const texte = document.querySelector("#notification-message");

  if (!notification || !texte) return;

  let prefixe = "";

  switch (type) {
    case "success":
      prefixe = "[Succès] ";
      break;
    case "error":
      prefixe = "[Erreur] ";
      break;
    case "warning":
      prefixe = "[Attention] ";
      break;
  }

  texte.textContent = prefixe + message;

  notification.className = "notification";

  if (type !== "success") {
    notification.classList.add(type);
  }

  notification.classList.add("show");

  setTimeout(() => {
    notification.classList.remove("show");
  }, 3000);
}

/**
 * Retourne la date du jour au format "YYYY-MM-DD",
 * utile pour l'attribut min d'un champ input[type="date"].
 * @returns {string}
 */
export function obtenirDateAujourdhui() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Vérifie qu'un ensemble de champs du DOM existent tous.
 * Retourne le premier champ manquant (nom + élément), ou null si tout est présent.
 * @param {Object<string, HTMLElement|null>} champs - Dictionnaire nom -> élément.
 * @returns {[string, HTMLElement|null]|null}
 */
export function trouverChampManquant(champs) {
  const champManquant = Object.entries(champs).find(([, element]) => !element);
  return champManquant || null;
}
