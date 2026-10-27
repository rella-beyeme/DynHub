"use strict";
/*
 * Connexion des utilisateurs avec leur compte Windows (Active Directory).
 *
 *  - windows : SSO. Le navigateur prouve l'identité de la session Windows
 *              (Kerberos ou NTLM) : aucune saisie. Si le SSO échoue et que
 *              LDAP_URL est renseigné, un formulaire de secours est proposé.
 *  - ldap    : formulaire identifiant / mot de passe Windows, vérifié auprès
 *              d'un contrôleur de domaine.
 *  - demo    : choix d'un compte de test (jamais en production).
 *
 * La session (cookie signé) ne contient que l'identité. Les groupes AD sont
 * gardés côté serveur (voir lib/annuaire.js) et relus à l'expiration.
 */
const express = require("express");
const fs = require("fs");
const path = require("path");
const { config } = require("./config");
const annuaire = require("./annuaire");

const LOGO = (() => {
  try { return "data:image/png;base64," + fs.readFileSync(path.join(config.racine, "public", "ressources", "logo-dyneff.png")).toString("base64"); }
  catch (e) { return ""; }
})();

function echapper(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
// N'accepte qu'un chemin interne comme page de retour (pas de redirection ouverte)
function retourSur(v) {
  return typeof v === "string" && /^\/(?!\/)[^\s\\]*$/.test(v) ? v : "/";
}

function page(titre, corps) {
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>" + echapper(titre) + " · Dyneff</title><style>" +
    "body{margin:0;font-family:'Segoe UI',system-ui,Arial,sans-serif;background:#F5F6F8;color:#1C1F24;display:grid;place-items:center;min-height:100vh}" +
    "main{background:#fff;border:1px solid #E3E6EA;border-radius:16px;padding:28px;width:min(440px,calc(100% - 32px));box-sizing:border-box}" +
    ".bandeau{height:4px;display:flex;margin:-28px -28px 22px;border-radius:16px 16px 0 0;overflow:hidden}.bandeau i{flex:1}" +
    "img{height:40px;display:block;margin-bottom:14px}h1{font-size:1.25rem;margin:0 0 6px}p{color:#5A616B;margin:0 0 14px;font-size:.92rem;line-height:1.5}" +
    "label{display:block;font-weight:600;font-size:.85rem;margin:12px 0 4px}input{width:100%;box-sizing:border-box;font:inherit;padding:10px 12px;border:1px solid #BFC4CB;border-radius:10px}" +
    "input:focus{outline:3px solid #1A5FD6;outline-offset:1px}button,.bouton{display:inline-flex;justify-content:center;width:100%;box-sizing:border-box;margin-top:16px;font:inherit;font-weight:700;color:#fff;background:#018752;border:0;border-radius:22px;padding:11px 16px;cursor:pointer;text-decoration:none}" +
    ".comptes button{display:block;text-align:left;color:#1C1F24;background:#fff;border:1px solid #E3E6EA;border-radius:10px;margin-top:8px;font-weight:600}.comptes button:hover{border-color:#1C1F24}" +
    "small{display:block;color:#5A616B;font-weight:400;font-size:.8rem}.erreur{background:#FBEAED;color:#B3261E;border-radius:8px;padding:9px 12px;font-size:.88rem}" +
    ".alerte{background:#FFF4C2;color:#7A5C00;border-radius:8px;padding:8px 10px;font-size:.82rem}a{color:#1A4FB0}</style></head><body><main>" +
    '<div class="bandeau"><i style="background:#EF3125"></i><i style="background:#FFD203"></i><i style="background:#018752"></i></div>' +
    (LOGO ? '<img src="' + LOGO + '" alt="Dyneff">' : "") + corps + "</main></body></html>";
}

function formulaire(retour, message, login) {
  return page("Connexion", "<h1>Connexion à l'intranet</h1><p>Utilisez votre identifiant et votre mot de passe Windows.</p>" +
    (message ? '<p class="erreur" role="alert">' + echapper(message) + "</p>" : "") +
    '<form method="post" action="/connexion/formulaire"><input type="hidden" name="retour" value="' + echapper(retour) + '">' +
    '<label for="login">Identifiant Windows</label><input id="login" name="login" autocomplete="username" required placeholder="' +
    echapper((config.ldap.domaine || "DOMAINE") + "\\prenom.nom") + '" value="' + echapper(login || "") + '">' +
    '<label for="mdp">Mot de passe</label><input id="mdp" name="mdp" type="password" autocomplete="current-password" required>' +
    "<button>Se connecter</button></form>");
}

function pageSsoImpossible(retour, detail) {
  const secours = config.ldapActif
    ? '<a class="bouton" href="/connexion?formulaire=1&retour=' + encodeURIComponent(retour) + '">Se connecter avec mon identifiant Windows</a>'
    : "";
  return page("Connexion impossible", "<h1>Connexion Windows impossible</h1>" +
    "<p>Votre navigateur n'a pas transmis votre session Windows. Vérifiez que vous êtes connecté au réseau Dyneff avec votre compte, " +
    "et que l'adresse du hub fait partie de la zone « Intranet local » (voir la documentation).</p>" +
    (detail ? '<p class="erreur">' + echapper(detail) + "</p>" : "") + secours +
    '<p style="margin-top:14px"><a href="/connexion?retour=' + encodeURIComponent(retour) + '">Réessayer</a></p>');
}

// ---------- Enregistrement de la session ----------
function ouvrirSession(req, identite, groupes, source) {
  annuaire.memoriserGroupes(identite.id, groupes);
  req.session.utilisateur = Object.assign({}, identite, { source });
  req.session.debut = Date.now();
}

// Limite les essais de mot de passe (10 échecs / 15 min par identifiant et par poste)
const essais = new Map();
function trop(cle) {
  const e = essais.get(cle);
  if (!e || Date.now() - e.t > 15 * 60000) return false;
  return e.n >= 10;
}
function echec(cle) {
  const e = essais.get(cle);
  if (!e || Date.now() - e.t > 15 * 60000) essais.set(cle, { n: 1, t: Date.now() });
  else e.n++;
}

function routes() {
  const r = express.Router();
  const sso = config.modeConnexion === "windows" ? annuaire.middlewareSso() : null;

  r.get("/connexion", (req, res, next) => {
    const retour = retourSur(req.query.retour);
    res.set("Cache-Control", "no-store");

    if (config.modeConnexion === "demo") {
      const boutons = config.comptesDemo.map((c) =>
        '<button name="login" value="' + echapper(c.login) + '">' + echapper(c.nom) + "<small>" + echapper(c.login) +
        (c.groupes.length ? " · groupes : " + echapper(c.groupes.join(", ")) : "") + "</small></button>").join("");
      return res.type("html").send(page("Connexion (démo)", "<h1>Connexion — mode démonstration</h1>" +
        '<p class="alerte">Mode de test : aucune vérification Active Directory. À désactiver en production.</p>' +
        '<p>Choisissez un compte de test :</p><form class="comptes" method="post" action="/connexion/demo">' +
        '<input type="hidden" name="retour" value="' + echapper(retour) + '">' + boutons + "</form>"));
    }

    if (config.modeConnexion === "ldap" || (req.query.formulaire && config.ldapActif)) {
      return res.type("html").send(formulaire(retour));
    }

    // SSO Windows : si le navigateur ne sait pas répondre, il affiche cette page
    const finOrigine = res.end.bind(res);
    res.end = function (morceau, ...reste) {
      if (res.statusCode === 401 && !morceau && !res.headersSent) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return finOrigine(pageSsoImpossible(retour), ...reste);
      }
      return finOrigine(morceau, ...reste);
    };
    sso(req, res, (err) => {
      res.end = finOrigine;
      if (err) {
        console.warn("[connexion] SSO refusé :", err.message);
        return res.status(401).type("html").send(pageSsoImpossible(retour, "Le contrôleur de domaine a refusé la connexion."));
      }
      const user = req.sso && req.sso.user;
      if (!user || !user.name) return res.status(401).type("html").send(pageSsoImpossible(retour));
      const { identite, groupes } = annuaire.identiteDepuisSso(user);
      if (config.domainesAutorises.length && !config.domainesAutorises.includes(identite.domaine.toLowerCase())) {
        console.warn("[connexion] domaine refusé :", identite.id);
        return res.status(403).type("html").send(page("Accès refusé", "<h1>Accès refusé</h1><p>Le compte « " + echapper(identite.id) +
          " » n'appartient pas à un domaine autorisé. Ouvrez une session Windows avec votre compte Dyneff.</p>"));
      }
      ouvrirSession(req, identite, groupes, "sso");
      res.redirect(retour);
    });
  });

  r.post("/connexion/formulaire", express.urlencoded({ extended: false, limit: "4kb" }), async (req, res) => {
    const retour = retourSur(req.body.retour);
    if (!(config.modeConnexion === "ldap" || (config.modeConnexion === "windows" && config.ldapActif))) return res.status(404).end();
    const login = String(req.body.login || "").trim().slice(0, 120);
    const cle = (req.ip || "") + "|" + annuaire.loginCourt(login);
    if (trop(cle)) return res.status(429).type("html").send(formulaire(retour, "Trop de tentatives : réessayez dans quelques minutes.", login));
    try {
      const { identite, groupes } = await annuaire.authentifierLdap(login, String(req.body.mdp || ""));
      essais.delete(cle);
      ouvrirSession(req, identite, groupes, "ldap");
      res.redirect(retour);
    } catch (e) {
      echec(cle);
      const message = e instanceof annuaire.ErreurConnexion ? e.message : "L'annuaire Active Directory ne répond pas. Réessayez plus tard.";
      if (!(e instanceof annuaire.ErreurConnexion)) console.warn("[connexion] LDAP :", e.message);
      res.status(401).type("html").send(formulaire(retour, message, login));
    }
  });

  r.post("/connexion/demo", express.urlencoded({ extended: false, limit: "4kb" }), (req, res) => {
    if (config.modeConnexion !== "demo") return res.status(404).end();
    const c = config.comptesDemo.find((x) => x.login === String(req.body.login || ""));
    if (!c) return res.status(400).send("Compte inconnu.");
    const login = annuaire.loginCourt(c.login);
    const domaine = c.login.includes("\\") ? c.login.split("\\")[0] : "";
    ouvrirSession(req, { id: c.login.toLowerCase(), login, domaine, nom: c.nom, prenom: annuaire.prenomDe(c.nom), email: c.email }, c.groupes, "demo");
    res.redirect(retourSur(req.body.retour));
  });

  r.get("/deconnexion", (req, res) => {
    req.session = null;
    res.set("Cache-Control", "no-store").type("html").send(page("Déconnexion", "<h1>Vous êtes déconnecté</h1>" +
      (config.modeConnexion === "windows" ? "<p>Avec le SSO Windows, la reconnexion est automatique : il suffit de revenir sur le hub.</p>" : "") +
      '<a class="bouton" href="/connexion">Revenir sur le hub</a>'));
  });

  return r;
}

// Toutes les autres routes exigent une connexion ; on y joint les groupes AD
async function exigerConnexion(req, res, next) {
  const u = req.session && req.session.utilisateur;
  const refuser = () => {
    req.session = null;
    if (req.path.startsWith("/api/")) return res.status(401).json({ erreur: "Session expirée : rechargez la page pour vous reconnecter.", reconnecter: true });
    res.redirect("/connexion?retour=" + encodeURIComponent(req.originalUrl));
  };
  if (!u || !u.id) return refuser();
  let groupes = annuaire.groupesEnCache(u.id);
  if (!groupes) {
    try {
      if (u.source === "demo") {
        const c = config.comptesDemo.find((x) => x.login.toLowerCase() === u.id);
        groupes = c ? c.groupes : null;
      } else if (u.source === "ldap" && config.ldapRecherche) {
        groupes = await annuaire.relireGroupesLdap(u.login);
      }
    } catch (e) { console.warn("[connexion] relecture des groupes impossible :", e.message); groupes = null; }
    // En SSO, une nouvelle négociation (transparente) relit les groupes
    if (!groupes) return refuser();
    annuaire.memoriserGroupes(u.id, groupes);
    groupes = annuaire.groupesEnCache(u.id);
  }
  req.utilisateur = Object.assign({}, u, { groupes });
  next();
}

module.exports = { routes, exigerConnexion };
