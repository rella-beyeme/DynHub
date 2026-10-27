"use strict";
/*
 * Lecture de la configuration : fichier « .env » à la racine du projet,
 * puis variables d'environnement du système (prioritaires).
 * Voir « config/production.env.modele » pour la liste commentée.
 */
const fs = require("fs");
const path = require("path");

const RACINE = path.resolve(__dirname, "..");

function lireEnv(fichier) {
  const valeurs = {};
  if (!fs.existsSync(fichier)) return valeurs;
  for (const ligne of fs.readFileSync(fichier, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(ligne);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    valeurs[m[1]] = v;
  }
  return valeurs;
}

const env = Object.assign(lireEnv(path.join(RACINE, ".env")), process.env);
const liste = (v) => String(v || "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);
const oui = (v) => /^(oui|yes|true|1)$/i.test(String(v || "").trim());

/*
 * Une « personne » de la configuration (ADMINS, droits) peut être :
 *   DOMAINE\login   ou  login           → un compte Windows
 *   groupe:NOM      ou  groupe:DOM\NOM  → un groupe Active Directory
 *   prenom.nom@dyneff.fr                → une adresse e-mail (attribut mail de l'AD)
 */
function lirePersonne(texte) {
  const t = String(texte || "").trim();
  if (!t) return null;
  if (/^groupe:/i.test(t)) return { type: "groupe", id: t.slice(7).trim(), nom: t.slice(7).trim() };
  if (t.includes("@")) return { type: "utilisateur", id: "", email: t.toLowerCase(), nom: t };
  return { type: "utilisateur", id: t, nom: t };
}

/*
 * Comptes de démonstration : « DOMAINE\login:Nom affiché:groupe1|groupe2 »
 * séparés par des virgules. (Ancien format accepté : « email:Nom ».)
 */
function lireComptesDemo(v) {
  return liste(v).map((c) => {
    const [login, nom, groupes] = c.split(":");
    const l = String(login || "").trim();
    const email = l.includes("@") ? l.toLowerCase() : "";
    return {
      login: l, nom: (nom || l).trim(), email,
      groupes: String(groupes || "").split("|").map((g) => g.trim()).filter(Boolean)
    };
  }).filter((c) => c.login);
}

const config = {
  racine: RACINE,
  port: parseInt(env.PORT || "3000", 10),
  urlPublique: (env.URL_PUBLIQUE || "http://localhost:3000").replace(/\/+$/, ""),
  production: env.NODE_ENV === "production",
  derriereProxy: oui(env.DERRIERE_PROXY),

  // Connexion : windows (SSO), ldap (formulaire Active Directory) ou demo
  modeConnexion: (env.MODE_CONNEXION || "windows").toLowerCase(),
  secretSession: env.SECRET_SESSION || "",
  dureeSessionHeures: parseFloat(env.DUREE_SESSION_HEURES || "10"),
  forcerNtlm: oui(env.FORCER_NTLM),
  domainesAutorises: liste(env.DOMAINES_AUTORISES).map((d) => d.toLowerCase()),
  dureeGroupesHeures: parseFloat(env.GROUPES_DUREE_HEURES || "8"),

  // Annuaire Active Directory (LDAP) : formulaire de connexion et recherche de personnes
  ldap: {
    url: env.LDAP_URL || "",                       // ldaps://dc01.dynfr.local:636
    baseDn: env.LDAP_BASE_DN || "",                // DC=dynfr,DC=local (vide = détection automatique)
    domaine: env.LDAP_DOMAINE || "",               // DYNFR (nom NetBIOS du domaine)
    compteService: env.LDAP_COMPTE_SERVICE || "",  // DYNFR\svc-hub (lecture seule de l'annuaire)
    motDePasseService: env.LDAP_MOT_DE_PASSE_SERVICE || "",
    tlsNonVerifie: oui(env.LDAP_TLS_NON_VERIFIE),
    delaiMs: parseInt(env.LDAP_DELAI_MS || "8000", 10)
  },

  // Droits
  admins: liste(env.ADMINS).map(lirePersonne).filter(Boolean),

  // Fichiers
  tailleMaxMo: parseInt(env.TAILLE_MAX_MO || "500", 10),
  dossierDonnees: path.resolve(RACINE, env.DOSSIER_DONNEES || "data"),
  dossierDocuments: path.resolve(RACINE, env.DOSSIER_DOCUMENTS || "documents"),
  dossierImages: path.resolve(RACINE, env.DOSSIER_IMAGES || "images"),

  // Liens « Bureau » acceptés en plus de ms-*, msteams, onenote, mailto
  schemasSupplementaires: liste(env.SCHEMAS_BUREAU).map((s) => s.toLowerCase().replace(/:$/, "")),

  comptesDemo: lireComptesDemo(env.COMPTES_DEMO)
};
config.ldapActif = !!config.ldap.url;
config.ldapRecherche = config.ldapActif && !!config.ldap.compteService && !!config.ldap.motDePasseService;

function verifier() {
  const erreurs = [];
  const exemple = (v) => !v || /a-remplacer/i.test(v);
  if (!config.secretSession || config.secretSession.length < 32 || exemple(config.secretSession))
    erreurs.push("SECRET_SESSION doit contenir au moins 32 caractères aléatoires (pas la valeur d'exemple).");
  const m = config.modeConnexion;
  if (m === "entra") {
    erreurs.push("MODE_CONNEXION=entra n'existe plus : utilisez « windows » (SSO Active Directory), « ldap » (formulaire Active Directory) ou « demo ».");
  } else if (m === "ldap") {
    if (!config.ldapActif) erreurs.push("MODE_CONNEXION=ldap : LDAP_URL est obligatoire (ex. ldaps://controleur.dynfr.local:636).");
    if (!config.ldap.domaine) erreurs.push("MODE_CONNEXION=ldap : LDAP_DOMAINE est obligatoire (nom court du domaine, ex. DYNFR).");
  } else if (m === "demo") {
    if (config.production) erreurs.push("MODE_CONNEXION=demo est interdit quand NODE_ENV=production.");
    if (!config.comptesDemo.length) erreurs.push("COMPTES_DEMO est vide (mode démo).");
  } else if (m !== "windows") {
    erreurs.push("MODE_CONNEXION doit valoir « windows », « ldap » ou « demo ».");
  }
  if (config.ldapActif && !/^ldaps?:\/\//i.test(config.ldap.url)) erreurs.push("LDAP_URL doit commencer par ldap:// ou ldaps://.");
  if (config.ldap.compteService && exemple(config.ldap.motDePasseService)) erreurs.push("LDAP_MOT_DE_PASSE_SERVICE manquant pour LDAP_COMPTE_SERVICE.");
  if (!config.admins.length) erreurs.push("ADMINS est vide : indiquez au moins un compte (DOMAINE\\login) ou un groupe (groupe:NOM).");
  return erreurs;
}

module.exports = { config, verifier, lirePersonne };
