"use strict";
/*
 * Lecture de la configuration : fichier « .env » à la racine du projet,
 * puis variables d'environnement du système (prioritaires).
 * Voir « config/production.env.modele » pour la liste commentée.
 */
const fs = require("fs");
const path = require("path");

const RACINE = path.resolve(__dirname, "..");

function lireEnv(fichier) {
  const valeurs = {};
  if (!fs.existsSync(fichier)) return valeurs;
  for (const ligne of fs.readFileSync(fichier, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(ligne);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    valeurs[m[1]] = v;
  }
  return valeurs;
}

const env = Object.assign(lireEnv(path.join(RACINE, ".env")), process.env);
const liste = (v) => String(v || "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);

const config = {
  racine: RACINE,
  port: parseInt(env.PORT || "3000", 10),
  urlPublique: (env.URL_PUBLIQUE || "http://localhost:3000").replace(/\/+$/, ""),
  production: env.NODE_ENV === "production",
  derriereProxy: env.DERRIERE_PROXY === "oui",

  // Connexion
  modeConnexion: (env.MODE_CONNEXION || "entra").toLowerCase(),   // "entra" ou "demo"
  tenantId: env.ENTRA_TENANT_ID || "",
  clientId: env.ENTRA_CLIENT_ID || "",
  clientSecret: env.ENTRA_CLIENT_SECRET || "",
  secretSession: env.SECRET_SESSION || "",
  dureeSessionHeures: parseFloat(env.DUREE_SESSION_HEURES || "10"),

  // Droits
  adminsFixes: liste(env.ADMINS).map((e) => e.toLowerCase()),

  // Fichiers
  tailleMaxMo: parseInt(env.TAILLE_MAX_MO || "500", 10),
  dossierDonnees: path.resolve(RACINE, env.DOSSIER_DONNEES || "data"),
  dossierDocuments: path.resolve(RACINE, env.DOSSIER_DOCUMENTS || "documents"),
  dossierImages: path.resolve(RACINE, env.DOSSIER_IMAGES || "images"),

  // Liens « Bureau » acceptés en plus de ms-*, msteams, onenote, mailto
  schemasSupplementaires: liste(env.SCHEMAS_BUREAU).map((s) => s.toLowerCase().replace(/:$/, "")),

  // Comptes de démonstration (MODE_CONNEXION=demo uniquement)
  comptesDemo: liste(env.COMPTES_DEMO).map((c) => {
    const [email, ...nom] = c.split(":");
    return { email: email.trim().toLowerCase(), nom: (nom.join(":") || email).trim() };
  })
};

function verifier() {
  const erreurs = [];
  const exemple = (v) => !v || /a-remplacer/i.test(v) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(v);
  if (!config.secretSession || config.secretSession.length < 32 || exemple(config.secretSession))
    erreurs.push("SECRET_SESSION doit contenir au moins 32 caractères aléatoires (pas la valeur d'exemple).");
  if (config.modeConnexion === "entra") {
    if (exemple(config.tenantId)) erreurs.push("ENTRA_TENANT_ID manquant ou laissé à la valeur d'exemple.");
    if (exemple(config.clientId)) erreurs.push("ENTRA_CLIENT_ID manquant ou laissé à la valeur d'exemple.");
    if (exemple(config.clientSecret)) erreurs.push("ENTRA_CLIENT_SECRET manquant ou laissé à la valeur d'exemple.");
  } else if (config.modeConnexion === "demo") {
    if (config.production) erreurs.push("MODE_CONNEXION=demo est interdit quand NODE_ENV=production.");
    if (!config.comptesDemo.length) erreurs.push("COMPTES_DEMO est vide (mode démo).");
  } else {
    erreurs.push("MODE_CONNEXION doit valoir « entra » ou « demo ».");
  }
  if (!config.adminsFixes.length) erreurs.push("ADMINS est vide : indiquez au moins une adresse e-mail d'administrateur.");
  return erreurs;
}

module.exports = { config, verifier };
