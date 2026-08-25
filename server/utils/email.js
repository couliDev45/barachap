/**
 * email.js
 * Envoi d'emails via SMTP (Nodemailer). Configuré par défaut pour Gmail
 * (avec un mot de passe d'application), mais fonctionne avec n'importe
 * quel service SMTP (Brevo, SendGrid...) en changeant les variables
 * d'environnement — voir LISEZ-MOI.md pour la marche à suivre complète.
 *
 * Variables d'environnement nécessaires :
 * - SMTP_HOST (ex: smtp.gmail.com)
 * - SMTP_PORT (ex: 587)
 * - SMTP_USER (ex: contact@barachap.ci ou une adresse Gmail)
 * - SMTP_PASS (mot de passe d'application, jamais le mot de passe normal)
 * - SMTP_FROM (adresse affichée comme expéditeur, souvent = SMTP_USER)
 */

import nodemailer from "nodemailer";
import dotenv from "dotenv";
import logger from "./logger.js";

dotenv.config();

let transporteur = null;

function obtenirTransporteur() {
  if (transporteur) return transporteur;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  transporteur = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465, // true pour le port 465, false pour 587 (STARTTLS)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporteur;
}

/**
 * Envoie l'email de réinitialisation de mot de passe.
 * Ne lève jamais d'exception : retourne true/false, à l'appelant de décider
 * quoi faire (voir auth.routes.js, qui répond toujours un message générique
 * à l'utilisateur quel que soit le résultat, pour ne pas révéler si un
 * compte existe ou non).
 */
export async function envoyerEmailReinitialisation(destinataire, nomComplet, lienReinitialisation) {
  const transport = obtenirTransporteur();

  if (!transport) {
    logger.error("Envoi email impossible : variables SMTP non configurées (SMTP_HOST/SMTP_USER/SMTP_PASS).");
    return false;
  }

  const prenom = (nomComplet || "").split(" ")[0] || "";

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: destinataire,
      subject: "Réinitialisation de votre mot de passe BaraChap",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #2C3E50;">Réinitialisation de mot de passe</h2>
          <p>Bonjour ${prenom},</p>
          <p>Vous avez demandé à réinitialiser votre mot de passe sur BaraChap. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :</p>
          <p style="text-align: center; margin: 32px 0;">
            <a href="${lienReinitialisation}" style="background-color: #FF8C42; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Réinitialiser mon mot de passe
            </a>
          </p>
          <p style="font-size: 13px; color: #666;">Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email — votre mot de passe actuel reste inchangé.</p>
          <p style="font-size: 13px; color: #999; margin-top: 24px;">— L'équipe BaraChap</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    logger.error("Échec de l'envoi de l'email de réinitialisation : " + err.message);
    return false;
  }
}
