/*
 * HUB DYNEFF — description des modules de l'intranet.
 *
 * Ce fichier est partagé : le serveur s'en sert pour valider chaque
 * modification, la page pour construire les formulaires de modification.
 * Ajouter un champ ici le rend à la fois modifiable et contrôlé.
 *
 * Types de champs :
 *   texte, zone (texte long), lien (https://…, #/… ou mailto:), image,
 *   theme (couleur de la charte), icone, date (AAAA-MM-JJ), case (oui/non),
 *   choix (liste fermée : options), service (un espace service), site (un
 *   site SharePoint), liste (éléments répétés : champs).
 */
(function (racine, fabrique) {
  if (typeof module === "object" && module.exports) module.exports = fabrique();
  else racine.HUB_SCHEMAS = fabrique();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Couleurs de la charte, reprises de la maquette (fond pâle / texte / bandeau)
  const THEMES = {
    rouge:  { libelle: "Rouge",  doux: "#FDECEA", texte: "#B3261E", fort: "#C4241B", surFort: "#FFFFFF", douxFort: "#FFE3E0" },
    vert:   { libelle: "Vert",   doux: "#E6F4EE", texte: "#016B41", fort: "#018752", surFort: "#FFFFFF", douxFort: "#D8F0E5" },
    jaune:  { libelle: "Jaune",  doux: "#FFF4C2", texte: "#7A5C00", fort: "#FFD203", surFort: "#1C1F24", douxFort: "#3D3300" },
    bleu:   { libelle: "Bleu",   doux: "#E8EFFC", texte: "#1A4FB0", fort: "#1A4FB0", surFort: "#FFFFFF", douxFort: "#DCE6FA" },
    orange: { libelle: "Orange", doux: "#FDF1E3", texte: "#8A4B00", fort: "#8A4B00", surFort: "#FFFFFF", douxFort: "#FBE3C8" },
    violet: { libelle: "Violet", doux: "#F1EAFB", texte: "#5B2A99", fort: "#5B2A99", surFort: "#FFFFFF", douxFort: "#E6DAF7" },
    rose:   { libelle: "Rose",   doux: "#FCE8F1", texte: "#9C1D5B", fort: "#9C1D5B", surFort: "#FFFFFF", douxFort: "#F8D7E7" },
    gris:   { libelle: "Gris",   doux: "#ECEDEF", texte: "#1C1F24", fort: "#1C1F24", surFort: "#FFFFFF", douxFort: "#D6D9DE" }
  };

  // Pictogrammes (tracés SVG 24×24, trait), repris de la maquette
  const ICONES = {
    batiment: { libelle: "Bâtiment", d: "M4 21V5l8-3l8 3v16 M9 21v-5h6v5 M8 9h1 M15 9h1 M8 13h1 M15 13h1" },
    megaphone: { libelle: "Mégaphone", d: "M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z M17 9a4 4 0 0 1 0 6 M7 14l1 6" },
    personnes: { libelle: "Personnes", d: "M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M2 21v-1a7 7 0 0 1 14 0v1 M16 3.5a4 4 0 0 1 0 7 M22 21v-1a6 6 0 0 0-4-5.6" },
    bouclier: { libelle: "Sécurité", d: "M12 3l8 3v6c0 5-3.5 8-8 9c-4.5-1-8-4-8-9V6z M9 12l2 2l4-4" },
    ecran: { libelle: "Écran", d: "M3 4h18v12H3z M8 20h8 M12 16v4" },
    euro: { libelle: "Euro", d: "M17 6a7 7 0 1 0 0 12 M4 10h9 M4 14h9" },
    mallette: { libelle: "Mallette", d: "M3 7h18v13H3z M8 7V4h8v3 M3 13h18" },
    station: { libelle: "Station", d: "M4 21V4h9v17 M3 21h11 M4 10h9 M13 8l4 3v7a2 2 0 0 0 4 0V9l-3-3" },
    camion: { libelle: "Camion", d: "M2 6h11v10H2z M13 10h5l3 3v3h-8 M4 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M15 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0" },
    echange: { libelle: "Échange", d: "M4 8h15 M15 4l4 4l-4 4 M20 16H5 M9 12l-4 4l4 4" },
    balance: { libelle: "Balance", d: "M12 3v18 M6 21h12 M5 7h14 M5 7l-3 7a3 3 0 0 0 6 0z M19 7l-3 7a3 3 0 0 0 6 0z" },
    coeur: { libelle: "Cœur", d: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" },
    mail: { libelle: "Courriel", d: "M3 5h18v14H3z M3 6l9 7l9-7" },
    bulle: { libelle: "Conversation", d: "M4 4h16v12H9l-5 4z" },
    soleil: { libelle: "Soleil (congés)", d: "M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5" },
    ticket: { libelle: "Ticket", d: "M6 3h12v18l-3-2l-3 2l-3-2l-3 2z M9 8h6 M9 12h6" },
    grille: { libelle: "Applications", d: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z" },
    etincelle: { libelle: "IA", d: "M12 3l2 6l6 2l-6 2l-2 6l-2-6l-6-2l6-2z" },
    livre: { libelle: "Livre", d: "M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z" },
    globe: { libelle: "Globe", d: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18" },
    document: { libelle: "Document", d: "M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6" },
    attestation: { libelle: "Attestation", d: "M5 4h14v16H5z M9 9h6 M9 13h6 M9 17h3" },
    calendrier: { libelle: "Calendrier", d: "M4 5h16v16H4z M4 10h16 M9 3v4 M15 3v4" },
    palette: { libelle: "Palette", d: "M12 3a9 9 0 1 0 0 18c1 0 2-1 2-2s-1-2 0-3s4 0 5-2a9 9 0 0 0-7-11z M7.5 10.5h.01 M10.5 7h.01 M15 7.5h.01" },
    cube: { libelle: "Logo", d: "M12 3l9 5v8l-9 5l-9-5V8z M12 12l9-4 M12 12v9 M12 12L3 8" },
    image: { libelle: "Image", d: "M3 5h18v14H3z M8 10a1.5 1.5 0 1 0 0.01 0 M21 16l-5-5l-9 8" },
    alerte: { libelle: "Alerte", d: "M12 3l10 18H2z M12 10v4 M12 17h.01" },
    lien: { libelle: "Lien", d: "M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1 M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" },
    telephone: { libelle: "Téléphone", d: "M5 3h4l2 5l-3 2a11 11 0 0 0 6 6l2-3l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z" },
    question: { libelle: "Question", d: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7v.5 M12 17h.01" },
    video: { libelle: "Vidéo", d: "M3 6h12v12H3z M15 10l6-3v10l-6-3" },
    cle: { libelle: "Clé", d: "M14 10a4 4 0 1 0-4 4 M10 14l-7 7 M6 17l2 2 M8 15l2 2" }
  };

  const PAYS = [{ v: "", l: "France et Espagne" }, { v: "FR", l: "France" }, { v: "ES", l: "España" }];

  // ---------- Modules de la page d'accueil ----------
  const lienBouton = (prefixe, libelle) => [
    { cle: prefixe + "Texte", libelle: "Texte du " + libelle, type: "texte", max: 60 },
    { cle: prefixe + "Lien", libelle: "Lien du " + libelle, type: "lien" }
  ];

  const MODULES_ACCUEIL = [
    { id: "reglages", libelle: "Réglages : navigation, annuaire, documents", champs: [
      { cle: "nomSite", libelle: "Nom affiché à côté du logo", type: "texte", max: 40, obligatoire: true },
      { cle: "salutation", libelle: "Phrase d'accueil (après « Bonjour Prénom, »)", type: "texte", max: 120 },
      { cle: "annuaireUrl", libelle: "Adresse de recherche de l'annuaire existant", type: "lien", large: true },
      { cle: "annuaireParametre", libelle: "Paramètre de recherche (ex. k ou nom)", type: "texte", max: 40 },
      { cle: "documentsUrl", libelle: "Lien du menu « Documents » (vide = menu masqué)", type: "lien", large: true }
    ] },
    { id: "alerte", libelle: "Bandeau d'alerte", champs: [
      { cle: "actif", libelle: "Afficher le bandeau", type: "case" },
      { cle: "etiquette", libelle: "Étiquette (ex. Info DSI)", type: "texte", max: 30 },
      { cle: "style", libelle: "Couleur", type: "choix", options: [{ v: "jaune", l: "Jaune (information)" }, { v: "rouge", l: "Rouge (urgent)" }] },
      { cle: "texte", libelle: "Message", type: "zone", max: 400, large: true },
      ...lienBouton("lien", "lien")
    ] },
    { id: "une", libelle: "À la une", champs: [
      { cle: "etiquette", libelle: "Étiquette", type: "texte", max: 30 },
      { cle: "titre", libelle: "Titre", type: "texte", max: 140, obligatoire: true, large: true },
      { cle: "texte", libelle: "Texte", type: "zone", max: 600, large: true },
      ...lienBouton("bouton1", "bouton principal"),
      ...lienBouton("bouton2", "bouton secondaire"),
      { cle: "signature", libelle: "Signature (service, date)", type: "texte", max: 120, large: true },
      { cle: "image", libelle: "Image (facultatif : sinon motif aux couleurs Dyneff)", type: "image", large: true }
    ] },
    { id: "acces", libelle: "Accès rapides", champs: [
      { cle: "titre", libelle: "Titre", type: "texte", max: 60 },
      { cle: "elements", libelle: "Raccourcis", type: "liste", max: 12, libelleAjout: "Ajouter un raccourci", champs: [
        { cle: "libelle", libelle: "Libellé", type: "texte", max: 30, obligatoire: true },
        { cle: "lien", libelle: "Lien", type: "lien" },
        { cle: "icone", libelle: "Pictogramme", type: "icone" },
        { cle: "theme", libelle: "Couleur", type: "theme" }
      ] }
    ] },
    { id: "direction", libelle: "Le mot de la direction", champs: [
      { cle: "titre", libelle: "Titre", type: "texte", max: 80 },
      { cle: "texte", libelle: "Message", type: "zone", max: 1500, large: true },
      ...lienBouton("lien", "lien")
    ] },
    { id: "actualites", libelle: "Actualités (toutes)", champs: [
      { cle: "titre", libelle: "Titre du module", type: "texte", max: 60 },
      { cle: "elements", libelle: "Articles (les plus récents s'affichent en premier)", type: "liste", max: 300, libelleAjout: "Ajouter une actualité", champs: "ACTUALITE" }
    ] },
    { id: "agenda", libelle: "Agenda", champs: [
      { cle: "titre", libelle: "Titre", type: "texte", max: 60 },
      { cle: "elements", libelle: "Événements (seuls ceux à venir s'affichent)", type: "liste", max: 200, libelleAjout: "Ajouter un événement", champs: [
        { cle: "date", libelle: "Date", type: "date", obligatoire: true },
        { cle: "heure", libelle: "Horaire (ex. 9 h – 12 h)", type: "texte", max: 30 },
        { cle: "titre", libelle: "Titre", type: "texte", max: 120, obligatoire: true, large: true },
        { cle: "lieu", libelle: "Lieu", type: "texte", max: 120 },
        { cle: "lien", libelle: "Lien (facultatif)", type: "lien" }
      ] }
    ] },
    { id: "securite", libelle: "Sécurité d'abord (QHSE)", champs: [
      { cle: "titre", libelle: "Titre", type: "texte", max: 60 },
      { cle: "badge", libelle: "Étiquette", type: "texte", max: 20 },
      { cle: "compteur", libelle: "Compteur (ex. 127)", type: "texte", max: 10 },
      { cle: "compteurLibelle", libelle: "Texte du compteur", type: "texte", max: 120, large: true },
      { cle: "sousTitre", libelle: "Sous-titre (ex. Quart d'heure sécurité)", type: "texte", max: 120, large: true },
      { cle: "texte", libelle: "Texte", type: "zone", max: 500, large: true },
      ...lienBouton("bouton", "bouton")
    ] },
    { id: "bienvenue", libelle: "Bienvenue à… (arrivées)", champs: [
      { cle: "titre", libelle: "Titre", type: "texte", max: 60 },
      { cle: "badge", libelle: "Étiquette", type: "texte", max: 20 },
      { cle: "elements", libelle: "Arrivées", type: "liste", max: 30, libelleAjout: "Ajouter une arrivée", champs: [
        { cle: "nom", libelle: "Prénom Nom", type: "texte", max: 80, obligatoire: true },
        { cle: "poste", libelle: "Poste · service · site", type: "texte", max: 140 },
        { cle: "theme", libelle: "Couleur", type: "theme" }
      ] },
      ...lienBouton("lien", "lien")
    ] },
    { id: "services", libelle: "Liste des espaces services", champs: [
      { cle: "titre", libelle: "Titre", type: "texte", max: 60 },
      { cle: "sousTitre", libelle: "Sous-titre", type: "texte", max: 160, large: true },
      { cle: "elements", libelle: "Espaces (chaque espace a sa propre page et ses propres droits)", type: "liste", max: 40, libelleAjout: "Ajouter un espace service", champs: [
        { cle: "nom", libelle: "Nom", type: "texte", max: 60, obligatoire: true },
        { cle: "court", libelle: "Nom court (filtres des actualités)", type: "texte", max: 20 },
        { cle: "desc", libelle: "Description", type: "texte", max: 140, large: true },
        { cle: "theme", libelle: "Couleur", type: "theme" },
        { cle: "icone", libelle: "Pictogramme", type: "icone" },
        { cle: "site", libelle: "Site SharePoint existant", type: "site" }
      ] }
    ] },
    { id: "offres", libelle: "Offres internes", champs: [
      { cle: "titre", libelle: "Titre", type: "texte", max: 60 },
      { cle: "elements", libelle: "Offres", type: "liste", max: 50, libelleAjout: "Ajouter une offre", champs: [
        { cle: "titre", libelle: "Intitulé du poste", type: "texte", max: 120, obligatoire: true },
        { cle: "meta", libelle: "Lieu · contrat · date", type: "texte", max: 140 },
        { cle: "pays", libelle: "Pays", type: "choix", options: PAYS },
        { cle: "lien", libelle: "Lien vers l'offre", type: "lien" }
      ] },
      ...lienBouton("lien", "lien « toutes les offres »")
    ] },
    { id: "campagne", libelle: "Campagne (encart coloré)", champs: [
      { cle: "etiquette", libelle: "Étiquette", type: "texte", max: 40 },
      { cle: "titre", libelle: "Titre", type: "texte", max: 120 },
      { cle: "texte", libelle: "Texte", type: "zone", max: 400, large: true },
      { cle: "theme", libelle: "Couleur", type: "theme" },
      ...lienBouton("bouton", "bouton")
    ] },
    { id: "cse", libelle: "Le CSE vous informe", champs: [
      { cle: "titre", libelle: "Titre", type: "texte", max: 60 },
      { cle: "accroche", libelle: "Accroche", type: "texte", max: 120, large: true },
      { cle: "texte", libelle: "Texte", type: "zone", max: 500, large: true },
      ...lienBouton("lien", "lien")
    ] },
    { id: "sondage", libelle: "Sondage", champs: [
      { cle: "actif", libelle: "Afficher le sondage", type: "case" },
      { cle: "titre", libelle: "Titre", type: "texte", max: 60 },
      { cle: "question", libelle: "Question (la modifier remet les votes à zéro)", type: "texte", max: 200, large: true },
      { cle: "options", libelle: "Réponses possibles", type: "liste", max: 6, libelleAjout: "Ajouter une réponse", champs: [
        { cle: "libelle", libelle: "Réponse", type: "texte", max: 80, obligatoire: true, large: true }
      ] },
      { cle: "signature", libelle: "Mention (ex. Sondage anonyme · Market/Com)", type: "texte", max: 120, large: true }
    ] },
    { id: "chiffres", libelle: "Dyneff en bref", champs: [
      { cle: "titre", libelle: "Titre", type: "texte", max: 60 },
      { cle: "photo", libelle: "Photo", type: "image", large: true },
      { cle: "elements", libelle: "Chiffres clés", type: "liste", max: 8, libelleAjout: "Ajouter un chiffre", champs: [
        { cle: "valeur", libelle: "Valeur", type: "texte", max: 20, obligatoire: true },
        { cle: "libelle", libelle: "Libellé", type: "texte", max: 60 },
        { cle: "theme", libelle: "Couleur", type: "theme" }
      ] },
      ...lienBouton("lien", "lien")
    ] },
    { id: "sites", libelle: "Sites SharePoint de l'intranet", champs: [
      { cle: "titre", libelle: "Titre", type: "texte", max: 60 },
      { cle: "elements", libelle: "Sites (les espaces services peuvent y renvoyer)", type: "liste", max: 300, libelleAjout: "Ajouter un site", champs: [
        { cle: "nom", libelle: "Nom du site", type: "texte", max: 80, obligatoire: true },
        { cle: "url", libelle: "Adresse SharePoint", type: "lien" }
      ] },
      ...lienBouton("lienTout", "lien « tout le contenu du site »")
    ] },
    { id: "pied", libelle: "Pied de page", champs: [
      { cle: "liens", libelle: "Liens", type: "liste", max: 10, libelleAjout: "Ajouter un lien", champs: [
        { cle: "texte", libelle: "Texte", type: "texte", max: 60, obligatoire: true },
        { cle: "lien", libelle: "Lien", type: "lien" }
      ] },
      { cle: "adresse", libelle: "Mention de droite", type: "texte", max: 120, large: true }
    ] }
  ];

  const CHAMPS_ACTUALITE = [
    { cle: "titre", libelle: "Titre", type: "texte", max: 160, obligatoire: true, large: true },
    { cle: "service", libelle: "Service", type: "service" },
    { cle: "pays", libelle: "Pays", type: "choix", options: PAYS },
    { cle: "date", libelle: "Date de publication", type: "date", obligatoire: true },
    { cle: "auteur", libelle: "Signé par", type: "texte", max: 80 },
    { cle: "resume", libelle: "Résumé (carte)", type: "zone", max: 300, large: true },
    { cle: "texte", libelle: "Article complet (une ligne vide sépare les paragraphes)", type: "zone", max: 8000, large: true, lignes: 8 },
    { cle: "image", libelle: "Image (facultatif)", type: "image", large: true },
    { cle: "lien", libelle: "Lien externe (facultatif)", type: "lien", large: true }
  ];

  // ---------- Modules d'une page « espace service » ----------
  const MODULES_SERVICE = [
    { id: "entete", libelle: "Bandeau et menu de l'espace", champs: [
      { cle: "accroche", libelle: "Accroche", type: "texte", max: 160, large: true },
      ...lienBouton("bouton", "bouton jaune"),
      { cle: "liens", libelle: "Menu de l'espace", type: "liste", max: 10, libelleAjout: "Ajouter une entrée", champs: [
        { cle: "texte", libelle: "Texte", type: "texte", max: 40, obligatoire: true },
        { cle: "lien", libelle: "Lien", type: "lien" }
      ] }
    ] },
    { id: "raccourcis", libelle: "Raccourcis (démarches, kit…)", champs: [
      { cle: "titre", libelle: "Titre", type: "texte", max: 80 },
      { cle: "sousTitre", libelle: "Sous-titre", type: "texte", max: 160, large: true },
      { cle: "elements", libelle: "Raccourcis", type: "liste", max: 18, libelleAjout: "Ajouter un raccourci", champs: [
        { cle: "libelle", libelle: "Libellé", type: "texte", max: 60, obligatoire: true },
        { cle: "detail", libelle: "Précision", type: "texte", max: 100 },
        { cle: "lien", libelle: "Lien", type: "lien" },
        { cle: "icone", libelle: "Pictogramme", type: "icone" }
      ] }
    ] },
    { id: "une", libelle: "À la une de l'espace", champs: [
      { cle: "etiquette", libelle: "Étiquette", type: "texte", max: 30 },
      { cle: "titre", libelle: "Titre", type: "texte", max: 140, large: true },
      { cle: "texte", libelle: "Texte", type: "zone", max: 600, large: true },
      ...lienBouton("bouton1", "bouton principal"),
      ...lienBouton("bouton2", "bouton secondaire"),
      { cle: "icone", libelle: "Pictogramme (si pas d'image)", type: "icone" },
      { cle: "image", libelle: "Image (facultatif)", type: "image", large: true }
    ] },
    { id: "liste", libelle: "Liste (offres, campagnes…)", champs: [
      { cle: "titre", libelle: "Titre", type: "texte", max: 80 },
      { cle: "elements", libelle: "Éléments", type: "liste", max: 50, libelleAjout: "Ajouter un élément", champs: [
        { cle: "titre", libelle: "Titre", type: "texte", max: 120, obligatoire: true },
        { cle: "meta", libelle: "Précisions (lieu, dates…)", type: "texte", max: 160 },
        { cle: "badge", libelle: "Étiquette", type: "texte", max: 30 },
        { cle: "lien", libelle: "Lien", type: "lien" }
      ] },
      ...lienBouton("lienTout", "lien « tout voir »")
    ] },
    { id: "faq", libelle: "Questions fréquentes", champs: [
      { cle: "titre", libelle: "Titre", type: "texte", max: 80 },
      { cle: "elements", libelle: "Questions", type: "liste", max: 40, libelleAjout: "Ajouter une question", champs: [
        { cle: "question", libelle: "Question", type: "texte", max: 200, obligatoire: true, large: true },
        { cle: "reponse", libelle: "Réponse", type: "zone", max: 1500, large: true }
      ] }
    ] },
    { id: "calendrier", libelle: "Calendrier", champs: [
      { cle: "titre", libelle: "Titre", type: "texte", max: 80 },
      { cle: "elements", libelle: "Dates", type: "liste", max: 30, libelleAjout: "Ajouter une date", champs: [
        { cle: "quand", libelle: "Quand (ex. 12 nov. ou S45)", type: "texte", max: 20, obligatoire: true },
        { cle: "quoi", libelle: "Quoi", type: "texte", max: 160, large: true }
      ] }
    ] },
    { id: "documents", libelle: "Documents utiles", champs: [
      { cle: "titre", libelle: "Titre", type: "texte", max: 80 },
      { cle: "elements", libelle: "Documents", type: "liste", max: 40, libelleAjout: "Ajouter un document", champs: [
        { cle: "nom", libelle: "Nom", type: "texte", max: 120, obligatoire: true },
        { cle: "type", libelle: "Type (PDF, Dossier, Article…)", type: "texte", max: 30 },
        { cle: "lien", libelle: "Lien (SharePoint, Tips…)", type: "lien" }
      ] }
    ] },
    { id: "contacts", libelle: "Contacts", champs: [
      { cle: "titre", libelle: "Titre", type: "texte", max: 80 },
      { cle: "elements", libelle: "Contacts", type: "liste", max: 20, libelleAjout: "Ajouter un contact", champs: [
        { cle: "nom", libelle: "Prénom Nom", type: "texte", max: 80, obligatoire: true },
        { cle: "role", libelle: "Rôle", type: "texte", max: 120 },
        { cle: "lien", libelle: "Lien Teams ou mailto:", type: "lien" }
      ] }
    ] },
    { id: "encart", libelle: "Encart sombre (ambassadeurs, appel à l'action…)", champs: [
      { cle: "titre", libelle: "Titre", type: "texte", max: 80 },
      { cle: "texte", libelle: "Texte", type: "zone", max: 400, large: true },
      ...lienBouton("bouton", "bouton")
    ] }
  ];

  // Remplace la référence "ACTUALITE" par la liste de champs
  for (const m of MODULES_ACCUEIL) for (const c of m.champs) if (c.champs === "ACTUALITE") c.champs = CHAMPS_ACTUALITE;

  const MODULE_ACTUALITES_SERVICE = { id: "actualites", libelle: "Actualités de l'espace", champs: [
    { cle: "elements", libelle: "Articles publiés par cet espace", type: "liste", max: 300, libelleAjout: "Ajouter une actualité",
      champs: CHAMPS_ACTUALITE.filter((c) => c.cle !== "service") }
  ] };

  function moduleAccueil(id) { return MODULES_ACCUEIL.find((m) => m.id === id) || null; }
  function moduleService(id) { return id === "actualites" ? MODULE_ACTUALITES_SERVICE : (MODULES_SERVICE.find((m) => m.id === id) || null); }

  // Analyse d'une clé de droit « intranet:… »
  function analyserCle(cle) {
    let m;
    if ((m = /^intranet:service:([a-z0-9-]+):([a-z]+)$/.exec(cle))) return { genre: "service-module", service: m[1], module: m[2], schema: moduleService(m[2]) };
    if ((m = /^intranet:service:([a-z0-9-]+)$/.exec(cle))) return { genre: "service", service: m[1] };
    if ((m = /^intranet:([a-z]+)$/.exec(cle))) return { genre: "accueil", module: m[1], schema: moduleAccueil(m[1]) };
    return null;
  }

  return { THEMES, ICONES, PAYS, MODULES_ACCUEIL, MODULES_SERVICE, MODULE_ACTUALITES_SERVICE, CHAMPS_ACTUALITE, moduleAccueil, moduleService, analyserCle };
});
