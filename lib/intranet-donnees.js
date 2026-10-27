"use strict";
/*
 * Contenu de départ de l'intranet (repris de la maquette « Intranet Dyneff »)
 * et reprise automatique des données de la version précédente du hub.
 * Les textes entre crochets [ ] sont à compléter par les services.
 */
const { MODULES_SERVICE } = require("./schemas");

function pageServiceVide(service) {
  const page = {};
  for (const m of MODULES_SERVICE) page[m.id] = {};
  page.entete = { accroche: service && service.desc ? service.desc : "", boutonTexte: "", boutonLien: "", liens: [] };
  for (const id of ["raccourcis", "liste", "faq", "calendrier", "documents", "contacts"]) page[id] = { titre: "", elements: [] };
  page.raccourcis.titre = "Raccourcis";
  page.faq.titre = "Questions fréquentes";
  page.calendrier.titre = "Calendrier";
  page.documents.titre = "Documents utiles";
  page.contacts.titre = "Contacts";
  return page;
}

const SERVICES = [
  { id: "direction", nom: "Direction générale", court: "Direction", desc: "Stratégie, messages de la direction, organigramme", theme: "gris", icone: "batiment", site: "" },
  { id: "marketing-communication", nom: "Marketing & Communication", court: "Market/Com", desc: "Campagnes, kit de com, revue de presse", theme: "rouge", icone: "megaphone", site: "marketing-communication" },
  { id: "ressources-humaines", nom: "Ressources humaines", court: "RH", desc: "Démarches, formation, mobilité, avantages", theme: "vert", icone: "personnes", site: "ressources-humaines" },
  { id: "qhse", nom: "QHSE", court: "QHSE", desc: "Sécurité, environnement, qualité, remontées terrain", theme: "jaune", icone: "bouclier", site: "hsse" },
  { id: "dsi", nom: "DSI", court: "DSI", desc: "Support, applications, cybersécurité, projets", theme: "bleu", icone: "ecran", site: "it-methodes-et-digitalisation" },
  { id: "finance", nom: "Finance & Comptabilité", court: "Finance", desc: "Procédures, notes de frais, clôtures, Sage X3", theme: "gris", icone: "euro", site: "direction-finances" },
  { id: "commercial", nom: "Commercial & Agences", court: "Commercial", desc: "Offres, argumentaires, actualité des agences", theme: "orange", icone: "mallette", site: "adv-commerciale" },
  { id: "reseau", nom: "Réseau stations-service", court: "Réseau", desc: "Procédures station, prix, campagnes, autoroutes", theme: "orange", icone: "station", site: "" },
  { id: "logistique", nom: "Logistique & Dépôts", court: "Logistique", desc: "Transport, flotte, plannings, sécurité livraison", theme: "vert", icone: "camion", site: "logistique" },
  { id: "negoce", nom: "Négoce & Approvisionnement", court: "Négoce", desc: "Marchés, approvisionnements, agences de négoce", theme: "bleu", icone: "echange", site: "" },
  { id: "achats-juridique", nom: "Achats & Juridique", court: "Juridique", desc: "Fournisseurs, contrats, conformité", theme: "gris", icone: "balance", site: "juridique" },
  { id: "cse", nom: "CSE", court: "CSE", desc: "Activités sociales, billetterie, comptes-rendus", theme: "rose", icone: "coeur", site: "cse" }
];

function pagesInitiales() {
  const pages = {};
  for (const s of SERVICES) pages[s.id] = pageServiceVide(s);

  // --- Espace RH (maquette « Espace service — Ressources humaines ») ---
  Object.assign(pages["ressources-humaines"], {
    entete: {
      accroche: "Vos démarches, votre parcours et la vie de l'entreprise, en France et en Espagne.",
      boutonTexte: "Poser une question aux RH", boutonLien: "",
      liens: ["Mes démarches", "Formation", "Recrutement & mobilité", "Rémunération & avantages", "Santé & qualité de vie", "Documents"].map((t) => ({ texte: t, lien: "" }))
    },
    raccourcis: { titre: "Mes démarches en un clic", sousTitre: "", elements: [
      { libelle: "Poser un congé", detail: "Outil de gestion des temps [à préciser]", lien: "", icone: "soleil" },
      { libelle: "Mon bulletin de paie", detail: "Coffre-fort numérique [à préciser]", lien: "", icone: "document" },
      { libelle: "Note de frais", detail: "Saisie et justificatifs", lien: "", icone: "ticket" },
      { libelle: "Attestation employeur", detail: "Demande en ligne, réponse sous 48 h", lien: "", icone: "attestation" },
      { libelle: "M'inscrire à une formation", detail: "Catalogue et demandes", lien: "", icone: "livre" },
      { libelle: "Mutuelle & prévoyance", detail: "Garanties, affiliation, contacts", lien: "", icone: "coeur" }
    ] },
    une: { etiquette: "À la une RH", titre: "Entretiens annuels : la campagne ouvre le [date]",
      texte: "Trame d'entretien, guide du manager et calendrier : tout ce qu'il faut pour préparer ce temps d'échange, salarié comme manager.",
      bouton1Texte: "Je prépare mon entretien", bouton1Lien: "", bouton2Texte: "Guide du manager (PDF)", bouton2Lien: "", icone: "calendrier", image: "" },
    liste: { titre: "Offres internes & mobilité", lienToutTexte: "Toutes les offres", lienToutLien: "", elements: [
      { titre: "Chargé(e) de clientèle", meta: "Service client · Montpellier · CDI", badge: "France", lien: "" },
      { titre: "Conducteur(trice) PL citerne", meta: "Logistique · [Dépôt] · CDI", badge: "France", lien: "" },
      { titre: "Responsable de station", meta: "Réseau stations · [Ville] · CDI", badge: "España", lien: "" },
      { titre: "Assistant(e) négoce", meta: "Négoce · Gérone · CDI", badge: "España", lien: "" }
    ] },
    faq: { titre: "Questions fréquentes", elements: [
      { question: "Comment poser un jour de congé ou de RTT ?", reponse: "[Réponse RH : outil, délai de prévenance, circuit de validation.]" },
      { question: "Où retrouver mes anciens bulletins de paie ?", reponse: "[Réponse RH : coffre-fort numérique, durée de conservation.]" },
      { question: "Qui contacter en cas d'arrêt maladie ?", reponse: "[Réponse RH : interlocuteur, documents à transmettre, délais.]" },
      { question: "Comment candidater à une offre interne ?", reponse: "[Réponse RH : process de mobilité, information du manager.]" }
    ] },
    calendrier: { titre: "Calendrier RH", elements: [
      { quand: "[date]", quoi: "Ouverture des entretiens annuels" },
      { quand: "[date]", quoi: "Date limite des demandes de formation [année]" },
      { quand: "[date]", quoi: "Pose des congés de fin d'année" },
      { quand: "[date]", quoi: "Journée d'intégration des nouveaux arrivants" }
    ] },
    documents: { titre: "Documents utiles", elements: [
      { nom: "Livret d'accueil", type: "PDF", lien: "" }, { nom: "Règlement intérieur", type: "PDF", lien: "" },
      { nom: "Accords d'entreprise", type: "Dossier", lien: "" }, { nom: "Organigramme", type: "PDF", lien: "" },
      { nom: "Charte télétravail", type: "PDF", lien: "" }
    ] },
    contacts: { titre: "Vos contacts RH", elements: [
      { nom: "[Prénom Nom]", role: "Paie & administration du personnel", lien: "" },
      { nom: "[Prénom Nom]", role: "Formation & développement", lien: "" },
      { nom: "[Prénom Nom]", role: "Recrutement · France & Espagne", lien: "" }
    ] }
  });

  // --- Espace Marketing & Communication (maquette) ---
  Object.assign(pages["marketing-communication"], {
    entete: {
      accroche: "La marque Dyneff, ses campagnes et tous les outils pour en parler juste.",
      boutonTexte: "Demander une création", boutonLien: "",
      liens: ["Kit de communication", "Campagnes", "Photothèque", "Revue de presse", "Publier sur l'intranet"].map((t) => ({ texte: t, lien: "" }))
    },
    raccourcis: { titre: "Kit de communication", sousTitre: "Toujours la dernière version validée — inutile de la garder sur votre poste.", elements: [
      { libelle: "Logos Dyneff", detail: "PNG, SVG · fond clair et foncé", lien: "", icone: "cube" },
      { libelle: "Charte graphique", detail: "Couleurs, typographies, usages", lien: "", icone: "palette" },
      { libelle: "Modèles PowerPoint", detail: "Présentation interne et client", lien: "", icone: "ecran" },
      { libelle: "Modèles Word", detail: "Courrier, note, compte-rendu", lien: "", icone: "document" },
      { libelle: "Signature e-mail", detail: "Générateur en ligne", lien: "", icone: "mail" },
      { libelle: "Photothèque", detail: "Stations, dépôts, équipes", lien: "", icone: "image" }
    ] },
    liste: { titre: "Campagnes en cours", lienToutTexte: "", lienToutLien: "", elements: [
      { titre: "[Nom de la campagne stations]", meta: "Réseau stations · [date] → [date] · affiches, PLV, écrans et argumentaire caisse", badge: "Réseau stations", lien: "" },
      { titre: "[Campagne énergie domestique]", meta: "Particuliers · [date] → [date] · messages clés pour les agences et le service client", badge: "Particuliers", lien: "" },
      { titre: "Lancement du nouvel intranet", meta: "Interne · en continu · affichettes, tutoriel vidéo et FAQ", badge: "Interne", lien: "" }
    ] },
    calendrier: { titre: "Calendrier éditorial", elements: [
      { quand: "S45", quoi: "Portrait métier : [chauffeur PL]" }, { quand: "S46", quoi: "Dossier : nos énergies de demain" },
      { quand: "S47", quoi: "Retour en images : [événement]" }, { quand: "S48", quoi: "Lettre interne de novembre" }
    ] },
    documents: { titre: "Revue de presse", elements: [
      { nom: "[Titre de l'article]", type: "[Média] · [date]", lien: "" },
      { nom: "[Titre de l'article]", type: "[Média] · [date]", lien: "" },
      { nom: "[Titre de l'article]", type: "[Média] · [date]", lien: "" }
    ] },
    encart: { titre: "Ambassadeurs Dyneff", texte: "Relayez les publications officielles de Dyneff sur vos réseaux : la sélection de la semaine est prête à partager.",
      boutonTexte: "Voir les posts à relayer", boutonLien: "" }
  });

  // --- CSE ---
  Object.assign(pages.cse, {
    entete: { accroche: "Activités sociales, billetterie et comptes-rendus du CSE.", boutonTexte: "", boutonLien: "",
      liens: ["Activités sociales", "Billetterie", "Comptes-rendus", "Contacts élus"].map((t) => ({ texte: t, lien: "" })) }
  });
  return pages;
}

const SITES_V1 = [
  ["dyneff", "Dyneff"], ["cse", "CSE"], ["tips-collaboration-ia", "Tips Collaboration & IA"],
  ["it-methodes-et-digitalisation", "IT - Méthodes et Digitalisation"], ["ressources-humaines", "Ressources Humaines"],
  ["juridique", "Juridique"], ["conformite", "Conformité"], ["hsse", "HSSE"], ["marketing-communication", "Marketing & Communication"],
  ["direction-finances", "Direction Finances"], ["stat-atr", "Stat ATR"], ["adv-commerciale", "ADV Commerciale"], ["logistique", "Logistique"],
  ["marches-publics", "Marches Publics"], ["60-ans-dyneff", "60 Ans Dyneff"], ["activite-gaz-elec", "Activité Gaz - Elec"], ["asd", "ASD"],
  ["audits", "Audits"], ["bio-ae", "Bio-AE"], ["boite-a-idees", "Boite à Idées"], ["cee", "CEE"], ["credit-client", "Crédit client"],
  ["detail", "Détail"], ["ged-hsse-tech", "GED HSSE-TECH"], ["gestion-de-projet", "Gestion de projet"]
].map(([id, nom]) => ({ id, nom, url: "" }));

function intranetInitial() {
  const n = (id, service, titre, resume, date, pays) => ({ id, service, pays: pays || "", titre, resume, texte: resume, date, auteur: "", image: "", lien: "" });
  return {
    version: 2,
    reglages: { nomSite: "Intranet", salutation: "voici l'essentiel du jour", annuaireUrl: "", annuaireParametre: "", documentsUrl: "" },
    alerte: { actif: true, etiquette: "Info DSI", style: "jaune",
      texte: "Maintenance planifiée de Sage X3 le samedi [date] de [heure] à [heure]. Les autres applications restent disponibles.",
      lienTexte: "En savoir plus", lienLien: "" },
    une: { etiquette: "À la une", titre: "Le nouveau hub Dyneff est en ligne",
      texte: "Intranet, applications métier et guides « Tips, IA & outils collaboratifs » réunis en un seul point d'entrée, avec votre compte Windows.",
      bouton1Texte: "Lire l'article", bouton1Lien: "#/actualites/nouveau-hub", bouton2Texte: "Voir les guides", bouton2Lien: "#/tips",
      signature: "Marketing & Communication · DSI", image: "" },
    acces: { titre: "Accès rapides", elements: [
      { libelle: "Outlook", lien: "https://outlook.office.com/mail/", icone: "mail", theme: "bleu" },
      { libelle: "Teams", lien: "https://teams.microsoft.com/", icone: "bulle", theme: "bleu" },
      { libelle: "Sage X3", lien: "", icone: "euro", theme: "gris" },
      { libelle: "Mes congés", lien: "", icone: "soleil", theme: "vert" },
      { libelle: "Notes de frais", lien: "", icone: "ticket", theme: "vert" },
      { libelle: "Annuaire", lien: "#/annuaire", icone: "personnes", theme: "gris" },
      { libelle: "Hub applicatif", lien: "#/hub", icone: "grille", theme: "jaune" },
      { libelle: "Tips IA", lien: "#/tips", icone: "etincelle", theme: "jaune" }
    ] },
    direction: { titre: "Le mot de la direction",
      texte: "[Message trimestriel de la Direction générale : 3 à 4 lignes sur le cap, les priorités multi-énergies et les temps forts à venir.]",
      lienTexte: "Lire le message complet", lienLien: "" },
    actualites: { titre: "Actualités", elements: [
      Object.assign(n("nouveau-hub", "dsi", "Le nouveau hub Dyneff est en ligne", "Intranet, applications et guides réunis en un seul point d'entrée, avec votre compte Windows.", "2026-10-27"),
        { texte: "Le hub Dyneff réunit désormais l'intranet, le hub applicatif et la bibliothèque « Tips, IA & outils collaboratifs ».\n\nVous êtes reconnu automatiquement grâce à votre session Windows : plus besoin de mot de passe supplémentaire.\n\nChaque service anime son espace et publie ses actualités. Une idée, une remarque ? Écrivez à Marketing & Communication.", auteur: "Marketing & Communication · DSI" }),
      n("feuille-de-route", "direction", "Feuille de route multi-énergies : les priorités [année]", "Carburants, énergies renouvelables, nouvelles mobilités : ce qui change pour nos métiers.", "2026-10-27"),
      n("sage-x3-recette", "dsi", "Migration Sage X3 : point d'étape et calendrier de recette", "Les prochains scénarios de test, qui est concerné et comment se préparer.", "2026-10-26"),
      n("entretiens-annuels", "ressources-humaines", "Entretiens annuels : la campagne ouvre le [date]", "Guide manager, trame d'entretien et calendrier dans l'espace RH.", "2026-10-26"),
      n("campagne-reseau", "marketing-communication", "Nouvelle campagne réseau : le kit est disponible", "Affiches, PLV et messages clés pour les stations, à télécharger.", "2026-10-23"),
      n("pluie-depotage", "qhse", "Livrer en sécurité par temps de pluie", "Les bons réflexes au dépotage, rappelés par l'équipe QHSE.", "2026-10-22"),
      n("nouvelle-station", "reseau", "Bienvenue à la station [nom] dans le réseau", "Présentation de l'équipe et des services proposés aux clients.", "2026-10-21"),
      n("gerone-negoce", "negoce", "Gérone : l'équipe négoce se présente", "Article disponible en français et en espagnol.", "2026-10-20", "ES"),
      n("arbre-de-noel", "cse", "Arbre de Noël : inscriptions ouvertes", "Inscriptions et billetterie jusqu'au [date].", "2026-10-19")
    ] },
    agenda: { titre: "Agenda", elements: [
      { date: "2026-11-12", heure: "9 h – 12 h", titre: "Formation sécurité chauffeurs", lieu: "Dépôt [site]", lien: "" },
      { date: "2026-11-19", heure: "18 h", titre: "Afterwork du CSE", lieu: "Siège, Montpellier", lien: "" },
      { date: "2026-11-26", heure: "11 h – 11 h 45", titre: "Webinaire : bien utiliser l'IA au quotidien", lieu: "Teams", lien: "" }
    ] },
    securite: { titre: "Sécurité d'abord", badge: "QHSE", compteur: "[XX]", compteurLibelle: "jours sans accident avec arrêt sur l'ensemble des sites",
      sousTitre: "Quart d'heure sécurité d'octobre", texte: "[Thème du mois : ex. dépotage et livraison par temps de pluie] — support à animer en équipe.",
      boutonTexte: "Signaler une situation dangereuse", boutonLien: "" },
    bienvenue: { titre: "Bienvenue à…", badge: "RH", lienTexte: "Tous les mouvements du mois", lienLien: "", elements: [
      { nom: "[Prénom Nom]", poste: "[Poste] · Réseau stations · [Site]", theme: "orange" },
      { nom: "[Prénom Nom]", poste: "[Poste] · Logistique · [Dépôt]", theme: "vert" },
      { nom: "[Prénom Nom]", poste: "[Poste] · Négoce · Gérone", theme: "violet" }
    ] },
    services: { titre: "Espaces services", sousTitre: "Chaque service anime son espace : actualités, documents, démarches et contacts.", elements: SERVICES.map((s) => Object.assign({}, s)) },
    offres: { titre: "Offres internes", lienTexte: "Toutes les offres · France & Espagne", lienLien: "#/services/ressources-humaines", elements: [
      { titre: "Chargé(e) de clientèle", meta: "Montpellier · CDI · publié le [date]", pays: "FR", lien: "" },
      { titre: "Conducteur(trice) PL citerne", meta: "[Dépôt] · CDI · publié le [date]", pays: "FR", lien: "" },
      { titre: "Responsable de station", meta: "Espagne · CDI · publié le [date]", pays: "ES", lien: "" }
    ] },
    campagne: { etiquette: "Marketing & Communication", titre: "Campagne stations [nom de la campagne]",
      texte: "Du [date] au [date] dans tout le réseau. Affiches, PLV et argumentaire caisse à télécharger.", theme: "rouge",
      boutonTexte: "Télécharger le kit", boutonLien: "#/services/marketing-communication" },
    cse: { titre: "Le CSE vous informe", accroche: "Arbre de Noël : inscriptions ouvertes",
      texte: "Jusqu'au [date]. Billetterie, chèques vacances et compte-rendus de réunion dans l'espace CSE.",
      lienTexte: "Ouvrir l'espace CSE", lienLien: "#/services/cse" },
    sondage: { actif: true, titre: "Votre avis compte", question: "Ce nouvel intranet vous fait gagner du temps ?",
      options: [{ libelle: "Oui, clairement" }, { libelle: "Un peu" }, { libelle: "Pas encore" }], signature: "Sondage anonyme · Marketing & Communication" },
    chiffres: { titre: "Dyneff en bref", photo: "images/accueil-dyneff.jpg", lienTexte: "Notre histoire, nos métiers", lienLien: "", elements: [
      { valeur: "1958", libelle: "origines du groupe", theme: "rouge" },
      { valeur: "850+", libelle: "collaborateurs", theme: "vert" },
      { valeur: "140", libelle: "stations-service", theme: "gris" },
      { valeur: "2", libelle: "pays : France & Espagne", theme: "gris" }
    ] },
    sites: { titre: "Sites SharePoint de l'intranet", lienToutTexte: "Afficher tout le contenu du site", lienToutLien: "", elements: SITES_V1.map((s) => Object.assign({}, s)) },
    pied: { adresse: "Siège · Montpellier — France & Espagne", liens: [
      { texte: "Proposer une actualité", lien: "#/services/marketing-communication" },
      { texte: "Charte de publication", lien: "" },
      { texte: "Support DSI", lien: "#/services/dsi" },
      { texte: "Share", lien: "" },
      { texte: "Intranet Station", lien: "" }
    ] },
    pages: pagesInitiales()
  };
}

// ---------- Reprise d'une installation de la version précédente ----------
function slug(t) {
  return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "element";
}

function migrerDonnees(data) {
  if (data.intranet && data.intranet.version === 2) return false;
  const ancien = data.intranet || {};
  const neuf = intranetInitial();
  if (Array.isArray(ancien.sites) && ancien.sites.length) {
    neuf.sites.elements = ancien.sites.map((s) => ({ id: s.id || slug(s.nom), nom: s.nom || "", url: s.url || "" }));
    const ids = new Set(neuf.sites.elements.map((s) => s.id));
    for (const sv of neuf.services.elements) if (sv.site && !ids.has(sv.site)) sv.site = "";
  }
  if (ancien.toutLeContenu) neuf.sites.lienToutLien = ancien.toutLeContenu;
  if (ancien.photo) neuf.chiffres.photo = ancien.photo;
  if (ancien.annuaire) { neuf.reglages.annuaireUrl = ancien.annuaire.url || ""; neuf.reglages.annuaireParametre = ancien.annuaire.parametre || ""; }
  if (Array.isArray(ancien.liens)) {
    for (const l of ancien.liens) {
      const ex = neuf.pied.liens.find((p) => p.texte === l.nom);
      if (ex) ex.lien = l.url || ex.lien; else neuf.pied.liens.push({ texte: l.nom, lien: l.url || "" });
    }
  }
  if (Array.isArray(ancien.annonces)) {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    ancien.annonces.forEach((a, i) => neuf.actualites.elements.push({
      id: "annonce-" + (i + 1), service: "", pays: "", titre: a.titre || "Annonce", resume: a.texte || "", texte: a.texte || "",
      date: aujourdhui, auteur: a.auteur || "", image: "", lien: a.url || ""
    }));
  }
  data.intranet = neuf;
  delete data.onglets;
  return true;
}

// Anciennes clés de droits → nouvelles
function migrerDroits(droits, data) {
  if (droits.version === 2) return false;
  const acl = droits.acl || {};
  const nouv = {};
  const ajouter = (cle, liste) => { nouv[cle] = (nouv[cle] || []).concat(liste || []); };
  const serviceDuSite = (idSite) => (data.intranet.services.elements.find((s) => s.site === idSite) || {}).id;
  for (const [cle, liste] of Object.entries(acl)) {
    let m;
    if (cle === "intranet:accueil") ajouter("intranet:reglages", liste);
    else if (cle === "intranet:liens") ajouter("intranet:pied", liste);
    else if (cle === "intranet:annonces") ajouter("intranet:actualites", liste);
    else if (cle === "intranet:sites") ajouter("intranet:sites", liste);
    else if ((m = /^intranet:site:(.+)$/.exec(cle))) {
      const sv = serviceDuSite(m[1]);
      ajouter(sv ? "intranet:service:" + sv : "intranet:sites", liste);
    } else ajouter(cle, liste);
  }
  droits.acl = nouv;
  droits.version = 2;
  return true;
}

module.exports = { intranetInitial, pageServiceVide, migrerDonnees, migrerDroits, slug };
