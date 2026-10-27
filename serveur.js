"use strict";
/*
 * HUB DYNEFF — serveur
 * Démarrage : npm start   (configuration : fichier .env, voir config/production.env.modele)
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieSession = require("cookie-session");
const multer = require("multer");

const { config, verifier } = require("./lib/config");
const auth = require("./lib/auth");
const stockage = require("./lib/stockage");
const droitsLib = require("./lib/droits");
const contenus = require("./lib/contenus");

const erreursConfig = verifier();
if (erreursConfig.length) {
  console.error("Configuration incomplète :\n - " + erreursConfig.join("\n - "));
  process.exit(1);
}
stockage.initialiser();

const app = express();
app.disable("x-powered-by");
if (config.derriereProxy) app.set("trust proxy", 1);

// ---------- En-têtes de sécurité ----------
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "SAMEORIGIN",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": [
      "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:", "media-src 'self' blob:", "frame-src 'self' blob:",
      "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'self'",
      "form-action 'self' https://login.microsoftonline.com"
    ].join("; ")
  });
  if (config.urlPublique.startsWith("https://")) res.set("Strict-Transport-Security", "max-age=31536000");
  next();
});

app.use(cookieSession({
  name: "hub_session",
  keys: [config.secretSession],
  httpOnly: true,
  sameSite: "lax",
  secure: config.urlPublique.startsWith("https://"),
  maxAge: config.dureeSessionHeures * 3600 * 1000
}));

app.get("/sante", (req, res) => res.json({ ok: true }));
app.use(auth.routes());
app.use(auth.exigerConnexion);

// ---------- Protection des requêtes de modification ----------
const origineAttendue = new URL(config.urlPublique).origin;
app.use("/api", (req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") return next();
  const origine = req.get("origin");
  if (req.get("x-hub") !== "1" || (origine && origine !== origineAttendue))
    return res.status(403).json({ erreur: "Requête refusée." });
  next();
});

// ---------- Fichiers statiques (réservés aux personnes connectées) ----------
const statiques = { index: false, dotfiles: "deny", fallthrough: true };
app.use("/documents", express.static(config.dossierDocuments, statiques));
app.use("/images", express.static(config.dossierImages, statiques));
app.use("/ressources", express.static(path.join(__dirname, "public", "ressources"), statiques));

// ---------- Page ----------
const MODELE = path.join(__dirname, "public", "hub-applicatif.html");
const jsonScript = (v) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

function donneesPage(data) {
  const versCarte = (l) => Object.fromEntries((l || []).map((e) => [e.nom, { fond: e.fond, texte: e.texte }]));
  const B = data.bibliotheque;
  return "const ONGLETS = " + jsonScript(data.onglets) + ";\n" +
    "  const DOC_GENERALE = " + jsonScript(data.hub.docGenerale || "") + ";\n" +
    "  const HUB = " + jsonScript(data.hub.sections) + ";\n" +
    "  const INTRANET = " + jsonScript(data.intranet) + ";\n" +
    "  const BIBLIOTHEQUE = " + jsonScript({
      titre: B.titre, dossierFichiers: "documents/", lienSharePoint: B.lienSharePoint,
      outils: versCarte(B.outils), themes: versCarte(B.themes), dossiers: B.dossiers, fichiers: B.fichiers
    }) + ";\n";
}

function sessionPage(u, data, droits) {
  const admin = droitsLib.estAdmin(u, droits);
  const cat = droitsLib.catalogue(data);
  const cles = droitsLib.clesDe(u, data, droits);
  const sections = {};
  for (const cle of cles) {
    if (/^(intranet|tips|hub)$/.test(cle)) continue;
    const contenu = contenus.extraire(data, cle);
    sections[cle] = { libelle: (cat.find((e) => e.cle === cle) || {}).libelle || cle, contenu, empreinte: contenus.empreinte(contenu) };
  }
  return "const SESSION_HUB = " + jsonScript({
    utilisateur: { nom: u.nom, email: u.email }, admin, cles, sections,
    tailleMaxMo: config.tailleMaxMo, mode: config.modeConnexion
  }) + ";\n";
}

app.get("/", (req, res) => {
  const data = stockage.lireHub();
  const droits = stockage.lireDroits();
  const u = req.session.utilisateur;
  const html = fs.readFileSync(MODELE, "utf8")
    .replace("/*__DONNEES_HUB__*/", () => donneesPage(data))
    .replace("/*__SESSION_HUB__*/", () => sessionPage(u, data, droits));
  res.set("Cache-Control", "no-store").type("html").send(html);
});

// ---------- API ----------
const api = express.Router();
api.use(express.json({ limit: "2mb" }));
const moi = (req) => req.session.utilisateur;

function exigerDroit(req, cle) {
  const data = stockage.lireHub(), droits = stockage.lireDroits();
  if (!droitsLib.peut(moi(req), cle, data, droits)) {
    const e = new Error("Vous n'avez pas le droit de modifier cette partie."); e.statut = 403; throw e;
  }
}
function exigerAdmin(req) {
  if (!droitsLib.estAdmin(moi(req), stockage.lireDroits())) {
    const e = new Error("Réservé aux administrateurs du hub."); e.statut = 403; throw e;
  }
}
const asynchrone = (f) => (req, res, next) => Promise.resolve(f(req, res, next)).catch(next);

api.get("/moi", (req, res) => {
  const data = stockage.lireHub(), droits = stockage.lireDroits(), u = moi(req);
  res.json({ utilisateur: u, admin: droitsLib.estAdmin(u, droits), cles: droitsLib.clesDe(u, data, droits) });
});

// Corbeille : les fichiers retirés ne sont jamais effacés directement
function versCorbeille(chemins, u) {
  const dest = path.join(config.dossierDonnees, "corbeille");
  for (const c of chemins) {
    if (!fs.existsSync(c)) continue;
    const cible = path.join(dest, new Date().toISOString().replace(/[:.]/g, "-") + "-" + path.basename(c));
    deplacer(c, cible);
    stockage.journal(u, "corbeille", path.relative(config.racine, c));
  }
}
function deplacer(source, cible) {
  try { fs.renameSync(source, cible); }
  catch (e) {
    // Autre disque (EXDEV) ou fichier momentanément verrouillé sous Windows (EPERM/EBUSY) : copie puis suppression
    if (!["EXDEV", "EPERM", "EBUSY"].includes(e.code)) throw e;
    fs.copyFileSync(source, cible);
    try { fs.unlinkSync(source); } catch (e2) { /* le fichier temporaire sera nettoyé plus tard */ }
  }
}

// Chemin physique d'un dossier de la bibliothèque (contrôlé : reste dans « documents »)
function cheminDossier(data, id) {
  const segs = [];
  let d = id ? data.bibliotheque.dossiers.find((x) => x.id === id) : null, garde = 0;
  if (id && !d) contenus.erreur("Dossier introuvable.");
  while (d && garde++ < 20) { segs.unshift(d.chemin); d = d.parent ? data.bibliotheque.dossiers.find((x) => x.id === d.parent) : null; }
  const p = path.resolve(config.dossierDocuments, ...segs);
  if (p !== config.dossierDocuments && !p.startsWith(config.dossierDocuments + path.sep)) contenus.erreur("Chemin invalide.");
  return p;
}

api.put("/sections/:cle", asynchrone(async (req, res) => {
  const cle = String(req.params.cle);
  exigerDroit(req, cle);
  const u = moi(req);
  const retires = await stockage.modifierHub(u, { nom: "modification", detail: cle }, (data) => {
    const actuel = contenus.extraire(data, cle);
    if (req.body.empreinte !== contenus.empreinte(actuel)) {
      const e = new Error("Cette partie a été modifiée par quelqu'un d'autre entre-temps. Rechargez la page puis recommencez."); e.statut = 409; throw e;
    }
    const enleves = contenus.appliquer(data, cle, req.body.contenu);
    return enleves.map((f) => path.join(cheminDossier(data, f.dossier || ""), f.nom));
  });
  versCorbeille(retires, u);
  res.json({ ok: true });
}));

// --- Envoi de fichiers ---
const tmp = path.join(config.dossierDonnees, "tmp");
fs.mkdirSync(tmp, { recursive: true });
// Au démarrage, on vide les envois interrompus lors d'une session précédente
for (const n of fs.readdirSync(tmp)) { try { fs.unlinkSync(path.join(tmp, n)); } catch (e) { /* verrouillé : ignoré */ } }
const EXT_DOCUMENTS = ["pdf", "mp4", "webm", "m4v", "mov", "png", "jpg", "jpeg", "gif", "webp",
  "doc", "docx", "xls", "xlsx", "xlsm", "csv", "ppt", "pptx", "txt", "zip"];
const EXT_IMAGES = ["png", "jpg", "jpeg", "webp", "gif"];
const envoiDocuments = multer({ dest: tmp, limits: { fileSize: config.tailleMaxMo * 1024 * 1024, files: 1, fields: 10 } });
const envoiImages = multer({ dest: tmp, limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 } });

// multer reçoit le nom en latin1 : on le remet en UTF-8
const nomPropre = (nom) => nettoyerNom(Buffer.from(String(nom || ""), "latin1").toString("utf8"));
function nettoyerNom(n) {
  n = path.basename(String(n || "")).replace(/[\u0000-\u001F\u007F<>:"/\\|?*]/g, "_").replace(/^\.+/, "").trim();
  if (n.length > 180) { const ext = path.extname(n); n = n.slice(0, 180 - ext.length) + ext; }
  return n || "fichier";
}
function nomLibre(dossier, nom) {
  const ext = path.extname(nom), base = nom.slice(0, nom.length - ext.length);
  let n = nom, i = 2;
  while (fs.existsSync(path.join(dossier, n))) n = base + " (" + i++ + ")" + ext;
  return n;
}
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const nettoyerTmp = (req) => { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); };

api.post("/fichiers", envoiDocuments.single("fichier"), asynchrone(async (req, res) => {
  try {
    if (!req.file) contenus.erreur("Aucun fichier reçu.");
    const idDossier = contenus.txt(req.body.dossier, 60, "Dossier");
    exigerDroit(req, "tips:dossier:" + (idDossier || "racine"));
    const nom = nomPropre(req.file.originalname);
    const ext = path.extname(nom).slice(1).toLowerCase();
    if (!EXT_DOCUMENTS.includes(ext)) contenus.erreur("Type de fichier non accepté (." + ext + "). Formats acceptés : " + EXT_DOCUMENTS.join(", ") + ".");
    const u = moi(req);
    const final = await stockage.modifierHub(u, { nom: "ajout-fichier", detail: (idDossier || "racine") + "/" + nom }, (data) => {
      const B = data.bibliotheque;
      const outil = contenus.txt(req.body.outil, 40, "Outil"), theme = contenus.txt(req.body.theme, 40, "Thème");
      if (outil && !B.outils.some((o) => o.nom === outil)) contenus.erreur("Outil inconnu.");
      if (theme && !B.themes.some((t) => t.nom === theme)) contenus.erreur("Thème inconnu.");
      const dossier = cheminDossier(data, idDossier);
      fs.mkdirSync(dossier, { recursive: true });
      const libre = nomLibre(dossier, nom);
      deplacer(req.file.path, path.join(dossier, libre));
      B.fichiers.push({ nom: libre, dossier: idDossier, modifie: aujourdhui(), auteur: u.nom || u.email, outil, theme });
      return libre;
    });
    res.json({ ok: true, nom: final });
  } finally { nettoyerTmp(req); }
}));

api.post("/dossiers", asynchrone(async (req, res) => {
  const parent = contenus.txt(req.body.parent, 60, "Dossier parent");
  exigerDroit(req, "tips:dossier:" + (parent || "racine"));
  const nom = contenus.txt(req.body.nom, 80, "Nom du dossier", true);
  const u = moi(req);
  const id = await stockage.modifierHub(u, { nom: "ajout-dossier", detail: nom }, (data) => {
    const B = data.bibliotheque;
    if (parent && !B.dossiers.some((d) => d.id === parent)) contenus.erreur("Dossier parent introuvable.");
    const base = cheminDossier(data, parent);
    const chemin = nomLibre(base, nettoyerNom(nom));
    const idNouveau = contenus.idUnique(nom, B.dossiers.map((d) => d.id).concat(["racine"]));
    fs.mkdirSync(path.join(base, chemin), { recursive: true });
    B.dossiers.push({ id: idNouveau, nom, chemin, parent, couleur: contenus.couleur(req.body.couleur, "Couleur", "#2B79D0"), modifie: aujourdhui(), auteur: u.nom || u.email });
    return idNouveau;
  });
  res.json({ ok: true, id });
}));

api.delete("/dossiers/:id", asynchrone(async (req, res) => {
  const id = String(req.params.id);
  const data0 = stockage.lireHub();
  const d0 = data0.bibliotheque.dossiers.find((x) => x.id === id);
  if (!d0) return res.status(404).json({ erreur: "Dossier introuvable." });
  exigerDroit(req, "tips:dossier:" + (d0.parent || "racine"));
  await stockage.modifierHub(moi(req), { nom: "suppression-dossier", detail: d0.nom }, (data) => {
    const B = data.bibliotheque;
    if (B.fichiers.some((f) => f.dossier === id) || B.dossiers.some((x) => x.parent === id))
      contenus.erreur("Le dossier n'est pas vide : retirez d'abord ses fichiers et sous-dossiers.");
    const p = cheminDossier(data, id);
    B.dossiers = B.dossiers.filter((x) => x.id !== id);
    try { fs.rmdirSync(p); } catch (e) { /* dossier physique non vide ou absent : conservé */ }
  });
  res.json({ ok: true });
}));

api.post("/hub/sections", asynchrone(async (req, res) => {
  exigerDroit(req, "hub:reglages");
  const titre = contenus.txt(req.body.title, 80, "Titre de la section", true);
  const id = await stockage.modifierHub(moi(req), { nom: "ajout-section", detail: titre }, (data) => {
    const idN = contenus.idUnique(titre, data.hub.sections.map((s) => s.id));
    data.hub.sections.push({ id: idN, title: titre, subtitle: "", accent: "#2B5797", ferme: false, apps: [] });
    return idN;
  });
  res.json({ ok: true, id });
}));

api.delete("/hub/sections/:id", asynchrone(async (req, res) => {
  exigerDroit(req, "hub:reglages");
  const id = String(req.params.id);
  await stockage.modifierHub(moi(req), { nom: "suppression-section", detail: id }, (data) => {
    if (!data.hub.sections.some((s) => s.id === id)) contenus.erreur("Section introuvable.");
    data.hub.sections = data.hub.sections.filter((s) => s.id !== id);
  });
  res.json({ ok: true });
}));

api.post("/images", envoiImages.single("image"), asynchrone(async (req, res) => {
  try {
    if (!req.file) contenus.erreur("Aucune image reçue.");
    const data = stockage.lireHub(), droits = stockage.lireDroits();
    if (!droitsLib.clesDe(moi(req), data, droits).length) { const e = new Error("Action non autorisée."); e.statut = 403; throw e; }
    const ext = path.extname(nomPropre(req.file.originalname)).slice(1).toLowerCase();
    if (!EXT_IMAGES.includes(ext)) contenus.erreur("Image attendue (PNG, JPG, WEBP ou GIF).");
    const dossier = path.join(config.dossierImages, "envois");
    fs.mkdirSync(dossier, { recursive: true });
    const nom = crypto.randomBytes(8).toString("hex") + "." + ext;
    deplacer(req.file.path, path.join(dossier, nom));
    stockage.journal(moi(req), "ajout-image", nom);
    res.json({ ok: true, chemin: "images/envois/" + nom });
  } finally { nettoyerTmp(req); }
}));

// --- Administration des droits ---
api.get("/droits", (req, res) => {
  exigerAdmin(req);
  const data = stockage.lireHub(), droits = stockage.lireDroits();
  res.json({ catalogue: droitsLib.catalogue(data), acl: droits.acl || {}, admins: droits.admins || [], adminsFixes: config.adminsFixes, onglets: droitsLib.ONGLETS });
});

function personnes(v) {
  if (!Array.isArray(v) || v.length > 200) contenus.erreur("Liste de personnes invalide.");
  const vus = new Set();
  return v.map((p) => {
    const email = contenus.txt(p && p.email, 200, "E-mail").toLowerCase();
    const oid = contenus.txt(p && p.oid, 100, "Identifiant");
    if (!email && !oid) contenus.erreur("Chaque personne doit avoir un e-mail.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) contenus.erreur("E-mail invalide : « " + email + " ».");
    const k = oid || email;
    if (vus.has(k)) return null;
    vus.add(k);
    return { oid, email, nom: contenus.txt(p.nom, 120, "Nom") };
  }).filter(Boolean);
}

api.put("/droits/:cle", asynchrone(async (req, res) => {
  exigerAdmin(req);
  const cle = String(req.params.cle);
  const data = stockage.lireHub();
  if (!droitsLib.catalogue(data).some((e) => e.cle === cle)) contenus.erreur("Partie inconnue.");
  const liste = personnes(req.body.personnes);
  await stockage.modifierDroits(moi(req), { nom: "droits", detail: { cle, personnes: liste.map((p) => p.email) } }, (droits) => {
    droits.acl = droits.acl || {};
    if (liste.length) droits.acl[cle] = liste; else delete droits.acl[cle];
  });
  res.json({ ok: true });
}));

api.put("/admins", asynchrone(async (req, res) => {
  exigerAdmin(req);
  const liste = personnes(req.body.personnes);
  await stockage.modifierDroits(moi(req), { nom: "administrateurs", detail: liste.map((p) => p.email) }, (droits) => { droits.admins = liste; });
  res.json({ ok: true });
}));

api.get("/annuaire", asynchrone(async (req, res) => {
  exigerAdmin(req);
  const q = String(req.query.q || "").trim().slice(0, 60);
  if (q.length < 2) return res.json({ personnes: [] });
  res.json({ personnes: await auth.rechercherPersonnes(q) });
}));

app.use("/api", api);

// ---------- Erreurs ----------
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const m = err.code === "LIMIT_FILE_SIZE" ? "Fichier trop volumineux (maximum " + config.tailleMaxMo + " Mo)." : "Envoi de fichier invalide.";
    return res.status(400).json({ erreur: m });
  }
  if (err instanceof contenus.ErreurValidation) return res.status(400).json({ erreur: err.message });
  if (err.statut) return res.status(err.statut).json({ erreur: err.message });
  if (err.type === "entity.too.large") return res.status(413).json({ erreur: "Contenu trop volumineux." });
  console.error(err);
  res.status(500).json({ erreur: "Erreur interne du serveur." });
});

const serveurHttp = app.listen(config.port, () => {
  console.log("Hub Dyneff démarré sur le port " + config.port + " — " + config.urlPublique +
    (config.modeConnexion === "demo" ? "  [MODE DÉMO : connexion sans Microsoft]" : ""));
});
serveurHttp.on("error", (e) => {
  if (e.code === "EADDRINUSE") console.error("Le port " + config.port + " est déjà utilisé (le hub tourne peut-être déjà dans une autre fenêtre). Fermez-la, ou changez PORT et URL_PUBLIQUE dans le fichier .env.");
  else if (e.code === "EACCES") console.error("Le port " + config.port + " est refusé par Windows. Choisissez un autre PORT dans le fichier .env (ex. 3000 ou 8080).");
  else console.error(e);
  process.exit(1);
});
