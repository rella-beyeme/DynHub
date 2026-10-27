"use strict";
/*
 * Stockage des contenus (data/hub.json) et des droits (data/droits.json).
 *  - écriture atomique (fichier temporaire puis renommage) ;
 *  - une copie de la version précédente dans data/historique/ à chaque
 *    modification (les 300 dernières sont conservées) ;
 *  - un journal des actions dans data/journal.log (une ligne JSON par action) ;
 *  - les modifications sont traitées l'une après l'autre (file d'attente).
 */
const fs = require("fs");
const path = require("path");
const { config } = require("./config");

const D = config.dossierDonnees;
const F_HUB = path.join(D, "hub.json");
const F_DROITS = path.join(D, "droits.json");
const D_HIST = path.join(D, "historique");
const F_JOURNAL = path.join(D, "journal.log");
const MAX_HISTORIQUE = 300;

function initialiser() {
  for (const d of [D, D_HIST, config.dossierDocuments, config.dossierImages, path.join(D, "corbeille")])
    fs.mkdirSync(d, { recursive: true });
  if (!fs.existsSync(F_HUB)) {
    const init = path.join(config.racine, "scripts", "donnees-initiales.json");
    fs.copyFileSync(init, F_HUB);
    console.log("[stockage] contenu initial créé :", F_HUB);
  }
  if (!fs.existsSync(F_DROITS)) ecrireJson(F_DROITS, { version: 2, admins: [], acl: {} });

  // Reprise automatique d'une installation de la version précédente
  const { migrerDonnees, migrerDroits } = require("./intranet-donnees");
  const data = lireJson(F_HUB);
  if (migrerDonnees(data)) {
    archiver(F_HUB, "hub-avant-migration", "systeme");
    ecrireJson(F_HUB, data);
    console.log("[stockage] intranet mis à jour vers la nouvelle version (ancien contenu archivé dans data/historique).");
  }
  const droits = lireJson(F_DROITS);
  if (migrerDroits(droits, data)) {
    archiver(F_DROITS, "droits-avant-migration", "systeme");
    ecrireJson(F_DROITS, droits);
    console.log("[stockage] droits repris de la version précédente.");
  }
}

function lireJson(f) { return JSON.parse(fs.readFileSync(f, "utf8")); }
function ecrireJson(f, donnees) {
  const tmp = f + ".tmp-" + process.pid + "-" + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(donnees, null, 2));
  renommerAvecReessai(tmp, f);
}

// Sous Windows, un antivirus ou l'indexation peut verrouiller un fichier
// quelques millisecondes : on réessaie le renommage avant d'abandonner.
function renommerAvecReessai(source, cible) {
  for (let essai = 0; ; essai++) {
    try { fs.renameSync(source, cible); return; }
    catch (e) {
      if (!["EPERM", "EBUSY", "EACCES"].includes(e.code) || essai >= 10) {
        try { fs.unlinkSync(source); } catch (e2) { /* déjà absent */ }
        throw e;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * (essai + 1));
    }
  }
}

let file = Promise.resolve();
function enSerie(travail) {
  const p = file.then(travail, travail);
  file = p.catch(() => {});
  return p;
}

function archiver(f, prefixe, auteur) {
  if (!fs.existsSync(f)) return;
  const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
  const qui = String(auteur || "").replace(/[^a-z0-9@._-]/gi, "_").slice(0, 60);
  fs.copyFileSync(f, path.join(D_HIST, prefixe + "-" + horodatage + "-" + qui + ".json"));
  const anciens = fs.readdirSync(D_HIST).filter((n) => n.startsWith(prefixe + "-")).sort();
  for (const n of anciens.slice(0, Math.max(0, anciens.length - MAX_HISTORIQUE))) fs.unlinkSync(path.join(D_HIST, n));
}

function journal(utilisateur, action, detail) {
  const ligne = JSON.stringify({ date: new Date().toISOString(), qui: utilisateur && (utilisateur.id || utilisateur.email), action, detail }) + "\n";
  fs.appendFile(F_JOURNAL, ligne, () => {});
}

const lireHub = () => lireJson(F_HUB);

// Sondage : votes anonymes (empreinte du compte), remis à zéro quand la question change
const F_SONDAGE = path.join(D, "sondage.json");
function lireSondage() { try { return lireJson(F_SONDAGE); } catch (e) { return { version: "", votes: {} }; } }
function voter(version, votant, option) {
  return enSerie(() => {
    let s = lireSondage();
    if (s.version !== version) s = { version, votes: {} };
    s.votes[votant] = option;
    ecrireJson(F_SONDAGE, s);
    return s;
  });
}
const lireDroits = () => lireJson(F_DROITS);

// modifier(f) : f reçoit une copie des données, la modifie et la renvoie
function modifierHub(utilisateur, action, f) {
  return enSerie(() => {
    const donnees = lireHub();
    const resultat = f(donnees);
    archiver(F_HUB, "hub", utilisateur && (utilisateur.login || utilisateur.email));
    donnees.version = (donnees.version || 0) + 1;
    ecrireJson(F_HUB, donnees);
    journal(utilisateur, action.nom, action.detail);
    return resultat;
  });
}
function modifierDroits(utilisateur, action, f) {
  return enSerie(() => {
    const droits = lireDroits();
    const resultat = f(droits);
    archiver(F_DROITS, "droits", utilisateur && (utilisateur.login || utilisateur.email));
    ecrireJson(F_DROITS, droits);
    journal(utilisateur, action.nom, action.detail);
    return resultat;
  });
}

module.exports = { initialiser, lireHub, lireDroits, modifierHub, modifierDroits, enSerie, journal, lireSondage, voter };
