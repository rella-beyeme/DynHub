"use strict";
/*
 * Lecture et validation des contenus modifiables, section par section.
 * Toute donnée envoyée par le navigateur est vérifiée ici avant d'être
 * enregistrée : textes limités, adresses web contrôlées (pas de javascript:),
 * structure imposée. Une erreur arrête la modification sans rien enregistrer.
 */
const crypto = require("crypto");
const { config } = require("./config");

class ErreurValidation extends Error {}
const erreur = (m) => { throw new ErreurValidation(m); };

// ---------- Contrôles élémentaires ----------
function txt(v, max, nomChamp, obligatoire) {
  if (v == null) v = "";
  if (typeof v !== "string") erreur("Champ « " + nomChamp + " » invalide.");
  v = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (obligatoire && !v) erreur("Le champ « " + nomChamp + " » est obligatoire.");
  if (v.length > max) erreur("Le champ « " + nomChamp + " » dépasse " + max + " caractères.");
  return v;
}
function url(v, nomChamp) {
  v = txt(v, 2000, nomChamp);
  if (!v) return "";
  let u;
  try { u = new URL(v); } catch (e) { erreur("Adresse invalide pour « " + nomChamp + " » (elle doit commencer par http:// ou https://)."); }
  if (u.protocol !== "http:" && u.protocol !== "https:") erreur("« " + nomChamp + " » : seules les adresses http:// et https:// sont acceptées.");
  return v;
}
const SCHEMAS_BUREAU = /^(ms-[a-z]+|msteams|onenote|mailto)$/;
function lienBureau(v, nomChamp) {
  v = txt(v, 2000, nomChamp);
  if (!v) return "";
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(v);
  if (!m) erreur("« " + nomChamp + " » : lien de logiciel invalide (ex. msteams:, ms-word:nft|u|https://…).");
  const s = m[1].toLowerCase();
  if (s === "http" || s === "https") return url(v, nomChamp);
  if (!SCHEMAS_BUREAU.test(s) && !config.schemasSupplementaires.includes(s))
    erreur("« " + nomChamp + " » : le type de lien « " + s + ": » n'est pas autorisé (voir SCHEMAS_BUREAU).");
  return v;
}
function image(v, nomChamp) {
  v = txt(v, 2000, nomChamp);
  if (!v) return "";
  if (/^images\/[A-Za-z0-9._\- /]+$/.test(v) && !v.includes("..")) return v;
  return url(v, nomChamp);
}
function couleur(v, nomChamp, defaut) {
  v = txt(v, 7, nomChamp) || defaut || "";
  if (v && !/^#[0-9a-f]{6}$/i.test(v)) erreur("« " + nomChamp + " » : couleur au format #RRVVBB attendue.");
  return v;
}
function date(v, nomChamp) {
  v = txt(v, 10, nomChamp);
  if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) erreur("« " + nomChamp + " » : date au format AAAA-MM-JJ attendue.");
  return v;
}
const bool = (v) => v === true;
function liste(v, max, nomChamp) {
  if (v == null) return [];
  if (!Array.isArray(v)) erreur("Liste « " + nomChamp + " » invalide.");
  if (v.length > max) erreur("La liste « " + nomChamp + " » dépasse " + max + " éléments.");
  return v.map((e) => (e && typeof e === "object" ? e : erreur("Élément invalide dans « " + nomChamp + " ».")));
}
function objet(v, nomChamp) { return v && typeof v === "object" && !Array.isArray(v) ? v : erreur("Contenu « " + nomChamp + " » invalide."); }

function slug(t) {
  return (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "element";
}
function idUnique(base, existants) {
  let id = slug(base), n = 2;
  while (existants.includes(id)) id = slug(base) + "-" + n++;
  return id;
}
function empreinte(contenu) {
  return crypto.createHash("sha256").update(JSON.stringify(contenu)).digest("hex").slice(0, 16);
}

// ---------- Lecture d'une section ----------
function dossierOuErreur(data, id) {
  const d = data.bibliotheque.dossiers.find((x) => x.id === id);
  if (!d) erreur("Dossier introuvable.");
  return d;
}
function extraire(data, cle) {
  const I = data.intranet, B = data.bibliotheque, H = data.hub;
  let m;
  if (cle === "intranet:accueil") return { titre: I.titre, legende: I.legende, photo: I.photo, toutLeContenu: I.toutLeContenu, annuaire: I.annuaire };
  if (cle === "intranet:sites") return { sites: I.sites };
  if ((m = /^intranet:site:(.+)$/.exec(cle))) {
    const s = I.sites.find((x) => x.id === m[1]); if (!s) erreur("Site introuvable.");
    return { nom: s.nom, url: s.url, barre: s.barre, liste: s.liste };
  }
  if (cle === "intranet:liens") return { liens: I.liens };
  if (cle === "intranet:annonces") return { annonces: I.annonces };
  if (cle === "tips:reglages") return { titre: B.titre, lienSharePoint: B.lienSharePoint, outils: B.outils, themes: B.themes };
  if ((m = /^tips:dossier:(.+)$/.exec(cle))) {
    const id = m[1] === "racine" ? "" : m[1];
    const d = id ? dossierOuErreur(data, id) : null;
    return { nom: d ? d.nom : B.titre, couleur: d ? d.couleur : "", fichiers: B.fichiers.filter((f) => (f.dossier || "") === id) };
  }
  if (cle === "hub:reglages") return { docGenerale: H.docGenerale, ordre: H.sections.map((s) => ({ id: s.id, title: s.title })) };
  if ((m = /^hub:section:(.+)$/.exec(cle))) {
    const s = H.sections.find((x) => x.id === m[1]); if (!s) erreur("Section introuvable.");
    return { title: s.title, subtitle: s.subtitle, accent: s.accent, ferme: s.ferme, apps: s.apps };
  }
  erreur("Partie inconnue.");
}

// ---------- Enregistrement d'une section ----------
// Renvoie la liste des fichiers retirés (à mettre à la corbeille) le cas échéant.
function appliquer(data, cle, c) {
  c = objet(c, "section");
  const I = data.intranet, B = data.bibliotheque, H = data.hub;
  let m;

  if (cle === "intranet:accueil") {
    const a = objet(c.annuaire || {}, "annuaire");
    I.titre = txt(c.titre, 120, "Titre");
    I.legende = txt(c.legende, 300, "Légende");
    I.photo = image(c.photo, "Photo");
    I.toutLeContenu = url(c.toutLeContenu, "Tout le contenu du site");
    I.annuaire = { url: url(a.url, "Adresse de l'annuaire"), parametre: txt(a.parametre, 40, "Paramètre de recherche") };
    return [];
  }
  if (cle === "intranet:sites") {
    const anciens = I.sites.map((s) => s.id);
    const ids = [];
    I.sites = liste(c.sites, 300, "Sites").map((s) => {
      let id = typeof s.id === "string" && anciens.includes(s.id) && !ids.includes(s.id) ? s.id : idUnique(s.nom, anciens.concat(ids));
      ids.push(id);
      return { id, nom: txt(s.nom, 80, "Nom du site", true), url: url(s.url, "Adresse du site"), barre: bool(s.barre), liste: s.liste !== false };
    });
    return [];
  }
  if ((m = /^intranet:site:(.+)$/.exec(cle))) {
    const s = I.sites.find((x) => x.id === m[1]); if (!s) erreur("Site introuvable.");
    s.nom = txt(c.nom, 80, "Nom du site", true); s.url = url(c.url, "Adresse du site");
    s.barre = bool(c.barre); s.liste = c.liste !== false;
    return [];
  }
  if (cle === "intranet:liens") {
    I.liens = liste(c.liens, 50, "Liens").map((l) => ({ nom: txt(l.nom, 80, "Nom du lien", true), url: url(l.url, "Adresse du lien") }));
    return [];
  }
  if (cle === "intranet:annonces") {
    I.annonces = liste(c.annonces, 50, "Annonces").map((a) => ({
      titre: txt(a.titre, 160, "Titre de l'annonce", true), auteur: txt(a.auteur, 80, "Auteur"),
      texte: txt(a.texte, 1500, "Texte"), url: url(a.url, "Lien de l'annonce")
    }));
    return [];
  }
  if (cle === "tips:reglages") {
    const etiquettes = (v, nom) => {
      const vus = new Set();
      return liste(v, 60, nom).map((e) => {
        const n = txt(e.nom, 40, "Nom de l'étiquette", true);
        if (vus.has(n)) erreur("Étiquette en double : « " + n + " ».");
        vus.add(n);
        return { nom: n, fond: couleur(e.fond, "Couleur de fond", "#EDEFF2"), texte: couleur(e.texte, "Couleur du texte", "#39404A") };
      });
    };
    B.titre = txt(c.titre, 80, "Titre", true);
    B.lienSharePoint = url(c.lienSharePoint, "Lien SharePoint");
    B.outils = etiquettes(c.outils, "Outils");
    B.themes = etiquettes(c.themes, "Thèmes");
    return [];
  }
  if ((m = /^tips:dossier:(.+)$/.exec(cle))) {
    const id = m[1] === "racine" ? "" : m[1];
    if (id) {
      const d = dossierOuErreur(data, id);
      d.nom = txt(c.nom, 80, "Nom du dossier", true);
      d.couleur = couleur(c.couleur, "Couleur", "#2B79D0");
    }
    const actuels = B.fichiers.filter((f) => (f.dossier || "") === id);
    const outils = B.outils.map((o) => o.nom), themes = B.themes.map((t) => t.nom);
    const vus = new Set();
    const nouveaux = liste(c.fichiers, 2000, "Fichiers").map((f) => {
      const nom = txt(f.nom, 255, "Nom du fichier", true);
      const ancien = actuels.find((a) => a.nom === nom);
      if (!ancien) erreur("Fichier inconnu dans ce dossier : « " + nom + " ». Utilisez « Ajouter un document » pour en déposer un nouveau.");
      if (vus.has(nom)) erreur("Fichier en double : « " + nom + " ».");
      vus.add(nom);
      const outil = txt(f.outil, 40, "Outil"), theme = txt(f.theme, 40, "Thème");
      if (outil && !outils.includes(outil)) erreur("Outil inconnu : « " + outil + " ».");
      if (theme && !themes.includes(theme)) erreur("Thème inconnu : « " + theme + " ».");
      return { nom, dossier: id, modifie: date(f.modifie, "Date"), auteur: txt(f.auteur, 80, "Modifié par"), outil, theme };
    });
    const retires = actuels.filter((a) => !vus.has(a.nom));
    B.fichiers = B.fichiers.filter((f) => (f.dossier || "") !== id).concat(nouveaux);
    return retires;
  }
  if (cle === "hub:reglages") {
    H.docGenerale = url(c.docGenerale, "Documentation générale");
    const ordre = liste(c.ordre, 200, "Ordre").map((e) => e.id);
    const actuels = H.sections.map((s) => s.id);
    if (ordre.length !== actuels.length || !actuels.every((id) => ordre.includes(id))) erreur("L'ordre des sections ne correspond pas aux sections existantes. Rechargez la page.");
    H.sections = ordre.map((id) => H.sections.find((s) => s.id === id));
    return [];
  }
  if ((m = /^hub:section:(.+)$/.exec(cle))) {
    const s = H.sections.find((x) => x.id === m[1]); if (!s) erreur("Section introuvable.");
    s.title = txt(c.title, 80, "Titre de la section", true);
    s.subtitle = txt(c.subtitle, 160, "Sous-titre");
    s.accent = couleur(c.accent, "Couleur", "#EF3125");
    s.ferme = bool(c.ferme);
    s.apps = liste(c.apps, 150, "Applications").map((a) => ({
      name: txt(a.name, 80, "Nom de l'application", true), desc: txt(a.desc, 160, "Description"),
      url: url(a.url, "Lien en ligne"), desktop: lienBureau(a.desktop, "Lien bureau"),
      logo: image(a.logo, "Logo"), doc: url(a.doc, "Documentation")
    }));
    return [];
  }
  erreur("Partie inconnue.");
}

module.exports = { extraire, appliquer, empreinte, ErreurValidation, erreur, txt, slug, idUnique, couleur };
