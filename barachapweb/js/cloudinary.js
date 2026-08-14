const CLOUDINARY_CLOUD_NAME = "ydfqdm6d";

const CLOUDINARY_UPLOAD_PRESET = "barachap_upload";

/**

 * Envoie un fichier image à Cloudinary et retourne son URL publique.

 * @param {File} fichier

 * @returns {Promise<string|null>}

 */

export async function uploaderImage(fichier) {

  if (!fichier) return null;

  const formData = new FormData();

  formData.append("file", fichier);

  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  try {

    const response = await fetch(

      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,

      {

        method: "POST",

        body: formData,

      }

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
