"use strict";
/*
 * Connexion des utilisateurs.
 *  - Mode « entra » : authentification Microsoft (Entra ID) par code
 *    d'autorisation + PKCE. Seuls les comptes du tenant Dyneff sont acceptés.
 *  - Mode « demo »  : choix d'un compte de démonstration (tests sans Entra).
 *    Refusé automatiquement si NODE_ENV=production.
 * La session ne contient que l'identité (oid, nom, e-mail) : aucun jeton.
 */
const express = require("express");
const msal = require("@azure/msal-node");
const { config } = require("./config");

let client = null;
const crypto = new msal.CryptoProvider();

function clientEntra() {
  if (!client) {
    client = new msal.ConfidentialClientApplication({
      auth: {
        clientId: config.clientId,
        authority: "https://login.microsoftonline.com/" + config.tenantId,
        clientSecret: config.clientSecret
      },
      system: { loggerOptions: { logLevel: msal.LogLevel.Warning, piiLoggingEnabled: false, loggerCallback: () => {} } }
    });
  }
  return client;
}

const REDIRECTION = () => config.urlPublique + "/auth/retour";
const SCOPES = ["openid", "profile", "email"];

// N'accepte qu'un chemin interne comme page de retour (pas de redirection ouverte)
function retourSur(v) {
  return typeof v === "string" && /^\/(?!\/)[^\s\\]*$/.test(v) ? v : "/";
}

function echapper(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function routes() {
  const r = express.Router();

  r.get("/connexion", async (req, res, next) => {
    try {
      const retour = retourSur(req.query.retour);
      if (config.modeConnexion === "demo") {
        const boutons = config.comptesDemo.map((c) =>
          '<button name="email" value="' + echapper(c.email) + '">' + echapper(c.nom) + "<small>" + echapper(c.email) + "</small></button>").join("");
        res.type("html").send(
          '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
          "<title>Connexion (démo)</title><style>body{font-family:Segoe UI,system-ui,Arial,sans-serif;background:#F5F6F8;margin:0;display:grid;place-items:center;min-height:100vh}" +
          "main{background:#fff;border:1px solid #E3E6EA;border-radius:16px;padding:28px;width:min(420px,calc(100% - 32px))}h1{font-size:1.2rem;margin:0 0 6px}p{color:#5A616B;margin:0 0 18px;font-size:.9rem}" +
          "button{display:block;width:100%;text-align:left;font:inherit;background:#fff;border:1px solid #E3E6EA;border-radius:10px;padding:10px 14px;margin:8px 0;cursor:pointer}" +
          "button:hover{border-color:#1C1F24}small{display:block;color:#5A616B;font-size:.8rem}.alerte{background:#FFF3C4;color:#8A5A00;border-radius:8px;padding:8px 10px;font-size:.82rem;margin-bottom:14px}</style>" +
          '<main><h1>Connexion — mode démonstration</h1><div class="alerte">Mode de test : aucune vérification Microsoft. À désactiver en production.</div>' +
          "<p>Choisissez un compte de test :</p>" +
          '<form method="post" action="/connexion/demo"><input type="hidden" name="retour" value="' + echapper(retour) + '">' + boutons + "</form></main></html>");
        return;
      }
      const pkce = await crypto.generatePkceCodes();
      const etat = crypto.createNewGuid();
      req.session.auth = { etat, verifier: pkce.verifier, retour };
      const url = await clientEntra().getAuthCodeUrl({
        scopes: SCOPES, redirectUri: REDIRECTION(), state: etat, responseMode: "query",
        codeChallenge: pkce.challenge, codeChallengeMethod: "S256", prompt: "select_account"
      });
      res.redirect(url);
    } catch (e) { next(e); }
  });

  r.post("/connexion/demo", express.urlencoded({ extended: false, limit: "4kb" }), (req, res) => {
    if (config.modeConnexion !== "demo") return res.status(404).end();
    const compte = config.comptesDemo.find((c) => c.email === String(req.body.email || "").toLowerCase());
    if (!compte) return res.status(400).send("Compte inconnu.");
    req.session.utilisateur = { oid: "demo:" + compte.email, nom: compte.nom, email: compte.email };
    res.redirect(retourSur(req.body.retour));
  });

  r.get("/auth/retour", async (req, res) => {
    const attendu = req.session.auth;
    req.session.auth = null;
    try {
      if (config.modeConnexion !== "entra") throw new Error("Mode de connexion incorrect.");
      if (req.query.error) throw new Error(String(req.query.error_description || req.query.error));
      if (!attendu || !req.query.state || req.query.state !== attendu.etat) throw new Error("État de connexion invalide ou expiré.");
      const resultat = await clientEntra().acquireTokenByCode({
        code: String(req.query.code || ""), scopes: SCOPES, redirectUri: REDIRECTION(), codeVerifier: attendu.verifier
      });
      const c = resultat.idTokenClaims || {};
      if (c.tid !== config.tenantId) throw new Error("Compte extérieur à l'organisation.");
      req.session.utilisateur = {
        oid: String(c.oid || ""),
        nom: String(c.name || c.preferred_username || ""),
        email: String(c.email || c.preferred_username || "").toLowerCase()
      };
      res.redirect(retourSur(attendu.retour));
    } catch (e) {
      console.warn("[connexion] échec :", e.message);
      res.status(401).type("html").send('<!doctype html><meta charset="utf-8"><title>Connexion impossible</title>' +
        '<p style="font-family:Segoe UI,Arial;margin:40px">La connexion a échoué. <a href="/connexion">Réessayer</a></p>');
    }
  });

  r.get("/deconnexion", (req, res) => {
    req.session = null;
    if (config.modeConnexion === "entra") {
      res.redirect("https://login.microsoftonline.com/" + config.tenantId + "/oauth2/v2.0/logout?post_logout_redirect_uri=" +
        encodeURIComponent(config.urlPublique + "/"));
    } else res.redirect("/");
  });

  return r;
}

// Toutes les autres routes exigent une connexion
function exigerConnexion(req, res, next) {
  if (req.session && req.session.utilisateur) return next();
  if (req.path.startsWith("/api/")) return res.status(401).json({ erreur: "Session expirée : reconnectez-vous." });
  res.redirect("/connexion?retour=" + encodeURIComponent(req.originalUrl));
}

// Recherche de personnes dans l'annuaire Entra (écran de gestion des droits)
let jetonGraph = null;
async function rechercherPersonnes(q) {
  if (config.modeConnexion !== "entra") {
    const t = q.toLowerCase();
    return config.comptesDemo.filter((c) => c.email.includes(t) || c.nom.toLowerCase().includes(t))
      .map((c) => ({ oid: "demo:" + c.email, nom: c.nom, email: c.email }));
  }
  if (!jetonGraph || jetonGraph.expire < Date.now() + 60000) {
    const r = await clientEntra().acquireTokenByClientCredential({ scopes: ["https://graph.microsoft.com/.default"] });
    jetonGraph = { valeur: r.accessToken, expire: r.expiresOn ? r.expiresOn.getTime() : Date.now() + 30 * 60000 };
  }
  const echappe = q.replace(/"/g, "");
  const url = "https://graph.microsoft.com/v1.0/users?$search=" +
    encodeURIComponent('"displayName:' + echappe + '" OR "mail:' + echappe + '"') +
    "&$select=id,displayName,mail,userPrincipalName&$top=12&$count=true&$filter=" + encodeURIComponent("accountEnabled eq true");
  const rep = await fetch(url, { headers: { Authorization: "Bearer " + jetonGraph.valeur, ConsistencyLevel: "eventual" } });
  if (!rep.ok) throw new Error("Annuaire Microsoft indisponible (" + rep.status + ").");
  const json = await rep.json();
  return (json.value || []).map((u) => ({ oid: u.id, nom: u.displayName || "", email: String(u.mail || u.userPrincipalName || "").toLowerCase() }));
}

module.exports = { routes, exigerConnexion, rechercherPersonnes };
