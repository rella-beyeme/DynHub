"use strict";
/*
 * Active Directory : identité des utilisateurs, groupes, recherche.
 *
 *  - SSO Windows (MODE_CONNEXION=windows) : node-expose-sspi négocie
 *    Kerberos/NTLM avec le navigateur et fournit le compte, son nom et ses
 *    groupes de sécurité (y compris imbriqués).
 *  - LDAP (formulaire, ou recherche de personnes) : ldapts interroge un
 *    contrôleur de domaine.
 *
 * Les groupes d'un utilisateur sont gardés en mémoire côté serveur (et dans
 * data/cache-groupes.json) : le cookie de session ne contient que l'identité.
 */
const fs = require("fs");
const path = require("path");
const { config } = require("./config");

// ---------- Normalisation ----------
// « DYNFR\GG_Intranet_RH », « CN=GG_Intranet_RH,OU=…,DC=… » → « GG_Intranet_RH »
function nomGroupe(g) {
  let t = String(g || "").trim();
  const dn = /^CN=((?:\\,|[^,])+)/i.exec(t);
  if (dn) t = dn[1].replace(/\\,/g, ",");
  if (t.includes("\\")) t = t.slice(t.lastIndexOf("\\") + 1);
  return t;
}
// « DYNFR\jdupont », « jdupont@dynfr.local », « jdupont » → « jdupont »
function loginCourt(id) {
  let t = String(id || "").trim().toLowerCase();
  if (t.includes("\\")) t = t.slice(t.lastIndexOf("\\") + 1);
  if (t.includes("@")) t = t.slice(0, t.indexOf("@"));
  return t;
}
function prenomDe(nom, givenName) {
  if (givenName) return givenName;
  const n = String(nom || "").trim();
  if (n.includes(",")) return n.split(",")[1].trim().split(/\s+/)[0] || n;
  return n.split(/\s+/)[0] || n;
}
// Échappement des valeurs dans un filtre LDAP (RFC 4515)
function esc(v) {
  return String(v).replace(/[\\*()\u0000]/g, (c) => "\\" + c.charCodeAt(0).toString(16).padStart(2, "0"));
}
const premier = (v) => (Array.isArray(v) ? v[0] : v) || "";

// ---------- Correspondance d'une personne des droits avec l'utilisateur ----------
// Personne : { type: "utilisateur"|"groupe", id, email, nom }  (ancien format : { oid, email, nom })
function correspond(personne, u) {
  if (!personne || !u) return false;
  if (personne.type === "groupe") {
    const g = nomGroupe(personne.id).toLowerCase();
    return !!g && (u.groupes || []).some((x) => x.toLowerCase() === g);
  }
  if (personne.id && u.login && loginCourt(personne.id) === u.login.toLowerCase()) return true;
  if (personne.oid && u.id && personne.oid === u.id) return true;
  return !!(personne.email && u.email && personne.email.toLowerCase() === u.email.toLowerCase());
}

// ---------- Cache des groupes ----------
const F_CACHE = () => path.join(config.dossierDonnees, "cache-groupes.json");
let cache = {};
try { cache = JSON.parse(fs.readFileSync(F_CACHE(), "utf8")); } catch (e) { cache = {}; }
let minuteur = null;
function sauverCache() {
  clearTimeout(minuteur);
  minuteur = setTimeout(() => {
    try { fs.writeFileSync(F_CACHE(), JSON.stringify(cache)); } catch (e) { /* non bloquant */ }
  }, 500);
}
function memoriserGroupes(idUtilisateur, groupes) {
  cache[idUtilisateur] = { groupes: Array.from(new Set((groupes || []).map(nomGroupe).filter(Boolean))), t: Date.now() };
  sauverCache();
}
function groupesEnCache(idUtilisateur) {
  const c = cache[idUtilisateur];
  if (!c || Date.now() - c.t > config.dureeGroupesHeures * 3600 * 1000) return null;
  return c.groupes;
}
// Groupes déjà rencontrés à la connexion (proposés dans l'écran des droits)
function groupesConnus(q) {
  const t = String(q || "").toLowerCase();
  const tous = new Set();
  for (const c of Object.values(cache)) for (const g of c.groupes || []) if (g.toLowerCase().includes(t)) tous.add(g);
  return Array.from(tous).sort().slice(0, 15);
}

// ---------- SSO Windows (node-expose-sspi) ----------
let sspi = null;
function chargerSspi() {
  if (sspi) return sspi;
  if (process.platform !== "win32")
    throw new Error("MODE_CONNEXION=windows fonctionne seulement sur un serveur Windows. Utilisez MODE_CONNEXION=ldap (formulaire Active Directory) ou demo.");
  try { sspi = require("node-expose-sspi"); }
  catch (e) { throw new Error("Le module de SSO Windows (node-expose-sspi) n'est pas installé : relancez installer.bat. Détail : " + e.message); }
  return sspi;
}
function middlewareSso() {
  return chargerSspi().sso.auth({
    useActiveDirectory: true, useGroups: true, groupFilterRegex: ".*",
    forceNTLM: config.forcerNtlm, allowsGuest: false, allowsAnonymousLogon: false
  });
}
function etatDomaine() {
  try { const s = chargerSspi().sso; return { surDomaine: s.isOnDomain(), adJoignable: s.isOnDomain() && s.isActiveDirectoryReachable() }; }
  catch (e) { return { erreur: e.message }; }
}
function identiteDepuisSso(user) {
  const ad = user.adUser || {};
  const domaine = String(user.domain || "");
  const login = String(user.name || "");
  const nom = user.displayName || premier(ad.displayName) || premier(ad.cn) || login;
  return {
    identite: {
      id: ((domaine ? domaine + "\\" : "") + login).toLowerCase(), login: login.toLowerCase(), domaine,
      nom, prenom: prenomDe(nom, premier(ad.givenName)), email: String(premier(ad.mail)).toLowerCase()
    },
    groupes: user.groups || []
  };
}
async function rechercherSspi(q) {
  const e = esc(q);
  const lignes = await chargerSspi().sso.getUsers("(|(displayName=*" + e + "*)(sAMAccountName=" + e + "*)(mail=" + e + "*))");
  return lignes.slice(0, 15).map((r) => ({
    type: "utilisateur", id: (config.ldap.domaine ? config.ldap.domaine + "\\" : "") + premier(r.sAMAccountName),
    nom: premier(r.displayName) || premier(r.sAMAccountName), email: String(premier(r.mail)).toLowerCase()
  }));
}

// ---------- LDAP (ldapts) ----------
let ldapts = null;
function client() {
  if (!ldapts) ldapts = require("ldapts");
  const options = { url: config.ldap.url, timeout: config.ldap.delaiMs, connectTimeout: config.ldap.delaiMs };
  // Attention : ldapts passe en TLS dès que tlsOptions est fourni, même en ldap://
  if (/^ldaps:/i.test(config.ldap.url)) options.tlsOptions = { rejectUnauthorized: !config.ldap.tlsNonVerifie };
  return new ldapts.Client(options);
}
let baseDetectee = "";
async function baseDn(c) {
  if (config.ldap.baseDn) return config.ldap.baseDn;
  if (baseDetectee) return baseDetectee;
  const r = await c.search("", { scope: "base", filter: "(objectClass=*)", attributes: ["defaultNamingContext"] });
  baseDetectee = premier(r.searchEntries[0] && r.searchEntries[0].defaultNamingContext);
  if (!baseDetectee) throw new Error("Impossible de détecter LDAP_BASE_DN : renseignez-le dans .env.");
  return baseDetectee;
}
const ATTRS_UTILISATEUR = ["sAMAccountName", "displayName", "givenName", "mail", "distinguishedName", "userAccountControl"];

async function lireUtilisateur(c, base, sam) {
  const r = await c.search(base, {
    scope: "sub", sizeLimit: 2, attributes: ATTRS_UTILISATEUR,
    filter: "(&(objectCategory=person)(objectClass=user)(sAMAccountName=" + esc(sam) + "))"
  });
  return r.searchEntries[0] || null;
}
async function groupesLdap(c, base, dn) {
  // 1.2.840.113556.1.4.1941 = appartenance en chaîne (groupes imbriqués) propre à Active Directory
  const r = await c.search(base, {
    scope: "sub", paged: { pageSize: 500 }, attributes: ["cn", "sAMAccountName"],
    filter: "(&(objectClass=group)(member:1.2.840.113556.1.4.1941:=" + esc(dn) + "))"
  });
  return r.searchEntries.map((g) => premier(g.sAMAccountName) || premier(g.cn)).filter(Boolean);
}
function identiteDepuisLdap(e) {
  const login = String(premier(e.sAMAccountName));
  const nom = premier(e.displayName) || login;
  return {
    id: ((config.ldap.domaine ? config.ldap.domaine + "\\" : "") + login).toLowerCase(), login: login.toLowerCase(),
    domaine: config.ldap.domaine, nom, prenom: prenomDe(nom, premier(e.givenName)), email: String(premier(e.mail)).toLowerCase()
  };
}
const COMPTE_DESACTIVE = 0x2;

class ErreurConnexion extends Error {}

async function authentifierLdap(saisie, motDePasse) {
  const brut = String(saisie || "").trim();
  const sam = loginCourt(brut);
  // Un mot de passe vide ouvrirait une liaison anonyme : refusé
  if (!sam || !motDePasse) throw new ErreurConnexion("Identifiant et mot de passe obligatoires.");
  if (!/^[a-z0-9._-]{1,64}$/i.test(sam)) throw new ErreurConnexion("Identifiant invalide.");
  const c = client();
  try {
    const dnLiaison = brut.includes("@") ? brut : config.ldap.domaine + "\\" + sam;
    try { await c.bind(dnLiaison, motDePasse); }
    catch (e) { throw new ErreurConnexion("Identifiant ou mot de passe incorrect."); }
    const base = await baseDn(c);
    const e = await lireUtilisateur(c, base, sam);
    if (!e) throw new ErreurConnexion("Compte introuvable dans l'annuaire.");
    if (parseInt(premier(e.userAccountControl) || "0", 10) & COMPTE_DESACTIVE) throw new ErreurConnexion("Compte désactivé.");
    return { identite: identiteDepuisLdap(e), groupes: await groupesLdap(c, base, premier(e.distinguishedName)) };
  } finally {
    try { await c.unbind(); } catch (e) { /* déjà fermé */ }
  }
}

async function avecCompteService(travail) {
  if (!config.ldapRecherche) return null;
  const c = client();
  try {
    await c.bind(config.ldap.compteService, config.ldap.motDePasseService);
    return await travail(c, await baseDn(c));
  } finally {
    try { await c.unbind(); } catch (e) { /* déjà fermé */ }
  }
}

// Relit les groupes d'un utilisateur (session encore valide, cache expiré)
async function relireGroupesLdap(login) {
  return avecCompteService(async (c, base) => {
    const e = await lireUtilisateur(c, base, login);
    return e ? groupesLdap(c, base, premier(e.distinguishedName)) : null;
  });
}

async function rechercherLdap(q) {
  return avecCompteService(async (c, base) => {
    const e = esc(q);
    const r = await c.search(base, {
      scope: "sub", sizeLimit: 25, attributes: ["objectClass", "sAMAccountName", "displayName", "cn", "mail"],
      filter: "(|(&(objectCategory=person)(objectClass=user)(|(displayName=*" + e + "*)(sAMAccountName=" + e + "*)(mail=" + e + "*)))" +
        "(&(objectClass=group)(|(cn=*" + e + "*)(sAMAccountName=" + e + "*))))"
    });
    return (r.searchEntries || []).slice(0, 20).map((x) => {
      const classes = [].concat(x.objectClass || []).map((v) => String(v).toLowerCase());
      if (classes.includes("group")) return { type: "groupe", id: premier(x.sAMAccountName) || premier(x.cn), nom: premier(x.cn) || premier(x.sAMAccountName) };
      return { type: "utilisateur", id: (config.ldap.domaine ? config.ldap.domaine + "\\" : "") + premier(x.sAMAccountName),
        nom: premier(x.displayName) || premier(x.sAMAccountName), email: String(premier(x.mail)).toLowerCase() };
    });
  });
}

// ---------- Recherche pour l'écran des droits ----------
async function rechercher(q) {
  const t = String(q || "").trim();
  if (config.modeConnexion === "demo") {
    const m = t.toLowerCase();
    const comptes = config.comptesDemo.filter((c) => c.login.toLowerCase().includes(m) || c.nom.toLowerCase().includes(m))
      .map((c) => ({ type: "utilisateur", id: c.login, nom: c.nom, email: c.email }));
    const groupes = Array.from(new Set(config.comptesDemo.flatMap((c) => c.groupes))).filter((g) => g.toLowerCase().includes(m))
      .map((g) => ({ type: "groupe", id: g, nom: g }));
    return { resultats: comptes.concat(groupes), source: "comptes de démonstration" };
  }
  let resultats = null, source = "";
  if (config.ldapRecherche) { resultats = await rechercherLdap(t); source = "annuaire Active Directory"; }
  else if (config.modeConnexion === "windows") {
    try { resultats = await rechercherSspi(t); source = "annuaire Active Directory (comptes)"; }
    catch (e) { resultats = []; source = "saisie manuelle"; }
  }
  resultats = resultats || [];
  // Groupes déjà vus à la connexion d'un utilisateur
  for (const g of groupesConnus(t)) if (!resultats.some((r) => r.type === "groupe" && r.id.toLowerCase() === g.toLowerCase()))
    resultats.push({ type: "groupe", id: g, nom: g });
  return { resultats, source: source || "saisie manuelle" };
}

module.exports = {
  nomGroupe, loginCourt, prenomDe, correspond, esc,
  memoriserGroupes, groupesEnCache, groupesConnus,
  middlewareSso, chargerSspi, etatDomaine, identiteDepuisSso,
  authentifierLdap, relireGroupesLdap, rechercher, ErreurConnexion
};
