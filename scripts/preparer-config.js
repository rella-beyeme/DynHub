"use strict";
/*
 * Crée le fichier .env de la VM de test s'il n'existe pas encore,
 * à partir de config/vm-test.env.modele, avec une clé de session aléatoire.
 * Ne modifie jamais un .env existant.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const racine = path.resolve(__dirname, "..");
const cible = path.join(racine, ".env");
const modele = path.join(racine, "config", "vm-test.env.modele");

if (fs.existsSync(cible)) {
  console.log("Configuration existante conservée : .env");
  process.exit(0);
}
const secret = crypto.randomBytes(48).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 64);
const contenu = fs.readFileSync(modele, "utf8").replace("__GENEREE_A_L_INSTALLATION__", secret);
fs.writeFileSync(cible, contenu, { mode: 0o600 });
console.log("Configuration de test créée : .env (mode démonstration, http://localhost:3000)");
