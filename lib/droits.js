"use strict";
/*
 * Droits de modification.
 *
 * Chaque partie modifiable du hub a une « clé » :
 *   intranet                      tout l'onglet Intranet
 *   intranet:accueil              titre, photo, légende, annuaire, lien « tout le contenu »
 *   intranet:sites                liste des sites (ajouter, retirer, réordonner)
 *   intranet:site:<id>            un site (nom, adresse, affichage)
 *   intranet:liens                liens de l'entreprise
 *   intranet:annonces             annonces
 *   tips                          tout l'onglet Tips
 *   tips:reglages                 titre, lien SharePoint, outils et thèmes
 *   tips:dossier:racine           fichiers à la racine + création de dossiers à la racine
 *   tips:dossier:<id>             un dossier ET ses sous-dossiers
 *   hub                           tout l'onglet Hub applicatif
 *   hub:reglages                  documentation générale, ordre, ajout/suppression de sections
 *   hub:section:<id>              une section et ses applications
 *
 * Une personne peut modifier une clé si elle est administrateur, ou si elle
 * est nommée sur cette clé, sur l'onglet entier, ou (dossiers) sur un dossier parent.
 * Le contrôle est fait ici, côté serveur, à chaque modification.
 */
const { config } = require("./config");

const ONGLETS = { intranet: "Intranet", tips: "Tips, IA & outils collaboratifs", hub: "Hub applicatif" };

function catalogue(data) {
  const c = [];
  const ajouter = (cle, libelle, onglet, niveau) => c.push({ cle, libelle, onglet, niveau });
  ajouter("intranet", "Tout l'onglet Intranet", "intranet", 0);
  ajouter("intranet:accueil", "Accueil : titre, photo, annuaire", "intranet", 1);
  ajouter("intranet:sites", "Liste des sites (ajouter, retirer, réordonner)", "intranet", 1);
  for (const s of data.intranet.sites) ajouter("intranet:site:" + s.id, "Site « " + s.nom + " »", "intranet", 2);
  ajouter("intranet:liens", "Liens de l'entreprise", "intranet", 1);
  ajouter("intranet:annonces", "Annonces", "intranet", 1);

  ajouter("tips", "Tout l'onglet Tips", "tips", 0);
  ajouter("tips:reglages", "Réglages : outils, thèmes, lien SharePoint", "tips", 1);
  ajouter("tips:dossier:racine", "Dossier racine « " + data.bibliotheque.titre + " »", "tips", 1);
  const dossiers = data.bibliotheque.dossiers;
  const profondeur = (d) => { let n = 0, p = d; while (p && p.parent && n < 20) { p = dossiers.find((x) => x.id === p.parent); n++; } return n; };
  const ordonnes = [];
  (function parcourir(parent) {
    for (const d of dossiers.filter((x) => (x.parent || "") === parent)) { ordonnes.push(d); parcourir(d.id); }
  })("");
  for (const d of ordonnes) ajouter("tips:dossier:" + d.id, "Dossier « " + d.nom + " »" + (profondeur(d) ? " (sous-dossier)" : ""), "tips", 2 + profondeur(d));

  ajouter("hub", "Tout l'onglet Hub applicatif", "hub", 0);
  ajouter("hub:reglages", "Réglages : ordre des sections, documentation générale", "hub", 1);
  for (const s of data.hub.sections) ajouter("hub:section:" + s.id, "Section « " + s.title + " »", "hub", 2);
  return c;
}

// Clés qui donnent aussi le droit sur « cle » (elle-même, ses parents, l'onglet)
function cleEtParents(cle, data) {
  const res = [cle];
  const onglet = cle.split(":")[0];
  const m = /^tips:dossier:(.+)$/.exec(cle);
  if (m && m[1] !== "racine") {
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

function correspond(personne, u) {
  if (!personne || !u) return false;
  if (personne.oid && u.oid && personne.oid === u.oid) return true;
  return !!(personne.email && u.email && personne.email.toLowerCase() === u.email.toLowerCase());
}

function estAdmin(u, droits) {
  if (!u) return false;
  if (u.email && config.adminsFixes.includes(u.email.toLowerCase())) return true;
  return (droits.admins || []).some((p) => correspond(p, u));
}

function peut(u, cle, data, droits) {
  if (estAdmin(u, droits)) return true;
  return cleEtParents(cle, data).some((k) => ((droits.acl || {})[k] || []).some((p) => correspond(p, u)));
}

// Toutes les clés modifiables par u
function clesDe(u, data, droits) {
  return catalogue(data).map((e) => e.cle).filter((k) => peut(u, k, data, droits));
}

module.exports = { ONGLETS, catalogue, peut, estAdmin, clesDe, correspond };
