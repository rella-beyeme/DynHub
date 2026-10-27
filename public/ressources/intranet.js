/*
 * HUB DYNEFF — intranet (d'après la maquette « Intranet Dyneff ») et navigation.
 *
 * Pages : #/ (accueil), #/actualites, #/actualites/<id>, #/services,
 * #/services/<id>, #/agenda, #/sites, #/annuaire, #/recherche/<mots>,
 * #/hub (Hub applicatif), #/tips (Tips, IA & outils collaboratifs).
 * Contenu : constante INTRANET insérée par le serveur. Chaque module porte un
 * bouton « Modifier » pour les personnes autorisées (voir edition.js).
 */
(function () {
  "use strict";
  const U = window.HUB_UI, S = window.HUB_SCHEMAS;
  const { el, icone, pictogramme, theme, lien, lier } = U;
  const I = INTRANET, SES = typeof SESSION_HUB !== "undefined" ? SESSION_HUB : { cles: [], sections: {}, utilisateur: {} };
  const ED = () => window.HUB_EDITION || null;
  const $ = (id) => document.getElementById(id);

  // ---------- Modules modifiables ----------
  const peut = (cle) => !!(ED() && ED().peut(cle));
  function module(cle, noeud, libelle) {
    if (noeud && peut(cle)) {
      noeud.classList.add("modifiable");
      noeud.appendChild(ED().bouton(cle, libelle));
    }
    return noeud;
  }
  // Module vide : visible seulement en mode modification, pour pouvoir le remplir
  function vide(cle, titre, classe) {
    if (!peut(cle)) return null;
    return module(cle, el("div", { classe: "carte module-vide seulement-edition " + (classe || "") }, [
      el("strong", { texte: titre }), el("span", { classe: "gris petit", texte: "Module vide ou masqué : cliquez sur « Modifier » pour le remplir." })
    ]));
  }
  const rempli = (v) => !!(v && String(v).trim());

  // ---------- Espaces services ----------
  const services = () => I.services.elements || [];
  const service = (id) => services().find((s) => s.id === id) || null;
  const site = (id) => (I.sites.elements || []).find((s) => s.id === id) || null;
  function etiquetteActu(a) {
    const s = service(a.service);
    if (s) return { texte: s.court || s.nom, theme: s.theme, icone: s.icone };
    if (a.pays === "ES") return { texte: "España", theme: "violet", icone: "globe" };
    return { texte: "Dyneff", theme: "gris", icone: "batiment" };
  }
  // Plus récentes d'abord ; à date égale, la dernière ajoutée en premier
  const actualitesTriees = () => (I.actualites.elements || []).map((a, i) => [a, i])
    .sort((x, y) => String(y[0].date).localeCompare(String(x[0].date)) || y[1] - x[1]).map((x) => x[0]);

  // ---------- Briques communes ----------
  function carteActu(a) {
    const t = etiquetteActu(a), th = theme(t.theme);
    const visuel = el("div", { classe: "visuel", style: { background: th.doux }, "aria-hidden": "true" },
      [a.image ? el("img", { src: a.image, alt: "" }) : icone(t.icone, { taille: 48, couleur: th.texte, epaisseur: 1.6 })]);
    return el("a", { classe: "carte-actu", href: "#/actualites/" + encodeURIComponent(a.id) }, [visuel,
      el("div", { classe: "corps" }, [
        el("span", { classe: "badge", style: { background: th.doux, color: th.texte }, texte: t.texte }),
        el("h3", { texte: a.titre }),
        el("p", { classe: "resume", texte: a.resume || "" }),
        el("p", { classe: "tres-petit", texte: U.relatif(a.date) + (a.pays === "ES" && service(a.service) ? " · España" : "") })
      ])]);
  }
  function grilleActus(liste) {
    if (!liste.length) return el("p", { classe: "vide-carte", texte: "Aucune actualité pour ce filtre." });
    return el("div", { classe: "grille-actus" }, liste.map(carteActu));
  }
  function puces(options, choisi, surChoix) {
    return el("div", { classe: "puces", role: "group", "aria-label": "Filtrer par service" }, options.map((o) =>
      el("button", { type: "button", classe: "puce", "aria-pressed": String(o.v === choisi), texte: o.l, onclick: () => surChoix(o.v) })));
  }
  function filtresActus() {
    const vus = new Set((I.actualites.elements || []).map((a) => a.service));
    const opts = [{ v: "", l: "Tous" }].concat(services().filter((s) => vus.has(s.id)).map((s) => ({ v: s.id, l: s.court || s.nom })));
    if ((I.actualites.elements || []).some((a) => a.pays === "ES")) opts.push({ v: "ES", l: "España" });
    return opts;
  }
  const filtrer = (liste, f) => (!f ? liste : f === "ES" ? liste.filter((a) => a.pays === "ES") : liste.filter((a) => a.service === f));
  function lienFort(url, texte) { return rempli(texte) ? lien(url, { classe: "lien-fort pousse-bas", texte }) : null; }
  function bouton(url, texte, classe) { return rempli(texte) ? lien(url, { classe: "bouton " + classe, texte }) : null; }
  function enteteSection(titre, sousTitre, droite) {
    return el("div", { classe: "entete-section" }, [el("div", null, [el("h2", { texte: titre }), rempli(sousTitre) ? el("p", { texte: sousTitre }) : null]), droite || null]);
  }

  // ======================================================================
  // ACCUEIL
  // ======================================================================
  let filtreAccueil = "";
  function pageAccueil() {
    const page = el("div", { classe: "page largeur" });
    const prenom = (SES.utilisateur && (SES.utilisateur.prenom || SES.utilisateur.nom)) || "";
    page.appendChild(module("intranet:reglages", el("div", { classe: "salutation" }, [el("div", null, [
      el("p", { texte: U.dateLongue(new Date()) }),
      el("h1", { texte: "Bonjour" + (prenom ? " " + prenom : "") + (rempli(I.reglages.salutation) ? ", " + I.reglages.salutation : "") })
    ])]), "Réglages"));

    // À la une + colonne
    const rangee = el("div", { classe: "rangee" });
    rangee.appendChild(rempli(I.une.titre) ? module("intranet:une", carteUne()) : vide("intranet:une", "À la une"));
    const col = el("aside", { classe: "colonne-une" });
    const acces = (I.acces.elements || []);
    col.appendChild(acces.length ? module("intranet:acces", el("section", { classe: "carte" }, [
      el("h2", { texte: I.acces.titre || "Accès rapides" }),
      el("div", { classe: "acces" }, acces.map((a) => lien(a.lien, { classe: "tuile" }, [pictogramme(a.icone, a.theme), a.libelle])))
    ])) : vide("intranet:acces", "Accès rapides"));
    col.appendChild(rempli(I.direction.texte) ? module("intranet:direction", el("section", { classe: "carte" }, [
      el("div", { classe: "entete-ligne", style: { justifyContent: "flex-start", gap: "10px" } }, [
        el("span", { classe: "pictogramme rond", style: { background: "#1C1F24", width: "40px", height: "40px" } }, [icone("batiment", { taille: 20, couleur: "#FFD203" })]),
        el("h2", { texte: I.direction.titre || "Le mot de la direction", style: { margin: 0, fontSize: "22px" } })]),
      el("p", { classe: "gris texte-long", style: { margin: 0 }, texte: I.direction.texte }),
      lienFort(I.direction.lienLien, I.direction.lienTexte)
    ])) : vide("intranet:direction", "Le mot de la direction"));
    rangee.appendChild(col);
    page.appendChild(rangee);

    // Actualités
    const zoneActus = el("div");
    const majActus = () => {
      zoneActus.innerHTML = "";
      zoneActus.append(puces(filtresActus(), filtreAccueil, (v) => { filtreAccueil = v; majActus(); }));
      let liste = filtrer(actualitesTriees(), filtreAccueil);
      if (!filtreAccueil) liste = liste.slice(0, 4);
      zoneActus.append(el("div", { style: { height: "16px" } }), grilleActus(liste));
    };
    majActus();
    page.appendChild(module("intranet:actualites", el("section", { id: "actus", style: { position: "relative", display: "flex", flexDirection: "column", gap: "16px" } }, [
      enteteSection(I.actualites.titre || "Actualités", "", el("a", { href: "#/actualites", classe: "lien-fort", texte: "Toutes les actualités" })), zoneActus
    ])));

    // Agenda · Sécurité · Bienvenue
    page.appendChild(el("div", { classe: "grille-3" }, [carteAgenda(), carteSecurite(), carteBienvenue()].filter(Boolean)));

    // Espaces services
    page.appendChild(module("intranet:services", el("section", { id: "services", style: { position: "relative", display: "flex", flexDirection: "column", gap: "16px" } }, [
      enteteSection(I.services.titre || "Espaces services", I.services.sousTitre), grilleServices()
    ])));

    // Offres · Campagne · CSE · Sondage
    page.appendChild(el("div", { classe: "grille-4" }, [carteOffres(), carteCampagne(), carteCse(), carteSondage()].filter(Boolean)));

    page.appendChild(carteChiffres());
    page.appendChild(carteSites(14));
    return page;
  }

  function carteUne() {
    const u = I.une;
    const visuel = u.image
      ? el("div", { classe: "visuel", "aria-hidden": "true" }, [el("img", { src: u.image, alt: "" })])
      : el("div", { classe: "visuel motif", "aria-hidden": "true" }, [el("div", { classe: "rond1" }), el("div", { classe: "rond2" }),
          el("div", { classe: "tuiles" }, [el("i"), el("i"), el("i"), el("i"), el("i"), el("i")])]);
    const b1 = bouton(u.bouton1Lien, u.bouton1Texte, "clair");
    return el("article", { classe: "une" }, [
      el("div", { classe: "texte" }, [
        rempli(u.etiquette) ? el("span", { classe: "etiquette-une", texte: u.etiquette }) : null,
        el("h2", { texte: u.titre }),
        rempli(u.texte) ? el("p", { texte: u.texte }) : null,
        el("div", { classe: "actions" }, [b1, bouton(u.bouton2Lien, u.bouton2Texte, "contour-sombre")].filter(Boolean)),
        rempli(u.signature) ? el("p", { classe: "signature", texte: u.signature }) : null
      ]), visuel]);
  }

  function carteAgenda(limite) {
    const auj = U.isoAujourdhui();
    const avenir = (I.agenda.elements || []).filter((e) => e.date >= auj).sort((a, b) => a.date.localeCompare(b.date)).slice(0, limite || 3);
    return module("intranet:agenda", el("section", { classe: "carte", id: "agenda" }, [
      el("h2", { texte: I.agenda.titre || "Agenda" }),
      avenir.length ? el("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } }, avenir.map(evenement))
        : el("p", { classe: "gris", style: { margin: 0 }, texte: "Aucun événement à venir." }),
      el("a", { href: "#/agenda", classe: "lien-fort pousse-bas", texte: "Voir tout l'agenda" })
    ]));
  }
  function evenement(e) {
    const d = U.dateDe(e.date);
    const titre = rempli(e.lien) ? lien(e.lien, { classe: "titre", texte: e.titre }) : el("span", { classe: "titre", texte: e.titre });
    return el("div", { classe: "evenement" }, [
      el("div", { classe: "date-bloc", "aria-hidden": "true" }, [el("span", { texte: U.moisCourt(e.date) }), el("strong", { texte: d ? String(d.getDate()) : "" })]),
      el("div", null, [el("p", null, [titre]), el("p", { classe: "gris petit", texte: [U.dateCourte(e.date), e.heure, e.lieu].filter(rempli).join(" · ") })])
    ]);
  }
  function carteSecurite() {
    const s = I.securite;
    if (!rempli(s.titre) && !rempli(s.compteur)) return vide("intranet:securite", "Sécurité d'abord");
    const b = rempli(s.boutonTexte) ? lien(s.boutonLien, { classe: "bouton sombre pousse-bas" }, [icone("alerte", { taille: 18, couleur: "#FFD203" }), s.boutonTexte]) : null;
    return module("intranet:securite", el("section", { classe: "carte" }, [
      el("div", { classe: "entete-ligne" }, [el("h2", { texte: s.titre || "Sécurité", style: { margin: 0, fontSize: "22px" } }),
        rempli(s.badge) ? el("span", { classe: "badge", style: { background: "#FFF4C2", color: "#7A5C00" }, texte: s.badge }) : null]),
      rempli(s.compteur) ? el("div", { classe: "compteur" }, [el("strong", { texte: s.compteur }), el("span", { texte: s.compteurLibelle || "" })]) : null,
      el("div", null, [rempli(s.sousTitre) ? el("p", { style: { margin: 0, fontWeight: 700 }, texte: s.sousTitre }) : null,
        rempli(s.texte) ? el("p", { classe: "gris petit texte-long", style: { margin: 0 }, texte: s.texte }) : null]),
      b
    ]));
  }
  function carteBienvenue() {
    const b = I.bienvenue, l = b.elements || [];
    if (!l.length) return vide("intranet:bienvenue", "Bienvenue à…");
    return module("intranet:bienvenue", el("section", { classe: "carte" }, [
      el("div", { classe: "entete-ligne" }, [el("h2", { texte: b.titre || "Bienvenue à…", style: { margin: 0, fontSize: "22px" } }),
        rempli(b.badge) ? el("span", { classe: "badge", style: { background: "#E6F4EE", color: "#016B41" }, texte: b.badge }) : null]),
      ...l.map((p) => { const t = theme(p.theme); return el("div", { classe: "personne" }, [
        el("span", { classe: "avatar", style: { background: t.doux, color: t.texte }, "aria-hidden": "true", texte: U.initiales(p.nom) }),
        el("div", null, [el("p", { classe: "nom", texte: p.nom }), el("p", { classe: "gris petit", texte: p.poste || "" })])]); }),
      lienFort(b.lienLien, b.lienTexte)
    ]));
  }
  function grilleServices() {
    return el("div", { classe: "grille-services" }, services().map((s) =>
      el("a", { classe: "tuile-service", href: "#/services/" + encodeURIComponent(s.id) }, [
        pictogramme(s.icone, s.theme, "grand", 24),
        el("span", { style: { minWidth: 0 } }, [el("span", { classe: "nom", texte: s.nom }), el("span", { classe: "desc", texte: s.desc || "" })])])));
  }
  function carteOffres() {
    const o = I.offres, l = o.elements || [];
    if (!l.length) return vide("intranet:offres", "Offres internes");
    return module("intranet:offres", el("section", { classe: "carte liste-liens" }, [
      el("h2", { texte: o.titre || "Offres internes" }),
      ...l.slice(0, 4).map((x) => lien(x.lien, null, [el("span", { classe: "titre", texte: x.titre }), el("span", { classe: "meta", texte: [x.meta, x.pays === "ES" ? "España" : ""].filter(rempli).join(" · ") })])),
      lienFort(o.lienLien, o.lienTexte)
    ]));
  }
  function carteCampagne() {
    const c = I.campagne;
    if (!rempli(c.titre)) return vide("intranet:campagne", "Campagne");
    const t = theme(c.theme || "rouge");
    return module("intranet:campagne", el("section", { classe: "carte campagne", style: { background: t.fort, color: t.surFort } }, [
      rempli(c.etiquette) ? el("span", { classe: "badge", style: { background: "#fff", color: t.texte }, texte: c.etiquette }) : null,
      el("h2", { texte: c.titre }),
      rempli(c.texte) ? el("p", { texte: c.texte }) : null,
      rempli(c.boutonTexte) ? lien(c.boutonLien, { classe: "bouton clair pousse-bas", texte: c.boutonTexte }) : null
    ]));
  }
  function carteCse() {
    const c = I.cse;
    if (!rempli(c.accroche) && !rempli(c.texte)) return vide("intranet:cse", "Le CSE vous informe");
    return module("intranet:cse", el("section", { classe: "carte" }, [
      el("div", { classe: "entete-ligne" }, [el("h2", { texte: c.titre || "Le CSE vous informe", style: { margin: 0, fontSize: "22px" } }), icone("coeur", { couleur: "#9C1D5B" })]),
      rempli(c.accroche) ? el("p", { style: { margin: 0, fontWeight: 700 }, texte: c.accroche }) : null,
      rempli(c.texte) ? el("p", { classe: "gris petit texte-long", style: { margin: 0 }, texte: c.texte }) : null,
      lienFort(c.lienLien, c.lienTexte)
    ]));
  }

  // Sondage anonyme
  function carteSondage() {
    const sd = I.sondage;
    if (!sd.actif || !(sd.options || []).length) return vide("intranet:sondage", "Sondage");
    const etat = SES.sondage || {};
    const carte = el("section", { classe: "carte sondage" });
    const dessiner = () => {
      carte.querySelectorAll(":scope > :not(.btn-edition)").forEach((n) => n.remove());
      const avant = carte.querySelector(".btn-edition");
      const ajouter = (n) => carte.insertBefore(n, avant);
      ajouter(el("h2", { texte: sd.titre || "Votre avis compte" }));
      ajouter(el("p", { style: { margin: 0, fontWeight: 600 }, texte: sd.question }));
      if (etat.monVote === null || etat.monVote === undefined) {
        const erreur = el("p", { classe: "gris petit", role: "alert", hidden: true });
        ajouter(el("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } }, sd.options.map((o, i) =>
          el("button", { type: "button", classe: "option", texte: o.libelle, onclick: async () => {
            try {
              const r = await fetch("/api/sondage", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-Hub": "1" }, body: JSON.stringify({ version: etat.version, option: i }) });
              const j = await r.json();
              if (!r.ok) throw new Error(j.erreur || "Vote impossible.");
              Object.assign(etat, j); dessiner();
            } catch (e) { erreur.textContent = e.message; erreur.hidden = false; }
          } }))));
        ajouter(erreur);
      } else {
        ajouter(el("p", { classe: "merci", texte: "Merci ! Votre réponse a bien été prise en compte." }));
      }
      if (etat.resultats) {
        const total = etat.total || 0;
        ajouter(el("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } }, sd.options.map((o, i) => {
          const n = etat.resultats[i] || 0, pc = total ? Math.round((n * 100) / total) : 0;
          return el("div", { classe: "resultat" }, [el("span", { classe: "libelle" }, [el("span", { texte: o.libelle + (etat.monVote === i ? " (votre réponse)" : "") }), el("span", { texte: pc + " %" })]),
            el("span", { classe: "barre", "aria-hidden": "true" }, [el("i", { style: { width: pc + "%" } })])]);
        })));
        ajouter(el("p", { classe: "gris tres-petit", style: { margin: 0 }, texte: total + (total > 1 ? " réponses" : " réponse") }));
      }
      ajouter(el("p", { classe: "gris tres-petit pousse-bas", style: { margin: 0 }, texte: sd.signature || "" }));
    };
    module("intranet:sondage", carte);
    dessiner();
    return carte;
  }

  function carteChiffres() {
    const c = I.chiffres, l = c.elements || [];
    if (!l.length && !c.photo) return vide("intranet:chiffres", "Dyneff en bref");
    return module("intranet:chiffres", el("section", { classe: "carte bref" }, [
      c.photo ? el("div", { classe: "photo" }, [el("img", { src: c.photo, alt: "Les locaux de Dyneff" })]) : null,
      el("div", { classe: "contenu" }, [
        el("h2", { texte: c.titre || "Dyneff en bref" }),
        ...l.map((x) => el("div", { classe: "chiffre" }, [el("strong", { texte: x.valeur, style: { color: x.theme === "gris" || !x.theme ? "#1C1F24" : theme(x.theme).fort === "#FFD203" ? "#7A5C00" : theme(x.theme).fort } }), el("span", { texte: x.libelle || "" })])),
        rempli(c.lienTexte) ? lien(c.lienLien, { classe: "lien-fort", texte: c.lienTexte }) : null
      ])
    ]));
  }

  function pastilleSite(s) {
    const t = theme(["rouge", "vert", "bleu", "orange", "violet", "rose", "gris", "jaune"][(s.nom || "").length % 8]);
    return lien(s.url, { classe: "site" }, [el("span", { classe: "initiales", style: { background: t.doux, color: t.texte }, "aria-hidden": "true", texte: U.initiales(s.nom) }), s.nom]);
  }
  function carteSites(limite) {
    const m = I.sites, l = m.elements || [];
    if (!l.length) return vide("intranet:sites", "Sites SharePoint");
    const zone = el("div", { classe: "sites" });
    const filtre = el("input", { type: "search", placeholder: "Filtrer les sites…", "aria-label": "Filtrer les sites" });
    const maj = () => {
      const q = U.normaliser(filtre.value.trim());
      let liste = l.filter((s) => !q || U.normaliser(s.nom).includes(q));
      if (limite && !q) liste = liste.slice(0, limite);
      zone.replaceChildren(...liste.map(pastilleSite));
      if (!liste.length) zone.append(el("p", { classe: "gris", texte: "Aucun site ne correspond." }));
    };
    filtre.addEventListener("input", maj); maj();
    return module("intranet:sites", el("section", { classe: "carte" }, [
      el("div", { classe: "entete-ligne", style: { flexWrap: "wrap" } }, [el("h2", { texte: m.titre || "Sites SharePoint", style: { margin: 0, fontSize: "22px" } }), el("div", { classe: "filtre-local", style: { flex: "1 1 220px" } }, [filtre])]),
      zone,
      el("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px 24px" } }, [
        limite && l.length > limite ? el("a", { href: "#/sites", classe: "lien-fort", texte: "Voir les " + l.length + " sites" }) : null,
        rempli(m.lienToutTexte) ? lien(m.lienToutLien, { classe: "lien-fort", texte: m.lienToutTexte }) : null])
    ]));
  }

  // ======================================================================
  // PAGES SECONDAIRES
  // ======================================================================
  function titrePage(titre, sousTitre, fil) {
    return el("div", null, [
      fil ? el("nav", { classe: "fil", "aria-label": "Fil d'Ariane" }, fil) : null,
      el("div", { classe: "titre-page" }, [el("h1", { texte: titre }), rempli(sousTitre) ? el("p", { texte: sousTitre }) : null])]);
  }
  const filAccueil = () => [el("a", { href: "#/", texte: "Accueil" }), " › "];

  let filtrePage = "";
  function pageActualites() {
    const page = el("div", { classe: "page largeur" });
    page.appendChild(titrePage(I.actualites.titre || "Actualités", (I.actualites.elements || []).length + " articles", filAccueil().concat(["Actualités"])));
    const champ = el("input", { type: "search", placeholder: "Rechercher une actualité…", "aria-label": "Rechercher une actualité" });
    const zone = el("div");
    const maj = () => {
      const q = U.normaliser(champ.value.trim());
      const liste = filtrer(actualitesTriees(), filtrePage).filter((a) => !q || U.normaliser(a.titre + " " + a.resume + " " + a.texte).includes(q));
      zone.replaceChildren(puces(filtresActus(), filtrePage, (v) => { filtrePage = v; maj(); }), el("div", { style: { height: "16px" } }), grilleActus(liste));
    };
    champ.addEventListener("input", maj); maj();
    page.appendChild(module("intranet:actualites", el("section", { style: { position: "relative", display: "flex", flexDirection: "column", gap: "16px" } }, [el("div", { classe: "filtre-local" }, [champ]), zone])));
    return page;
  }

  function pageArticle(id) {
    const a = (I.actualites.elements || []).find((x) => x.id === id);
    const page = el("div", { classe: "page largeur" });
    if (!a) { page.append(titrePage("Actualité introuvable", "Elle a peut-être été retirée.", filAccueil().concat([el("a", { href: "#/actualites", texte: "Actualités" })]))); return page; }
    const t = etiquetteActu(a), th = theme(t.theme), s = service(a.service);
    page.appendChild(el("nav", { classe: "fil", "aria-label": "Fil d'Ariane" }, filAccueil().concat([el("a", { href: "#/actualites", texte: "Actualités" }), " › ", a.titre])));
    const art = el("article", { classe: "article" }, [
      el("div", { classe: "visuel", style: { background: th.doux }, "aria-hidden": "true" }, [a.image ? el("img", { src: a.image, alt: "" }) : icone(t.icone, { taille: 72, couleur: th.texte, epaisseur: 1.4 })]),
      el("div", { classe: "corps" }, [
        el("span", { classe: "badge", style: { background: th.doux, color: th.texte }, texte: t.texte }),
        el("h1", { texte: a.titre }),
        el("p", { classe: "gris petit", style: { margin: 0 }, texte: [U.dateLongue(U.dateDe(a.date) || new Date()), a.auteur, a.pays === "ES" ? "España" : ""].filter(rempli).join(" · ") }),
        el("div", { classe: "texte" }, U.paragraphes(a.texte || a.resume)),
        el("div", { style: { display: "flex", flexWrap: "wrap", gap: "12px" } }, [
          rempli(a.lien) ? lien(a.lien, { classe: "bouton sombre", texte: "Ouvrir le lien" }) : null,
          s ? el("a", { classe: "bouton contour", href: "#/services/" + s.id, texte: "Espace " + s.nom }) : null,
          el("a", { classe: "bouton contour", href: "#/actualites", texte: "Toutes les actualités" })])
      ])]);
    const cle = peut("intranet:actualites") ? "intranet:actualites" : (s && peut("intranet:service:" + s.id + ":actualites") ? "intranet:service:" + s.id + ":actualites" : null);
    page.appendChild(cle ? module(cle, art, "Modifier les actualités") : art);
    return page;
  }

  function pageServices() {
    const page = el("div", { classe: "page largeur" });
    page.appendChild(titrePage(I.services.titre || "Espaces services", I.services.sousTitre, filAccueil().concat(["Espaces services"])));
    page.appendChild(module("intranet:services", el("div", { style: { position: "relative" } }, [grilleServices()])));
    return page;
  }

  function pageAgenda() {
    const page = el("div", { classe: "page largeur" });
    page.appendChild(titrePage(I.agenda.titre || "Agenda", "", filAccueil().concat(["Agenda"])));
    const auj = U.isoAujourdhui();
    const tous = (I.agenda.elements || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const avenir = tous.filter((e) => e.date >= auj), passes = tous.filter((e) => e.date < auj).reverse();
    const parMois = {};
    for (const e of avenir) { const d = U.dateDe(e.date); const k = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }); (parMois[k] = parMois[k] || []).push(e); }
    const corps = el("section", { classe: "carte", style: { gap: "24px" } }, Object.keys(parMois).length
      ? Object.entries(parMois).map(([m, l]) => el("div", { classe: "mois" }, [el("h2", { texte: m }), ...l.map(evenement)]))
      : [el("p", { classe: "gris", style: { margin: 0 }, texte: "Aucun événement à venir." })]);
    if (passes.length) corps.appendChild(el("details", null, [el("summary", { classe: "lien-fort", texte: "Événements passés (" + passes.length + ")" }), el("div", { style: { display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" } }, passes.map(evenement))]));
    page.appendChild(module("intranet:agenda", corps));
    return page;
  }

  function pageSites() {
    const page = el("div", { classe: "page largeur" });
    page.appendChild(titrePage(I.sites.titre || "Sites SharePoint", "Accès aux sites SharePoint existants de l'intranet", filAccueil().concat(["Sites SharePoint"])));
    page.appendChild(carteSites(0));
    return page;
  }

  function pageAnnuaire() {
    const page = el("div", { classe: "page largeur" });
    page.appendChild(titrePage("Annuaire", "Retrouver un collègue", filAccueil().concat(["Annuaire"])));
    const r = I.reglages;
    const carte = el("section", { classe: "carte", style: { maxWidth: "640px" } });
    if (rempli(r.annuaireUrl)) {
      const champ = el("input", { type: "search", required: true, placeholder: "Nom ou prénom", "aria-label": "Nom à rechercher", style: { flex: 1, minWidth: 0, height: "44px", border: "1px solid #BFC4CB", borderRadius: "10px", padding: "0 12px", font: "inherit" } });
      const form = el("form", { style: { display: "flex", gap: "8px" } }, [champ, el("button", { classe: "bouton vert", texte: "Rechercher" })]);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const u = r.annuaireUrl, p = r.annuaireParametre;
        window.open(p ? u + (u.includes("?") ? "&" : "?") + encodeURIComponent(p) + "=" + encodeURIComponent(champ.value.trim()) : u, "_blank", "noopener");
      });
      carte.append(el("h2", { texte: "Annuaire Dyneff" }), el("p", { classe: "gris", style: { margin: 0 }, texte: "La recherche s'ouvre dans l'annuaire de l'entreprise." }), form);
    } else {
      carte.append(el("h2", { texte: "Annuaire Dyneff" }), el("p", { classe: "gris", style: { margin: 0 }, texte: "L'adresse de l'annuaire n'est pas encore renseignée." + (peut("intranet:reglages") ? " Ajoutez-la dans « Réglages » (bouton Modifier)." : "") }));
    }
    page.appendChild(module("intranet:reglages", carte, "Réglages"));
    return page;
  }

  // ---------- Espace service ----------
  function pageService(id) {
    const s = service(id);
    const conteneur = el("div");
    if (!s) { const p = el("div", { classe: "page largeur" }); p.append(titrePage("Espace introuvable", "", filAccueil().concat([el("a", { href: "#/services", texte: "Espaces services" })]))); return p; }
    const p = (I.pages && I.pages[id]) || {};
    const t = theme(s.theme), cle = (m) => "intranet:service:" + id + ":" + m;
    const ent = p.entete || {};
    const st = site(s.site);

    // Bandeau
    const menu = el("nav", { classe: "sous-menu", "aria-label": "Menu de l'espace " + s.nom }, [el("a", { classe: "actif", href: "#/services/" + id, "aria-current": "page", texte: "Accueil" })]
      .concat((ent.liens || []).map((l) => lien(l.lien, { texte: l.texte })))
      .concat(st && rempli(st.url) ? [lien(st.url, { texte: "Site SharePoint ↗" })] : []));
    const cta = rempli(ent.boutonTexte) ? lien(ent.boutonLien, { classe: "bouton " + (s.theme === "jaune" ? "sombre" : "jaune"), texte: ent.boutonTexte }) : null;
    const banniere = el("div", { classe: "banniere", style: { background: t.fort, color: t.surFort } }, [el("div", { classe: "largeur" }, [
      el("nav", { classe: "fil", "aria-label": "Fil d'Ariane", style: { color: t.douxFort } }, [el("a", { href: "#/", texte: "Accueil" }), " › ", el("a", { href: "#/services", texte: "Espaces services" }), " › ", s.nom]),
      el("div", { classe: "titre" }, [
        el("div", { classe: "identite" }, [el("span", { classe: "pictogramme" }, [icone(s.icone, { taille: 32, couleur: t.texte })]),
          el("div", null, [el("h1", { texte: s.nom }), rempli(ent.accroche) ? el("p", { style: { color: t.douxFort }, texte: ent.accroche }) : null])]),
        cta]),
      menu])]);
    conteneur.appendChild(module(cle("entete"), banniere, "Modifier le bandeau"));

    const page = el("div", { classe: "page largeur" });
    // Raccourcis
    const r = p.raccourcis || {};
    if ((r.elements || []).length) {
      page.appendChild(module(cle("raccourcis"), el("section", { style: { position: "relative", display: "flex", flexDirection: "column", gap: "14px" } }, [
        enteteSection(r.titre || "Raccourcis", r.sousTitre),
        el("div", { classe: "grille-raccourcis" }, r.elements.map((x) => lien(x.lien, { classe: "raccourci" }, [
          pictogramme(x.icone, s.theme, "grand", 22), el("span", { classe: "libelle", texte: x.libelle }), rempli(x.detail) ? el("span", { classe: "detail", texte: x.detail }) : null])))
      ])));
    } else { const v = vide(cle("raccourcis"), "Raccourcis"); if (v) page.appendChild(v); }

    const principale = el("div", { classe: "principale" }), laterale = el("aside", { classe: "laterale" });
    // À la une de l'espace
    const u = p.une || {};
    if (rempli(u.titre)) {
      principale.appendChild(module(cle("une"), el("article", { classe: "carte une-service" }, [
        el("div", { classe: "visuel", style: { background: t.doux }, "aria-hidden": "true" }, [u.image ? el("img", { src: u.image, alt: "" }) : icone(u.icone || s.icone, { taille: 72, couleur: t.texte, epaisseur: 1.4 })]),
        el("div", { classe: "texte" }, [
          rempli(u.etiquette) ? el("span", { classe: "etiquette-une", texte: u.etiquette }) : null,
          el("h2", { texte: u.titre }), rempli(u.texte) ? el("p", { classe: "texte-long", texte: u.texte }) : null,
          el("div", { style: { display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "4px" } }, [
            rempli(u.bouton1Texte) ? lien(u.bouton1Lien, { classe: "bouton", style: { background: t.fort, color: t.surFort }, texte: u.bouton1Texte }) : null,
            bouton(u.bouton2Lien, u.bouton2Texte, "contour")].filter(Boolean))])])));
    } else { const v = vide(cle("une"), "À la une de l'espace"); if (v) principale.appendChild(v); }
    // Liste
    const li = p.liste || {};
    if ((li.elements || []).length) {
      principale.appendChild(module(cle("liste"), el("section", { classe: "carte liste-liens", style: { gap: "4px" } }, [
        el("div", { classe: "entete-section", style: { marginBottom: "8px" } }, [el("h2", { texte: li.titre || "À noter", style: { fontSize: "22px" } }), rempli(li.lienToutTexte) ? lien(li.lienToutLien, { classe: "lien-fort", texte: li.lienToutTexte }) : null]),
        ...li.elements.map((x) => lien(x.lien, { classe: "ligne-offre" }, [
          el("span", null, [el("span", { classe: "titre", texte: x.titre }), el("span", { classe: "meta", texte: x.meta || "" })]),
          rempli(x.badge) ? el("span", { classe: "badge", style: x.badge === "España" ? { background: "#F1EAFB", color: "#5B2A99" } : { background: "#ECEDEF", color: "#1C1F24" }, texte: x.badge }) : null]))
      ])));
    } else { const v = vide(cle("liste"), "Liste"); if (v) principale.appendChild(v); }
    // FAQ
    const fq = p.faq || {};
    if ((fq.elements || []).length) {
      principale.appendChild(module(cle("faq"), el("section", { classe: "carte", style: { gap: "4px" } }, [
        el("h2", { texte: fq.titre || "Questions fréquentes", style: { marginBottom: "8px" } }),
        ...fq.elements.map((q) => el("details", { classe: "question" }, [el("summary", { texte: q.question }), el("p", { texte: q.reponse || "" })]))])));
    } else { const v = vide(cle("faq"), "Questions fréquentes"); if (v) principale.appendChild(v); }
    // Actualités de l'espace
    const actus = actualitesTriees().filter((a) => a.service === id);
    if (actus.length || peut(cle("actualites"))) {
      principale.appendChild(module(cle("actualites"), el("section", { style: { position: "relative", display: "flex", flexDirection: "column", gap: "14px" } }, [
        enteteSection("Actualités de l'espace", ""), actus.length ? grilleActus(actus.slice(0, 6)) : el("p", { classe: "vide-carte", texte: "Aucune actualité publiée par cet espace." })])));
    }

    // Colonne latérale
    const cal = p.calendrier || {};
    if ((cal.elements || []).length) {
      laterale.appendChild(module(cle("calendrier"), el("section", { classe: "carte", style: { gap: "6px" } }, [el("h2", { texte: cal.titre || "Calendrier", style: { marginBottom: "6px" } }),
        ...cal.elements.map((c) => el("div", { classe: "calendrier-ligne" }, [el("strong", { style: { color: s.theme === "jaune" ? "#7A5C00" : t.fort }, texte: c.quand }), el("span", { texte: c.quoi || "" })]))])));
    } else { const v = vide(cle("calendrier"), "Calendrier"); if (v) laterale.appendChild(v); }
    const docs = p.documents || {};
    if ((docs.elements || []).length) {
      laterale.appendChild(module(cle("documents"), el("section", { classe: "carte", style: { gap: "8px" } }, [el("h2", { texte: docs.titre || "Documents utiles" }),
        ...docs.elements.map((d) => lien(d.lien, { classe: "doc" }, [icone("document", { taille: 20, couleur: "#5A616B" }), el("span", { classe: "nom", texte: d.nom }), el("span", { classe: "type", texte: d.type || "" })]))])));
    } else { const v = vide(cle("documents"), "Documents utiles"); if (v) laterale.appendChild(v); }
    const ct = p.contacts || {};
    if ((ct.elements || []).length) {
      laterale.appendChild(module(cle("contacts"), el("section", { classe: "carte" }, [el("h2", { texte: ct.titre || "Contacts" }),
        ...ct.elements.map((c) => el("div", { classe: "contact" }, [
          el("span", { classe: "avatar", style: { background: t.doux, color: t.texte }, "aria-hidden": "true", texte: U.initiales(c.nom) }),
          el("div", { classe: "infos" }, [el("p", { style: { fontWeight: 700 }, texte: c.nom }), el("p", { classe: "gris petit", texte: c.role || "" })]),
          rempli(c.lien) ? lien(c.lien, { classe: "action", "aria-label": "Contacter " + c.nom }, [icone("bulle", { taille: 18 })]) : null]))])));
    } else { const v = vide(cle("contacts"), "Contacts"); if (v) laterale.appendChild(v); }
    const en = p.encart || {};
    if (rempli(en.titre)) {
      laterale.appendChild(module(cle("encart"), el("section", { classe: "carte encart" }, [el("h2", { texte: en.titre }), rempli(en.texte) ? el("p", { texte: en.texte }) : null,
        rempli(en.boutonTexte) ? lien(en.boutonLien, { classe: "bouton jaune", texte: en.boutonTexte }) : null])));
    } else { const v = vide(cle("encart"), "Encart"); if (v) laterale.appendChild(v); }
    if (st) {
      laterale.appendChild(el("section", { classe: "carte carte-site" }, [pictogramme("lien", s.theme, "grand", 22),
        el("div", null, [el("p", { style: { fontWeight: 700 }, texte: "Site SharePoint « " + st.nom + " »" }),
          rempli(st.url) ? lien(st.url, { classe: "lien-fort", texte: "Ouvrir le site ↗" }) : el("p", { classe: "gris petit", texte: "Adresse à compléter dans « Sites SharePoint »." })])]));
    }
    page.appendChild(el("div", { classe: "colonnes" }, [principale, laterale]));
    page.appendChild(el("p", { classe: "gris petit", style: { margin: 0 }, texte: "Espace animé par le service " + s.nom + "." }));
    conteneur.appendChild(page);
    return conteneur;
  }

  // ---------- Recherche globale ----------
  function pageRecherche(q) {
    const page = el("div", { classe: "page largeur" });
    const mots = U.normaliser(q).split(/\s+/).filter(Boolean);
    page.appendChild(titrePage("Recherche", mots.length ? "Résultats pour « " + q + " »" : "Saisissez un mot dans la barre de recherche.", filAccueil().concat(["Recherche"])));
    if (!mots.length) return page;
    const trouve = (...textes) => { const t = U.normaliser(textes.join(" ")); return mots.every((m) => t.includes(m)); };
    const groupes = [];
    const ajouter = (titre, liste) => { if (liste.length) groupes.push([titre, liste.slice(0, 20)]); };
    const ligne = (url, ico, th, titre, meta) => lien(url, { classe: "resultat-ligne" }, [pictogramme(ico, th), el("span", null, [el("span", { classe: "titre", texte: titre }), el("span", { classe: "meta", texte: meta || "" })])]);
    ajouter("Actualités", actualitesTriees().filter((a) => trouve(a.titre, a.resume, a.texte)).map((a) => { const t = etiquetteActu(a); return ligne("#/actualites/" + a.id, t.icone, t.theme, a.titre, t.texte + " · " + U.relatif(a.date)); }));
    ajouter("Espaces services", services().filter((s) => trouve(s.nom, s.desc, s.court)).map((s) => ligne("#/services/" + s.id, s.icone, s.theme, s.nom, s.desc)));
    const contenusEspaces = [];
    for (const s of services()) {
      const p = (I.pages || {})[s.id] || {};
      for (const x of (p.raccourcis && p.raccourcis.elements) || []) if (trouve(x.libelle, x.detail)) contenusEspaces.push(ligne(x.lien || "#/services/" + s.id, x.icone || s.icone, s.theme, x.libelle, s.nom));
      for (const x of (p.documents && p.documents.elements) || []) if (trouve(x.nom, x.type)) contenusEspaces.push(ligne(x.lien || "#/services/" + s.id, "document", s.theme, x.nom, s.nom + " · " + (x.type || "")));
      for (const x of (p.faq && p.faq.elements) || []) if (trouve(x.question, x.reponse)) contenusEspaces.push(ligne("#/services/" + s.id, "question", s.theme, x.question, s.nom + " · Questions fréquentes"));
      for (const x of (p.liste && p.liste.elements) || []) if (trouve(x.titre, x.meta)) contenusEspaces.push(ligne(x.lien || "#/services/" + s.id, "document", s.theme, x.titre, s.nom));
    }
    ajouter("Dans les espaces services", contenusEspaces);
    ajouter("Agenda", (I.agenda.elements || []).filter((e) => trouve(e.titre, e.lieu)).map((e) => ligne("#/agenda", "calendrier", "rouge", e.titre, [U.dateCourte(e.date), e.lieu].filter(rempli).join(" · "))));
    if (typeof HUB !== "undefined") {
      const apps = [];
      for (const sec of HUB) for (const a of sec.apps) if (trouve(a.name, a.desc, sec.title)) apps.push(ligne("#/hub/" + sec.id, "grille", "jaune", a.name, sec.title + (a.desc ? " · " + a.desc : "")));
      ajouter("Applications", apps);
    }
    if (typeof BIBLIOTHEQUE !== "undefined") ajouter("Guides Tips, IA & outils", (BIBLIOTHEQUE.fichiers || []).filter((f) => trouve(f.nom, f.outil, f.theme)).map((f) => ligne("#/tips", "etincelle", "jaune", f.nom, [f.outil, f.theme].filter(rempli).join(" · "))));
    ajouter("Sites SharePoint", (I.sites.elements || []).filter((s) => trouve(s.nom)).map((s) => ligne(s.url, "lien", "gris", s.nom, "Site SharePoint")));
    const res = el("div", { classe: "resultats" }, groupes.map(([t, l]) => el("section", { classe: "groupe-resultats" }, [el("h2", { texte: t + " (" + l.length + ")" }), ...l])));
    if (!groupes.length) res.append(el("p", { classe: "vide-carte", texte: "Aucun résultat. Essayez un autre mot." }));
    page.appendChild(res);
    return page;
  }

  // ======================================================================
  // EN-TÊTE, ALERTE, PIED DE PAGE, NAVIGATION
  // ======================================================================
  function dessinerCadre() {
    $("nom-site").textContent = I.reglages.nomSite || "Intranet";
    // Alerte
    const a = I.alerte, zoneA = $("alerte");
    zoneA.replaceChildren();
    if (a.actif && rempli(a.texte)) {
      zoneA.appendChild(module("intranet:alerte", el("div", { classe: "alerte " + (a.style === "rouge" ? "rouge" : ""), role: "status" }, [el("div", { classe: "largeur" }, [
        rempli(a.etiquette) ? el("span", { classe: "etiquette", texte: a.etiquette }) : null,
        el("span", { classe: "message", texte: a.texte }),
        rempli(a.lienTexte) ? lien(a.lienLien, { texte: a.lienTexte }) : null])])));
    } else if (peut("intranet:alerte")) {
      zoneA.appendChild(module("intranet:alerte", el("div", { classe: "alerte seulement-edition" }, [el("div", { classe: "largeur" }, [el("span", { classe: "message", texte: "Bandeau d'alerte masqué." })])])));
    }
    // Pied de page
    const pd = I.pied;
    $("pied").replaceChildren(module("intranet:pied", el("div", { classe: "largeur" }, [
      el("strong", { texte: (I.reglages.nomSite || "Intranet") + " Dyneff" }),
      ...(pd.liens || []).map((l) => lien(l.lien, { texte: l.texte })),
      el("span", { classe: "espace" }), el("span", { texte: pd.adresse || "" })])));
    // Navigation principale
    const nav = $("nav-principale");
    const entrees = [["", "Accueil"], ["actualites", "Actualités"], ["services", "Espaces services"], ["annuaire", "Annuaire"]];
    nav.replaceChildren(...entrees.map(([r, t]) => el("a", { href: "#/" + r, "data-route": r, texte: t })));
    if (rempli(I.reglages.documentsUrl)) nav.appendChild(lien(I.reglages.documentsUrl, { texte: "Documents ↗" }));
    nav.appendChild(el("a", { href: "#/agenda", "data-route": "agenda", texte: "Agenda" }));
    if (service("cse")) nav.appendChild(el("a", { href: "#/services/cse", "data-route": "services/cse", texte: "CSE" }));
    nav.appendChild(el("span", { classe: "espace" }));
    nav.appendChild(el("a", { classe: "outil", href: "#/hub", "data-route": "hub" }, [icone("grille", { taille: 16 }), "Hub applicatif"]));
    nav.appendChild(el("a", { classe: "outil", href: "#/tips", "data-route": "tips" }, [icone("etincelle", { taille: 16 }), "Tips, IA & outils"]));
    // Navigation mobile
    $("nav-mobile").replaceChildren(...[["", "Accueil", "batiment"], ["actualites", "Actualités", "megaphone"], ["services", "Services", "personnes"], ["hub", "Applis", "grille"], ["tips", "Tips", "etincelle"]]
      .map(([r, t, i]) => el("a", { href: "#/" + r, "data-route": r }, [icone(i, { taille: 22 }), t])));
  }

  // ---------- Routeur ----------
  function analyser() {
    let h = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!h.startsWith("/")) {
      // Anciennes adresses : #hub, #tips, #intranet, #<section du hub>
      const ancienne = document.getElementById(h);
      h = h === "hub" || h === "tips" ? "/" + h : ancienne && ancienne.classList.contains("groupe") ? "/hub/" + h : "/";
    }
    return h.replace(/^\/+/, "").split("/");
  }
  let premier = true;
  function afficher() {
    const [p0, p1] = analyser();
    const vue = p0 === "hub" ? "hub" : p0 === "tips" ? "tips" : "intranet";
    for (const v of ["intranet", "hub", "tips"]) document.body.classList.toggle("vue-" + v, v === vue);
    $("page-intranet").hidden = vue !== "intranet";
    $("page-hub").hidden = vue !== "hub";
    $("page-tips").hidden = vue !== "tips";
    let titre = "Accueil";
    if (vue === "intranet") {
      let contenu;
      if (p0 === "actualites" && p1) { contenu = pageArticle(p1); titre = "Actualité"; }
      else if (p0 === "actualites") { contenu = pageActualites(); titre = "Actualités"; }
      else if (p0 === "services" && p1) { contenu = pageService(p1); titre = (service(p1) || {}).nom || "Espace"; }
      else if (p0 === "services") { contenu = pageServices(); titre = "Espaces services"; }
      else if (p0 === "agenda") { contenu = pageAgenda(); titre = "Agenda"; }
      else if (p0 === "sites") { contenu = pageSites(); titre = "Sites SharePoint"; }
      else if (p0 === "annuaire") { contenu = pageAnnuaire(); titre = "Annuaire"; }
      else if (p0 === "recherche") { contenu = pageRecherche(p1 || ""); titre = "Recherche"; $("q").value = p1 || ""; }
      else contenu = pageAccueil();
      $("page-intranet").replaceChildren(contenu);
    } else titre = vue === "hub" ? "Hub applicatif" : "Tips, IA & outils collaboratifs";
    document.title = titre + " · " + (I.reglages.nomSite || "Intranet") + " Dyneff";

    const route = p0 === "services" && p1 === "cse" ? "services/cse" : p0 || "";
    document.querySelectorAll("[data-route]").forEach((a) => {
      const r = a.getAttribute("data-route");
      const actif = r === route || (r === "services" && p0 === "services" && route !== "services/cse") || (r === "actualites" && p0 === "actualites");
      if (actif) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (vue === "hub" && p1 && window.HUB_APPS) setTimeout(() => window.HUB_APPS.allerA(p1), 0);
    else if (!premier) { window.scrollTo(0, 0); $("contenu").focus({ preventScroll: true }); }
    premier = false;
  }

  $("recherche-globale").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("q").value.trim();
    location.hash = "#/recherche/" + encodeURIComponent(q);
  });
  window.addEventListener("hashchange", afficher);
  dessinerCadre();
  afficher();
  window.HUB_INTRANET = { afficher, dessinerCadre };
})();
