import winston from "winston";
import { signalerErreurServeur } from "./telegram.js";

const { combine, timestamp, printf, colorize } = winston.format;

const myFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}] ${message}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  format: combine(timestamp(), myFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp(), myFormat),
    }),
  ],
});

/**
 * Toute erreur passée à logger.error(...) (utilisée notamment par db.js pour
 * les erreurs de connexion PostgreSQL, et par le middleware d'authentification
 * pour les erreurs de configuration critiques) déclenche aussi une alerte
 * Telegram — sans ça, ces erreurs échappaient à la surveillance mise en
 * place dans server.js, qui n'intercepte que console.error.
 * L'appel original à logger.error continue de fonctionner normalement
 * (logs console inchangés), on ajoute juste l'envoi Telegram en plus.
 */
const loggerErrorOriginal = logger.error.bind(logger);
logger.error = (...args) => {
  loggerErrorOriginal(...args);

  const details = args
    .map((a) => (a instanceof Error ? a.stack || a.message : typeof a === "object" ? JSON.stringify(a) : String(a)))
    .join(" ");

  signalerErreurServeur(details).catch(() => {});
};

export default logger;
