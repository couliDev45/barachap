/**
 * cloudinary.js
 * Upload d'image directement depuis le navigateur vers Cloudinary (aucun
 * fichier ne transite par le backend Express — évite le problème du disque
 * éphémère de Render, et évite d'avoir à gérer l'upload multipart côté serveur).
 *
 * ⚠️ CONFIGURATION REQUISE avant que l'upload de photo fonctionne :
 * 1. Créez un compte gratuit sur https://cloudinary.com
 * 2. Sur le Dashboard, notez votre "Cloud Name" (en haut de la page)
 * 3. Allez dans Settings (⚙️) → Upload → faites défiler jusqu'à
 *    "Upload presets" → "Add upload preset"
 * 4. Réglez "Signing Mode" sur "Unsigned", donnez-lui un nom, enregistrez
 * 5. Remplacez les deux constantes ci-dessous par vos vraies valeurs
 *
 * Tant que ce n'est pas fait, uploaderImage() échoue proprement (retourne
 * null) — les formulaires qui l'utilisent continuent de fonctionner pour
 * les champs texte, seule la photo ne sera pas jointe.
 */

const CLOUDINARY_CLOUD_NAME = "VOTRE_CLOUD_NAME"; // à remplacer
const CLOUDINARY_UPLOAD_PRESET = "VOTRE_UPLOAD_PRESET"; // à remplacer

/**
 * Envoie un fichier image à Cloudinary et retourne son URL publique.
 * @param {File} fichier
 * @returns {Promise<string|null>} L'URL de l'image, ou null en cas d'échec.
 */
export async function uploaderImage(fichier) {
  if (!fichier) return null;

  if (CLOUDINARY_CLOUD_NAME === "VOTRE_CLOUD_NAME") {
    console.warn("Cloudinary n'est pas configuré (voir js/cloudinary.js) — photo ignorée.");
    return null;
  }

  const formData = new FormData();
  formData.append("file", fichier);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData },
    );

    if (!response.ok) {
      throw new Error(`Échec de l'upload (${response.status})`);
    }

    const data = await response.json();
    return data.secure_url || null;
  } catch (error) {
    console.warn("Échec de l'upload Cloudinary :", error.message);
    return null;
  }
}
