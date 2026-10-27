/*
 * HUB DYNEFF — mode édition et gestion des droits.
 * Les boutons n'apparaissent que pour les parties que la personne connectée a
 * le droit de modifier (liste calculée par le serveur). Le serveur vérifie de
 * nouveau chaque modification : masquer un bouton n'est pas la sécurité.
 */
(function () {
  "use strict";
  if (typeof SESSION_HUB === "undefined") return;
  const S = SESSION_HUB;
  const peut = (cle) => S.cles.indexOf(cle) !== -1;
  const $ = (id) => document.getElementById(id);

  // ---------- Utilitaires ----------
  function el(tag, attrs, enfants) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === "texte") e.textContent = attrs[k];
      else if (k === "classe") e.className = attrs[k];
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] === true) e.setAttribute(k, "");
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]);
    }
    (enfants || []).forEach((c) => c && e.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return e;
  }
  const CRAYON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  function boutonEdition(libelle, action, titre) {
    const b = el("button", { type: "button", classe: "btn-edition", title: titre || libelle, "aria-label": titre || libelle, onclick: (e) => { e.stopPropagation(); action(); } });
    b.innerHTML = CRAYON + (libelle ? "<span>" + libelle.replace(/[<>&]/g, "") + "</span>" : "");
    return b;
  }
  async function appel(methode, url, corps) {
    const rep = await fetch(url, {
      method: methode, credentials: "same-origin",
      headers: Object.assign({ "X-Hub": "1" }, corps ? { "Content-Type": "application/json" } : {}),
      body: corps ? JSON.stringify(corps) : undefined
    });
    let json = {};
    try { json = await rep.json(); } catch (e) { /* réponse vide */ }
    if (!rep.ok) throw new Error(json.erreur || "Erreur " + rep.status);
    return json;
  }
  function envoyerFichier(url, donnees, progression) {
    return new Promise((ok, ko) => {
      const x = new XMLHttpRequest();
      x.open("POST", url);
      x.setRequestHeader("X-Hub", "1");
      x.upload.onprogress = (e) => { if (e.lengthComputable && progression) progression(e.loaded / e.total); };
      x.onload = () => {
        let j = {}; try { j = JSON.parse(x.responseText); } catch (e) { /* ignore */ }
        x.status < 300 ? ok(j) : ko(new Error(j.erreur || "Erreur " + x.status));
      };
      x.onerror = () => ko(new Error("Connexion au serveur interrompue."));
      x.send(donnees);
    });
  }
  const recharger = () => location.reload();

  // ---------- Fenêtre ----------
  function fenetre(titre, large) {
    const dlg = el("dialog", { classe: "fenetre edition" + (large ? " large" : ""), "aria-label": titre });
    const corps = el("div", { classe: "ed-corps" });
    const msg = el("p", { classe: "ed-erreur", role: "alert", hidden: true });
    const pied = el("div", { classe: "ed-pied" });
    dlg.append(
      el("div", { classe: "fen-tete" }, [el("h3", { texte: titre }), el("button", { type: "button", classe: "fen-fermer", "aria-label": "Fermer", texte: "×", onclick: () => dlg.close() })]),
      corps, el("div", { classe: "ed-bas" }, [msg, pied]));
    dlg.addEventListener("close", () => dlg.remove());
    document.body.appendChild(dlg);
    dlg.showModal();
    return {
      dlg, corps, pied,
      erreur(t) { msg.textContent = t || ""; msg.hidden = !t; },
      fermer() { dlg.close(); }
    };
  }
  function boutonsEnregistrer(f, action, libelle) {
    const ok = el("button", { type: "button", classe: "bib-btn principal", texte: libelle || "Enregistrer" });
    ok.addEventListener("click", async () => {
      f.erreur(""); ok.disabled = true; ok.textContent = "Enregistrement…";
      try { await action(); }
      catch (e) { f.erreur(e.message); ok.disabled = false; ok.textContent = libelle || "Enregistrer"; }
    });
    f.pied.append(el("button", { type: "button", classe: "bib-btn", texte: "Annuler", onclick: () => f.fermer() }), ok);
    return ok;
  }

  // ---------- Champs de formulaire ----------
  let compteur = 0;
  const lirePath = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  function ecrirePath(o, p, v) { const ks = p.split("."); let a = o; ks.slice(0, -1).forEach((k) => { a = a[k] = a[k] && typeof a[k] === "object" ? a[k] : {}; }); a[ks[ks.length - 1]] = v; }

  function champ(def, valeur) {
    const id = "ed-" + (++compteur);
    const bloc = el("div", { classe: "ed-champ" + (def.large ? " large" : "") + (def.type === "case" ? " case" : "") });
    let lire;
    const lab = def.libelle ? el("label", { for: id, texte: def.libelle }) : null;
    if (def.type === "case") {
      const i = el("input", { type: "checkbox", id });
      i.checked = !!valeur; lire = () => i.checked;
      bloc.append(i, lab);
    } else if (def.type === "zone") {
      const t = el("textarea", { id, rows: 3, maxlength: def.max || 1500 }); t.value = valeur || ""; lire = () => t.value;
      bloc.append(lab, t);
    } else if (def.type === "select") {
      const s = el("select", { id });
      [""].concat(def.options).forEach((o) => s.appendChild(el("option", { value: o, texte: o || "— aucun —" })));
      s.value = valeur || ""; lire = () => s.value;
      bloc.append(lab, s);
    } else if (def.type === "couleur") {
      const c = el("input", { type: "color", id }); c.value = /^#[0-9a-f]{6}$/i.test(valeur || "") ? valeur : (def.defaut || "#2B79D0");
      lire = () => c.value.toUpperCase();
      bloc.append(lab, c);
    } else if (def.type === "lecture") {
      const v = el("div", { classe: "ed-lecture", texte: valeur || "", title: valeur || "" }); lire = () => valeur;
      bloc.append(lab ? el("span", { classe: "ed-libelle", texte: def.libelle }) : null, v);
    } else if (def.type === "image") {
      const ligne = el("div", { classe: "ed-ligne" });
      const t = el("input", { type: "text", id, placeholder: "images/… ou https://…" }); t.value = valeur || "";
      const apercu = el("img", { classe: "ed-vignette", alt: "" });
      const maj = () => { apercu.hidden = !t.value; if (t.value) apercu.src = t.value; };
      t.addEventListener("input", maj);
      const f = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", hidden: true });
      const b = el("button", { type: "button", classe: "bib-btn", texte: "Envoyer une image…", onclick: () => f.click() });
      f.addEventListener("change", async () => {
        if (!f.files[0]) return;
        b.disabled = true; b.textContent = "Envoi…";
        try { const fd = new FormData(); fd.append("image", f.files[0]); const r = await envoyerFichier("/api/images", fd); t.value = r.chemin; maj(); }
        catch (e) { alert(e.message); }
        b.disabled = false; b.textContent = "Envoyer une image…";
      });
      ligne.append(t, b, f); maj();
      lire = () => t.value.trim();
      bloc.append(lab, ligne, apercu);
    } else if (def.type === "liste") {
      return champListe(def, valeur);
    } else {
      const i = el("input", { type: def.type === "date" ? "date" : "text", id, placeholder: def.placeholder || (def.type === "url" ? "https://…" : ""), maxlength: def.max || 2000 });
      i.value = valeur || ""; lire = () => i.value.trim();
      bloc.append(lab, i);
    }
    if (def.aide) bloc.appendChild(el("small", { classe: "ed-aide", texte: def.aide }));
    return { el: bloc, lire };
  }

  function champListe(def, valeurs) {
    const bloc = el("div", { classe: "ed-champ large ed-liste" });
    if (def.libelle) bloc.appendChild(el("span", { classe: "ed-libelle", texte: def.libelle }));
    const ul = el("ol", { classe: "ed-elements" });
    const lignes = [];
    function ajouterLigne(v) {
      const orig = Object.assign({}, v || {});
      const li = el("li", { classe: "ed-element" });
      const grille = el("div", { classe: "ed-grille" });
      const champs = def.champs.map((c) => { const ch = champ(c, lirePath(orig, c.cle)); grille.appendChild(ch.el); return { def: c, ch }; });
      const ligne = { li, lire: () => { const o = Object.assign({}, orig); champs.forEach((x) => ecrirePath(o, x.def.cle, x.ch.lire())); return o; } };
      const actions = el("div", { classe: "ed-actions" });
      const deplacer = (d) => {
        const i = lignes.indexOf(ligne), j = i + d;
        if (j < 0 || j >= lignes.length) return;
        lignes.splice(i, 1); lignes.splice(j, 0, ligne);
        if (d < 0) ul.insertBefore(li, lignes[j + 1].li); else ul.insertBefore(li, lignes[j - 1].li.nextSibling);
      };
      actions.append(
        el("button", { type: "button", classe: "ed-mini", title: "Monter", "aria-label": "Monter", texte: "↑", onclick: () => deplacer(-1) }),
        el("button", { type: "button", classe: "ed-mini", title: "Descendre", "aria-label": "Descendre", texte: "↓", onclick: () => deplacer(1) }));
      if (def.suppression !== false) actions.appendChild(el("button", {
        type: "button", classe: "ed-mini danger", title: "Retirer", "aria-label": "Retirer", texte: "✕",
        onclick: () => {
          if (def.confirmerSuppression && !confirm(def.confirmerSuppression(ligne.lire()))) return;
          lignes.splice(lignes.indexOf(ligne), 1); li.remove();
        }
      }));
      li.append(grille, actions);
      ul.appendChild(li); lignes.push(ligne);
      return ligne;
    }
    (valeurs || []).forEach(ajouterLigne);
    bloc.appendChild(ul);
    if (def.ajout !== false) {
      bloc.appendChild(el("button", {
        type: "button", classe: "bib-btn", texte: "+ " + (def.libelleAjout || "Ajouter"),
        onclick: () => { const l = ajouterLigne(def.nouveau ? def.nouveau() : {}); const i = l.li.querySelector("input,textarea,select"); if (i) i.focus(); }
      }));
    }
    if (def.aide) bloc.appendChild(el("small", { classe: "ed-aide", texte: def.aide }));
    return { el: bloc, lire: () => lignes.map((l) => l.lire()) };
  }

  function formulaire(conteneur, defs, valeurs) {
    const grille = el("div", { classe: "ed-grille principale" });
    const champs = defs.map((d) => { const c = champ(d, lirePath(valeurs, d.cle)); grille.appendChild(c.el); return { d, c }; });
    conteneur.appendChild(grille);
    return () => { const o = JSON.parse(JSON.stringify(valeurs || {})); champs.forEach((x) => ecrirePath(o, x.d.cle, x.c.lire())); return o; };
  }

  // Édition générique d'une partie
  function editer(cle, defs, options) {
    const s = S.sections[cle];
    if (!s) return;
    options = options || {};
    const f = fenetre(options.titre || s.libelle, options.large);
    if (options.intro) f.corps.appendChild(el("p", { classe: "ed-intro", texte: options.intro }));
    const lire = formulaire(f.corps, defs, s.contenu);
    if (options.supplement) options.supplement(f);
    boutonsEnregistrer(f, async () => {
      await appel("PUT", "/api/sections/" + encodeURIComponent(cle), { contenu: lire(), empreinte: s.empreinte });
      recharger();
    });
  }

  // ---------- Barre utilisateur et mode édition ----------
  const zone = $("zone-utilisateur");
  let modeEdition = false;
  try { modeEdition = localStorage.getItem("hub-dyneff-edition") === "1"; } catch (e) { /* ignore */ }
  function appliquerMode() { document.body.classList.toggle("edition-active", modeEdition); }

  if (zone) {
    const initiales = (S.utilisateur.nom || S.utilisateur.email || "?").split(/[\s,]+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join("").toUpperCase();
    const menu = el("div", { classe: "util-menu", hidden: true, role: "menu" });
    const bouton = el("button", { type: "button", classe: "util-bouton", "aria-haspopup": "true", "aria-expanded": "false", title: S.utilisateur.email },
      [el("span", { classe: "util-pastille", texte: initiales }), el("span", { classe: "util-nom", texte: S.utilisateur.nom || S.utilisateur.email })]);
    bouton.addEventListener("click", () => { menu.hidden = !menu.hidden; bouton.setAttribute("aria-expanded", String(!menu.hidden)); });
    document.addEventListener("click", (e) => { if (!zone.contains(e.target)) { menu.hidden = true; bouton.setAttribute("aria-expanded", "false"); } });
    menu.appendChild(el("div", { classe: "util-entete" }, [el("strong", { texte: S.utilisateur.nom || "" }), el("span", { texte: S.utilisateur.email || "" })]));
    if (S.mode === "demo") menu.appendChild(el("div", { classe: "util-demo", texte: "Mode démonstration" }));
    if (S.cles.length) {
      const bascule = el("button", { type: "button", role: "menuitemcheckbox", classe: "util-item" });
      const majBascule = () => { bascule.textContent = modeEdition ? "Quitter le mode modification" : "Modifier la page"; bascule.setAttribute("aria-checked", String(modeEdition)); };
      bascule.addEventListener("click", () => {
        modeEdition = !modeEdition;
        try { localStorage.setItem("hub-dyneff-edition", modeEdition ? "1" : "0"); } catch (e) { /* ignore */ }
        appliquerMode(); majBascule(); majTips(); menu.hidden = true;
      });
      majBascule(); menu.appendChild(bascule);
      // Accès direct : bouton visible à côté du nom
      const raccourci = el("button", { type: "button", classe: "util-raccourci", onclick: () => bascule.click() });
      const majRaccourci = () => { raccourci.innerHTML = CRAYON + "<span>" + (modeEdition ? "Terminer" : "Modifier") + "</span>"; };
      bascule.addEventListener("click", majRaccourci); majRaccourci();
      zone.appendChild(raccourci);
    }
    if (S.admin) menu.appendChild(el("button", { type: "button", role: "menuitem", classe: "util-item", texte: "Gérer les droits de modification", onclick: () => { menu.hidden = true; gererDroits(); } }));
    menu.appendChild(el("a", { role: "menuitem", classe: "util-item", href: "/deconnexion", texte: "Se déconnecter" }));
    zone.append(bouton, menu);
  }
  appliquerMode();

  // ---------- Onglet Intranet ----------
  if (peut("intranet:accueil")) {
    const h2 = $("intra-titre");
    h2.parentNode.insertBefore(el("div", { classe: "ed-zone-titre" }, [boutonEdition("Modifier", () => editer("intranet:accueil", [
      { cle: "titre", libelle: "Titre", type: "texte", max: 120, large: true },
      { cle: "photo", libelle: "Photo d'accueil", type: "image", large: true },
      { cle: "legende", libelle: "Légende sous la photo", type: "texte", max: 300, large: true },
      { cle: "toutLeContenu", libelle: "Lien « Afficher tout le contenu du site »", type: "url", large: true },
      { cle: "annuaire.url", libelle: "Adresse de recherche de l'annuaire", type: "url", large: true },
      { cle: "annuaire.parametre", libelle: "Paramètre de recherche (ex. k ou nom)", type: "texte", max: 40 }
    ]), "Modifier l'accueil")]), h2.nextSibling);
  }
  const champsSite = [
    { cle: "nom", libelle: "Nom du site", type: "texte", max: 80 },
    { cle: "url", libelle: "Adresse SharePoint", type: "url", placeholder: "http://intranet…/sites/…" },
    { cle: "barre", libelle: "Afficher dans la barre du haut", type: "case" },
    { cle: "liste", libelle: "Afficher dans la colonne « Sites »", type: "case" }
  ];
  document.querySelectorAll("#intra-sites li[data-id]").forEach((li) => {
    const cle = "intranet:site:" + li.dataset.id;
    if (peut(cle)) li.appendChild(boutonEdition("", () => editer(cle, champsSite), "Modifier le site " + li.textContent.trim()));
  });
  // Sites présents seulement dans la barre du haut (ex. l'accueil « Dyneff »)
  document.querySelectorAll("#intra-barre a[data-id]").forEach((a) => {
    const cle = "intranet:site:" + a.dataset.id;
    if (peut(cle) && !document.querySelector('#intra-sites li[data-id="' + a.dataset.id + '"]'))
      a.after(boutonEdition("", () => editer(cle, champsSite), "Modifier le site " + a.textContent.trim()));
  });
  if (peut("intranet:sites")) {
    const bloc = $("intra-sites").closest(".intra-bloc");
    bloc.appendChild(el("div", { classe: "ed-pied-bloc" }, [boutonEdition("Gérer la liste des sites", () => editer("intranet:sites", [
      { cle: "sites", type: "liste", libelleAjout: "Ajouter un site", champs: champsSite, nouveau: () => ({ nom: "", url: "", barre: false, liste: true }),
        aide: "L'ordre de la liste est celui de la barre du haut ; la colonne « Sites » est triée par ordre alphabétique." }
    ], { large: true }))]));
  }
  function boutonDansBloc(conteneurId, cle, defs, options) {
    if (!peut(cle)) return;
    const h3 = $(conteneurId).closest(".intra-bloc").querySelector("h3");
    h3.appendChild(boutonEdition("", () => editer(cle, defs, options), "Modifier : " + h3.textContent.trim()));
  }
  boutonDansBloc("intra-liens", "intranet:liens", [
    { cle: "liens", type: "liste", libelleAjout: "Ajouter un lien", champs: [{ cle: "nom", libelle: "Nom", type: "texte", max: 80 }, { cle: "url", libelle: "Adresse", type: "url" }] }
  ]);
  boutonDansBloc("intra-annonces", "intranet:annonces", [
    { cle: "annonces", type: "liste", libelleAjout: "Ajouter une annonce", nouveau: () => ({ auteur: S.utilisateur.nom || "" }), champs: [
      { cle: "titre", libelle: "Titre", type: "texte", max: 160 }, { cle: "auteur", libelle: "Auteur", type: "texte", max: 80 },
      { cle: "texte", libelle: "Texte", type: "zone", large: true }, { cle: "url", libelle: "Lien (facultatif)", type: "url", large: true }] }
  ], { large: true });

  // ---------- Onglet Tips (bibliothèque) ----------
  const actionsBib = el("span", { classe: "ed-actions-bib" });
  const boutonAjouter = $("bib-ajouter");
  if (boutonAjouter) boutonAjouter.parentNode.insertBefore(actionsBib, boutonAjouter);
  const outils = Object.keys((typeof BIBLIOTHEQUE !== "undefined" && BIBLIOTHEQUE.outils) || {});
  const themes = Object.keys((typeof BIBLIOTHEQUE !== "undefined" && BIBLIOTHEQUE.themes) || {});

  function majTips() {
    const B = window.HUB_BIB;
    if (!B || !boutonAjouter) return;
    actionsBib.innerHTML = "";
    const filtre = !!(B.etat.q || B.etat.outil || B.etat.theme);
    const idD = B.etat.dossier || "";
    const cleD = "tips:dossier:" + (idD || "racine");
    const droit = peut(cleD) && !filtre;
    boutonAjouter.hidden = !droit;
    if (!modeEdition) return;
    if (droit) {
      actionsBib.append(
        boutonEdition("Nouveau dossier", () => nouveauDossier(idD)),
        boutonEdition(idD ? "Modifier ce dossier" : "Gérer les fichiers", () => editerDossier(idD)));
    }
    if (peut("tips:reglages")) actionsBib.appendChild(boutonEdition("Outils et thèmes", editerReglagesTips));
  }
  window.addEventListener("bib:rendu", majTips);
  majTips();

  if (boutonAjouter) boutonAjouter.addEventListener("click", () => {
    const B = window.HUB_BIB; const idD = B.etat.dossier || "";
    const d = idD ? B.dossier(idD) : null;
    const f = fenetre("Ajouter un document" + (d ? " dans « " + d.nom + " »" : ""));
    f.corps.appendChild(el("p", { classe: "ed-intro", texte: "PDF, vidéo (MP4 conseillé), image, Word, Excel, PowerPoint, ZIP… Taille maximale : " + S.tailleMaxMo + " Mo." }));
    const fichier = el("input", { type: "file", id: "ed-fichier" });
    const grille = el("div", { classe: "ed-grille principale" });
    grille.appendChild(el("div", { classe: "ed-champ large" }, [el("label", { for: "ed-fichier", texte: "Fichier" }), fichier]));
    const o = champ({ libelle: "Outil", type: "select", options: outils }, ""), t = champ({ libelle: "Thème", type: "select", options: themes }, "");
    grille.append(o.el, t.el);
    const barre = el("div", { classe: "ed-progression", hidden: true }, [el("span")]);
    f.corps.append(grille, barre);
    boutonsEnregistrer(f, async () => {
      if (!fichier.files[0]) throw new Error("Choisissez un fichier.");
      if (fichier.files[0].size > S.tailleMaxMo * 1024 * 1024) throw new Error("Fichier trop volumineux (maximum " + S.tailleMaxMo + " Mo).");
      const fd = new FormData();
      fd.append("dossier", idD); fd.append("outil", o.lire()); fd.append("theme", t.lire()); fd.append("fichier", fichier.files[0]);
      barre.hidden = false;
      await envoyerFichier("/api/fichiers", fd, (p) => { barre.firstChild.style.width = Math.round(p * 100) + "%"; });
      recharger();
    }, "Envoyer");
  });

  function nouveauDossier(parent) {
    const f = fenetre("Nouveau dossier");
    const lire = formulaire(f.corps, [
      { cle: "nom", libelle: "Nom du dossier", type: "texte", max: 80, large: true },
      { cle: "couleur", libelle: "Couleur de l'icône", type: "couleur", defaut: "#2B79D0" }
    ], {});
    boutonsEnregistrer(f, async () => {
      const v = lire();
      if (!v.nom) throw new Error("Indiquez un nom.");
      await appel("POST", "/api/dossiers", { parent, nom: v.nom, couleur: v.couleur });
      recharger();
    }, "Créer");
  }

  function editerDossier(idD) {
    const B = window.HUB_BIB;
    const cle = "tips:dossier:" + (idD || "racine");
    const defs = [];
    if (idD) defs.push({ cle: "nom", libelle: "Nom du dossier", type: "texte", max: 80 }, { cle: "couleur", libelle: "Couleur de l'icône", type: "couleur" });
    defs.push({ cle: "fichiers", type: "liste", libelle: "Fichiers du dossier", ajout: false,
      confirmerSuppression: (f) => "Retirer « " + f.nom + " » ? Le fichier sera placé dans la corbeille du serveur.",
      aide: "Pour ajouter un fichier, fermez cette fenêtre et utilisez « Ajouter un document ».",
      champs: [
        { cle: "nom", libelle: "Fichier", type: "lecture", large: true },
        { cle: "outil", libelle: "Outil", type: "select", options: outils },
        { cle: "theme", libelle: "Thème", type: "select", options: themes },
        { cle: "auteur", libelle: "Modifié par", type: "texte", max: 80 },
        { cle: "modifie", libelle: "Date", type: "date" }
      ] });
    const d = idD ? B.dossier(idD) : null;
    const vide = idD && !BIBLIOTHEQUE.fichiers.some((x) => x.dossier === idD) && !BIBLIOTHEQUE.dossiers.some((x) => x.parent === idD);
    editer(cle, defs, {
      large: true,
      supplement: (f) => {
        if (d && vide && peut("tips:dossier:" + (d.parent || "racine"))) {
          f.corps.appendChild(el("div", { classe: "ed-danger" }, [
            el("span", { texte: "Ce dossier est vide." }),
            el("button", { type: "button", classe: "bib-btn danger", texte: "Supprimer le dossier", onclick: async () => {
              if (!confirm("Supprimer le dossier « " + d.nom + " » ?")) return;
              try { await appel("DELETE", "/api/dossiers/" + encodeURIComponent(idD)); B.etat.dossier = d.parent || ""; recharger(); }
              catch (e) { f.erreur(e.message); }
            } })]));
        }
      }
    });
  }

  function editerReglagesTips() {
    const etiquettes = (cle, libelle) => ({ cle, libelle, type: "liste", libelleAjout: "Ajouter", nouveau: () => ({ nom: "", fond: "#EDEFF2", texte: "#39404A" }), champs: [
      { cle: "nom", libelle: "Nom", type: "texte", max: 40 }, { cle: "fond", libelle: "Fond", type: "couleur" }, { cle: "texte", libelle: "Texte", type: "couleur" }] });
    editer("tips:reglages", [
      { cle: "titre", libelle: "Titre de la bibliothèque", type: "texte", max: 80 },
      { cle: "lienSharePoint", libelle: "Lien « Ouvrir dans SharePoint » (facultatif)", type: "url" },
      etiquettes("outils", "Étiquettes « Outil »"), etiquettes("themes", "Étiquettes « Thème »")
    ], { large: true });
  }

  // ---------- Onglet Hub applicatif ----------
  const champsApp = [
    { cle: "name", libelle: "Nom", type: "texte", max: 80 },
    { cle: "desc", libelle: "Description", type: "texte", max: 160 },
    { cle: "url", libelle: "Lien en ligne", type: "url" },
    { cle: "desktop", libelle: "Lien bureau (facultatif)", type: "texte", placeholder: "msteams:, ms-word:nft|u|https://…" },
    { cle: "logo", libelle: "Logo (facultatif)", type: "image" },
    { cle: "doc", libelle: "Documentation (facultatif)", type: "url" }
  ];
  document.querySelectorAll("section.groupe").forEach((sec) => {
    const cle = "hub:section:" + sec.id;
    if (!peut(cle)) return;
    const h2 = sec.querySelector(".groupe-titre");
    h2.appendChild(boutonEdition("", () => editer(cle, [
      { cle: "title", libelle: "Titre de la section", type: "texte", max: 80 },
      { cle: "subtitle", libelle: "Sous-titre", type: "texte", max: 160 },
      { cle: "accent", libelle: "Couleur", type: "couleur" },
      { cle: "ferme", libelle: "Section repliée par défaut", type: "case" },
      { cle: "apps", libelle: "Applications", type: "liste", libelleAjout: "Ajouter une application", champs: champsApp }
    ], {
      large: true,
      supplement: (f) => {
        if (!peut("hub:reglages")) return;
        f.corps.appendChild(el("div", { classe: "ed-danger" }, [
          el("span", { texte: "Supprimer toute la section et ses applications." }),
          el("button", { type: "button", classe: "bib-btn danger", texte: "Supprimer la section", onclick: async () => {
            if (!confirm("Supprimer définitivement la section « " + S.sections[cle].contenu.title + " » ?")) return;
            try { await appel("DELETE", "/api/hub/sections/" + encodeURIComponent(sec.id)); recharger(); } catch (e) { f.erreur(e.message); }
          } })]));
      }
    }), "Modifier la section"));
  });
  if (peut("hub:reglages")) {
    const tout = document.querySelector("nav.sommaire .tout");
    if (tout) tout.appendChild(boutonEdition("Réglages du hub", () => editer("hub:reglages", [
      { cle: "docGenerale", libelle: "Documentation générale (pour les cartes sans documentation)", type: "url", large: true },
      { cle: "ordre", libelle: "Ordre des sections", type: "liste", ajout: false, suppression: false, champs: [{ cle: "title", type: "lecture", large: true }] }
    ], {
      supplement: (f) => {
        f.corps.appendChild(el("div", { classe: "ed-danger neutre" }, [
          el("span", { texte: "Créer une nouvelle section vide (enregistrez d'abord vos autres changements)." }),
          el("button", { type: "button", classe: "bib-btn", texte: "+ Nouvelle section", onclick: async () => {
            const titre = prompt("Titre de la nouvelle section :");
            if (!titre) return;
            try { await appel("POST", "/api/hub/sections", { title: titre }); recharger(); } catch (e) { f.erreur(e.message); }
          } })]));
      }
    })));
  }

  // ---------- Gestion des droits (administrateurs) ----------
  async function gererDroits() {
    const f = fenetre("Droits de modification", true);
    f.corps.classList.add("droits");
    f.corps.appendChild(el("p", { classe: "ed-intro", texte: "Chargement…" }));
    let d;
    try { d = await appel("GET", "/api/droits"); } catch (e) { f.erreur(e.message); return; }
    f.corps.innerHTML = "";
    const gauche = el("nav", { classe: "dr-liste", "aria-label": "Parties du hub" });
    const droite = el("div", { classe: "dr-detail" });
    f.corps.append(gauche, droite);
    f.pied.appendChild(el("button", { type: "button", classe: "bib-btn", texte: "Fermer", onclick: () => f.fermer() }));

    const entrees = [{ cle: "__admins", libelle: "Administrateurs du hub", niveau: 0, onglet: "admin" }].concat(d.catalogue);
    const valeurs = (cle) => (cle === "__admins" ? d.admins : d.acl[cle] || []);
    const boutons = {};
    let courant = null;

    function ligne(e) {
      const n = valeurs(e.cle).length;
      const b = el("button", { type: "button", classe: "dr-item niv-" + Math.min(e.niveau, 4) + (e.niveau === 0 ? " onglet" : ""), onclick: () => afficher(e) },
        [el("span", { classe: "dr-lib", texte: e.libelle }), el("span", { classe: "dr-nb", texte: n ? String(n) : "" })]);
      boutons[e.cle] = b;
      return b;
    }
    let ongletPrec = null;
    for (const e of entrees) {
      if (e.onglet !== ongletPrec && e.onglet !== "admin") gauche.appendChild(el("div", { classe: "dr-groupe", texte: d.onglets[e.onglet] }));
      ongletPrec = e.onglet;
      gauche.appendChild(ligne(e));
    }

    function afficher(e) {
      courant = e;
      Object.values(boutons).forEach((b) => b.classList.remove("actif"));
      boutons[e.cle].classList.add("actif");
      droite.innerHTML = "";
      let liste = valeurs(e.cle).map((p) => Object.assign({}, p));
      droite.appendChild(el("h4", { texte: e.libelle }));
      droite.appendChild(el("p", { classe: "ed-aide", texte:
        e.cle === "__admins" ? "Les administrateurs peuvent tout modifier et gérer les droits." :
        e.niveau === 0 ? "Ces personnes peuvent modifier toutes les parties de l'onglet." :
        /^tips:dossier:(?!racine)/.test(e.cle) ? "Ces personnes peuvent modifier ce dossier et ses sous-dossiers. Les personnes nommées sur l'onglet entier le peuvent aussi." :
        "Les personnes nommées sur l'onglet entier peuvent aussi modifier cette partie." }));
      const chips = el("ul", { classe: "dr-personnes" });
      const enregistrer = el("button", { type: "button", classe: "bib-btn principal", texte: "Enregistrer", disabled: true });
      const etat = el("span", { classe: "dr-etat" });
      function rendreChips() {
        chips.innerHTML = "";
        if (e.cle === "__admins") d.adminsFixes.forEach((m) => chips.appendChild(el("li", { classe: "fixe", title: "Défini dans la configuration du serveur (ADMINS)" }, [el("span", { texte: m }), el("small", { texte: "permanent" })])));
        if (!liste.length && !(e.cle === "__admins" && d.adminsFixes.length)) chips.appendChild(el("li", { classe: "vide", texte: "Personne pour l'instant." }));
        liste.forEach((p, i) => chips.appendChild(el("li", null, [
          el("span", { texte: p.nom || p.email }), p.nom ? el("small", { texte: p.email }) : null,
          el("button", { type: "button", "aria-label": "Retirer " + (p.nom || p.email), texte: "✕", onclick: () => { liste.splice(i, 1); modifie(); } })])));
      }
      const modifie = () => { rendreChips(); enregistrer.disabled = false; etat.textContent = ""; };
      rendreChips();

      // Recherche de personnes
      const rech = el("input", { type: "search", placeholder: "Nom ou e-mail d'une personne…", "aria-label": "Rechercher une personne", autocomplete: "off" });
      const resultats = el("ul", { classe: "dr-resultats", hidden: true });
      let minuteur = null;
      function ajouter(p) {
        if (!liste.some((x) => (p.oid && x.oid === p.oid) || x.email === p.email)) liste.push(p);
        rech.value = ""; resultats.hidden = true; modifie(); rech.focus();
      }
      rech.addEventListener("input", () => {
        clearTimeout(minuteur);
        const q = rech.value.trim();
        if (q.length < 2) { resultats.hidden = true; return; }
        minuteur = setTimeout(async () => {
          resultats.innerHTML = "";
          let trouves = [];
          try { trouves = (await appel("GET", "/api/annuaire?q=" + encodeURIComponent(q))).personnes; }
          catch (err) { resultats.appendChild(el("li", { classe: "info", texte: err.message })); }
          trouves.forEach((p) => resultats.appendChild(el("li", null, [el("button", { type: "button", onclick: () => ajouter(p) }, [el("span", { texte: p.nom }), el("small", { texte: p.email })])])));
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q) && !trouves.some((p) => p.email === q.toLowerCase()))
            resultats.appendChild(el("li", null, [el("button", { type: "button", onclick: () => ajouter({ oid: "", email: q.toLowerCase(), nom: "" }) }, [el("span", { texte: "Ajouter " + q }), el("small", { texte: "par adresse e-mail" })])]));
          if (!resultats.children.length) resultats.appendChild(el("li", { classe: "info", texte: "Aucun résultat. Vous pouvez saisir une adresse e-mail complète." }));
          resultats.hidden = false;
        }, 300);
      });

      enregistrer.addEventListener("click", async () => {
        enregistrer.disabled = true; f.erreur("");
        try {
          await appel("PUT", e.cle === "__admins" ? "/api/admins" : "/api/droits/" + encodeURIComponent(e.cle), { personnes: liste });
          if (e.cle === "__admins") d.admins = liste.slice(); else d.acl[e.cle] = liste.slice();
          boutons[e.cle].querySelector(".dr-nb").textContent = liste.length ? String(liste.length) : "";
          etat.textContent = "Enregistré ✓ — effectif au prochain chargement de page des personnes concernées.";
        } catch (err) { f.erreur(err.message); enregistrer.disabled = false; }
      });

      droite.append(chips, el("div", { classe: "dr-ajout" }, [rech, resultats]), el("div", { classe: "dr-bas" }, [enregistrer, etat]));
    }
    afficher(entrees[1] || entrees[0]);
  }
})();
