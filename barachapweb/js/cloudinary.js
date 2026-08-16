/**
 * cloudinary.js
 * Upload de fichiers (image ou audio) directement depuis le navigateur vers
 * Cloudinary (aucun fichier ne transite par le backend Express — évite le
 * problème du disque éphémère de Render, et évite d'avoir à gérer l'upload
 * multipart côté serveur).
 *
 * Configuré avec le compte Cloudinary du projet (cloud name + upload preset
 * non signé ci-dessous). Ces deux valeurs sont sans risque à exposer
 * côté client — c'est justement le principe d'un upload preset "Unsigned" :
 * aucune clé secrète n'est nécessaire ni présente ici.
 */

const CLOUDINARY_CLOUD_NAME = "ydfqdm6d";
const CLOUDINARY_UPLOAD_PRESET = "barachap_upload";

async function uploaderVersCloudinary(fichier, typeRessource) {
  if (!fichier) return null;

  const formData = new FormData();
  formData.append("file", fichier);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${typeRessource}/upload`,
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

/**
 * Envoie un fichier image à Cloudinary et retourne son URL publique.
 * @param {File} fichier
 * @returns {Promise<string|null>} L'URL de l'image, ou null en cas d'échec.
 */
export async function uploaderImage(fichier) {
  return uploaderVersCloudinary(fichier, "image");
}

/**
 * Envoie un fichier audio (note vocale) à Cloudinary et retourne son URL
 * publique. Cloudinary héberge l'audio sous son type "video" — c'est normal,
 * pas une erreur, leur pipeline audio est rattaché à ce type de ressource.
 * @param {Blob} fichierAudio
 * @returns {Promise<string|null>} L'URL de l'audio, ou null en cas d'échec.
 */
export async function uploaderAudio(fichierAudio) {
  return uploaderVersCloudinary(fichierAudio, "video");
}
