"use strict";
/*
 * Droits de modification.
 *
 * Chaque partie modifiable du hub a une « clé ». Une personne peut la
 * modifier si elle est administrateur, ou si elle (ou un de ses groupes
 * Active Directory) est nommée sur cette clé ou sur une clé parente.
 *
 *   intranet                         tout l'onglet Intranet
 *   intranet:<module>                un module de l'accueil (alerte, une, agenda…)
 *   intranet:service:<id>            tout un espace service (sa page et ses actualités)
 *   intranet:service:<id>:<module>   un module de cet espace
 *   tips, tips:reglages, tips:dossier:racine, tips:dossier:<id>
 *   hub, hub:reglages, hub:section:<id>
 *
 * Héritages particuliers : les actualités d'un espace sont aussi modifiables
 * par les personnes nommées sur « Actualités (toutes) » ; un dossier de guides
 * hérite des droits de ses dossiers parents.
 * Le contrôle est fait ici, côté serveur, à chaque modification.
 */
const { config } = require("./config");
const { correspond } = require("./annuaire");
const S = require("./schemas");

const ONGLETS = { intranet: "Intranet", tips: "Tips, IA & outils collaboratifs", hub: "Hub applicatif" };

function catalogue(data) {
  const c = [];
  const ajouter = (cle, libelle, onglet, niveau) => c.push({ cle, libelle, onglet, niveau });

  ajouter("intranet", "Tout l'onglet Intranet", "intranet", 0);
  for (const m of S.MODULES_ACCUEIL) ajouter("intranet:" + m.id, m.libelle, "intranet", 1);
  for (const s of data.intranet.services.elements) {
    ajouter("intranet:service:" + s.id, "Espace « " + s.nom + " » (tout)", "intranet", 1);
    for (const m of S.MODULES_SERVICE.concat([S.MODULE_ACTUALITES_SERVICE]))
      ajouter("intranet:service:" + s.id + ":" + m.id, m.libelle, "intranet", 2);
  }

  ajouter("tips", "Tout l'onglet Tips", "tips", 0);
  ajouter("tips:reglages", "Réglages : outils, thèmes, lien SharePoint", "tips", 1);
  ajouter("tips:dossier:racine", "Dossier racine « " + data.bibliotheque.titre + " »", "tips", 1);
  const dossiers = data.bibliotheque.dossiers;
  const profondeur = (d) => { let n = 0, p = d; while (p && p.parent && n < 20) { p = dossiers.find((x) => x.id === p.parent); n++; } return n; };
  (function parcourir(parent) {
    for (const d of dossiers.filter((x) => (x.parent || "") === parent)) {
      ajouter("tips:dossier:" + d.id, "Dossier « " + d.nom + " »", "tips", 2 + profondeur(d));
      parcourir(d.id);
    }
  })("");

  ajouter("hub", "Tout l'onglet Hub applicatif", "hub", 0);
  ajouter("hub:reglages", "Réglages : ordre des sections, documentation générale", "hub", 1);
  for (const s of data.hub.sections) ajouter("hub:section:" + s.id, "Section « " + s.title + " »", "hub", 2);
  return c;
}

// Clés qui donnent aussi le droit sur « cle » (elle-même, ses parents, l'onglet)
function cleEtParents(cle, data) {
  const res = [cle];
  const onglet = cle.split(":")[0];
  let m;
  if ((m = /^intranet:service:([^:]+):([a-z]+)$/.exec(cle))) {
    res.push("intranet:service:" + m[1]);
    if (m[2] === "actualites") res.push("intranet:actualites");
  }
  if ((m = /^tips:dossier:(.+)$/.exec(cle)) && m[1] !== "racine") {
    let d = data.bibliotheque.dossiers.find((x) => x.id === m[1]);
    let garde = 0;
    while (d && d.parent && garde++ < 20) {
      res.push("tips:dossier:" + d.parent);
      d = data.bibliotheque.dossiers.find((x) => x.id === d.parent);
    }
  }
  if (onglet !== cle) res.push(onglet);
  return res;
}

function estAdmin(u, droits) {
  if (!u) return false;
  return config.admins.some((p) => correspond(p, u)) || (droits.admins || []).some((p) => correspond(p, u));
}

function peut(u, cle, data, droits) {
  if (estAdmin(u, droits)) return true;
  return cleEtParents(cle, data).some((k) => ((droits.acl || {})[k] || []).some((p) => correspond(p, u)));
}

// Toutes les clés modifiables par u
function clesDe(u, data, droits) {
  if (estAdmin(u, droits)) return catalogue(data).map((e) => e.cle);
  return catalogue(data).map((e) => e.cle).filter((k) => peut(u, k, data, droits));
}

module.exports = { ONGLETS, catalogue, peut, estAdmin, clesDe, cleEtParents };
