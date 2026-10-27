"use strict";
/*
 * Crée le fichier .env de la VM de test s'il n'existe pas encore, à partir de
 * config/vm-test.env.modele, avec une clé de session aléatoire.
 * Si un .env de la version précédente existe (connexion Microsoft / démo sans
 * groupes), il est sauvegardé en .env.v1 puis remplacé : la clé de session,
 * le port, l'adresse, les dossiers et les administrateurs sont repris.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const racine = path.resolve(__dirname, "..");
const cible = path.join(racine, ".env");
const modele = path.join(racine, "config", "vm-test.env.modele");

function lire(fichier) {
  const v = {};
  for (const l of fs.readFileSync(fichier, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m) v[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return v;
}

let contenu = fs.readFileSync(modele, "utf8");
const remplacer = (cle, valeur) => {
  const re = new RegExp("^" + cle + "=.*$", "m");
  const v = /[\s,"\\]/.test(valeur) ? '"' + valeur.replace(/"/g, "") + '"' : valeur;
  contenu = contenu.replace(re, () => cle + "=" + v);
};

if (fs.existsSync(cible)) {
  const ancien = lire(cible);
  if (ancien.CONFIG_VERSION === "2") {
    console.log("Configuration existante conservée : .env");
    process.exit(0);
  }
  fs.copyFileSync(cible, cible + ".v1");
  for (const cle of ["SECRET_SESSION", "PORT", "URL_PUBLIQUE", "TAILLE_MAX_MO", "DOSSIER_DONNEES", "DOSSIER_DOCUMENTS", "DOSSIER_IMAGES", "SCHEMAS_BUREAU"])
    if (ancien[cle] && !/a-remplacer/.test(ancien[cle])) remplacer(cle, ancien[cle]);
  const admins = new Set(lire(modele).ADMINS.split(",").map((s) => s.trim()).filter(Boolean));
  for (const a of String(ancien.ADMINS || "").split(",").map((s) => s.trim()).filter(Boolean)) admins.add(a);
  remplacer("ADMINS", Array.from(admins).join(", "));
  console.log("Ancienne configuration sauvegardée en .env.v1 et remplacée (connexion Active Directory).");
}
if (contenu.includes("__GENEREE_A_L_INSTALLATION__"))
  contenu = contenu.replace("__GENEREE_A_L_INSTALLATION__", crypto.randomBytes(48).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 64));
fs.writeFileSync(cible, contenu, { mode: 0o600 });
const url = (/^URL_PUBLIQUE=(.*)$/m.exec(contenu) || [])[1] || "http://localhost:3000";
console.log("Configuration de test prête : .env (connexion Windows / Active Directory, " + url.replace(/"/g, "") + ")");
