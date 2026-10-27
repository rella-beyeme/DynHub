/*
 * HUB DYNEFF — bibliothèque « Tips, IA & outils collaboratifs » : dossiers,
 * filtres, aperçu des PDF et vidéos. Contenu : constante BIBLIOTHEQUE.
 */
(function () {
  const B = BIBLIOTHEQUE;
  const $ = function (id) { return document.getElementById(id); };

  const TYPES = {
    pdf:   { couleur: "#D13438", apercu: "pdf" },
    video: { couleur: "#7B4FC9", apercu: "video" },
    img:   { couleur: "#0F7B6C", apercu: "img" },
    doc:   { couleur: "#2B5797" },
    xls:   { couleur: "#1E7145" },
    ppt:   { couleur: "#C2410C" },
    autre: { couleur: "#6B7280" }
  };
  const EXT = {
    pdf: "pdf", mp4: "video", webm: "video", m4v: "video", mov: "video", ogv: "video",
    png: "img", jpg: "img", jpeg: "img", gif: "img", webp: "img", svg: "img",
    doc: "doc", docx: "doc", dotx: "doc", rtf: "doc", txt: "doc",
    xls: "xls", xlsx: "xls", xlsm: "xls", xltx: "xls", csv: "xls",
    ppt: "ppt", pptx: "ppt", potx: "ppt"
  };
  function extension(nom) { const m = /\.([a-z0-9]+)$/i.exec(nom || ""); return m ? m[1].toLowerCase() : ""; }
  function typeDe(nom) { return EXT[extension(nom)] || "autre"; }

  function svgFichier(nom, taille) {
    const t = TYPES[typeDe(nom)];
    const lib = (extension(nom) || "fic").toUpperCase().slice(0, 4);
    const h = Math.round(taille * 1.2);
    return '<svg class="ico" width="' + taille + '" height="' + h + '" viewBox="0 0 40 48" aria-hidden="true">' +
      '<path d="M6 1.5h20.5L38 13v31.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-41a2 2 0 0 1 2-2z" fill="#fff" stroke="#BFC5CD" stroke-width="1.5"/>' +
      '<path d="M26.5 1.5V11a2 2 0 0 0 2 2H38" fill="none" stroke="#BFC5CD" stroke-width="1.5"/>' +
      '<rect x="0" y="25" width="31" height="13" rx="2.5" fill="' + t.couleur + '"/>' +
      '<text x="15.5" y="34.6" text-anchor="middle" font-size="' + (lib.length > 3 ? 7.5 : 9) + '" font-weight="700" fill="#fff" font-family="Segoe UI, Arial, sans-serif">' + lib + '</text></svg>';
  }
  function svgDossier(couleur, taille) {
    const h = Math.round(taille * 0.82);
    return '<svg class="ico" width="' + taille + '" height="' + h + '" viewBox="0 0 48 40" aria-hidden="true">' +
      '<path d="M2 6a4 4 0 0 1 4-4h11.5a3 3 0 0 1 2.3 1.1L23 7h19a4 4 0 0 1 4 4v23a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" fill="' + couleur + '"/>' +
      '<path d="M2 13a3 3 0 0 1 3-3h38a3 3 0 0 1 3 3v21a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" fill="#fff" fill-opacity=".22"/></svg>';
  }

  // ---- Dossiers et chemins ----
  const dossiers = B.dossiers || [];
  const fichiers = B.fichiers || [];
  function dossier(id) { return dossiers.find(function (d) { return d.id === id; }) || null; }
  function ancetres(id) {               // [racine… , id]
    const liste = []; let d = dossier(id); let garde = 0;
    while (d && garde++ < 20) { liste.unshift(d); d = dossier(d.parent || ""); }
    return liste;
  }
  function urlFichier(f) {
    const segs = ancetres(f.dossier || "").map(function (d) { return d.chemin || d.nom; });
    segs.push(f.nom);
    return B.dossierFichiers + segs.map(encodeURIComponent).join("/");
  }
  function cheminServeur(id) {
    const segs = ancetres(id || "").map(function (d) { return d.chemin || d.nom; });
    return B.dossierFichiers + (segs.length ? segs.join("/") + "/" : "");
  }
  function nbElements(id) {
    return dossiers.filter(function (d) { return (d.parent || "") === id; }).length +
           fichiers.filter(function (f) { return (f.dossier || "") === id; }).length;
  }

  // ---- Dates ----
  function dateDe(iso) { const p = String(iso || "").split("-"); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; }
  function fmtDate(iso) {
    const d = dateDe(iso); if (!d) return "";
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    const jours = Math.round((auj - d) / 86400000);
    if (jours === 0) return "Aujourd'hui";
    if (jours === 1) return "Hier";
    if (jours > 1 && jours < 7) return "Il y a " + jours + " jours";
    const opts = { day: "numeric", month: "long" };
    if (d.getFullYear() !== auj.getFullYear()) opts.year = "numeric";
    return d.toLocaleDateString("fr-FR", opts);
  }

  function pastille(nom, palette) {
    if (!nom) return null;
    const s = document.createElement("span");
    s.className = "pastille"; s.textContent = nom; s.title = nom;
    const c = (palette || {})[nom];
    if (c) { s.style.background = c.fond; s.style.color = c.texte; }
    return s;
  }
  function el(tag, cls, texte) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texte != null) e.textContent = texte;
    return e;
  }

  // ---- État ----
  const etat = { dossier: "", q: "", outil: "", theme: "", tri: "nom", sens: 1, vue: "liste" };
  try { etat.vue = localStorage.getItem("hub-dyneff-vue-biblio") === "grille" ? "grille" : "liste"; } catch (e) {}

  // Filtres
  function remplirSelect(sel, valeurs, vide) {
    sel.innerHTML = "";
    const o = el("option", null, vide); o.value = ""; sel.appendChild(o);
    valeurs.forEach(function (v) { const op = el("option", null, v); op.value = v; sel.appendChild(op); });
  }
  function valeursUtilisees(cle, palette) {
    const set = Object.keys(palette || {});
    fichiers.forEach(function (f) { if (f[cle] && set.indexOf(f[cle]) === -1) set.push(f[cle]); });
    return set;
  }
  remplirSelect($("bib-outil"), valeursUtilisees("outil", B.outils), "Tous les outils");
  remplirSelect($("bib-theme"), valeursUtilisees("theme", B.themes), "Tous les thèmes");

  if (B.lienSharePoint) { $("bib-sharepoint").href = B.lienSharePoint; $("bib-sharepoint").hidden = false; }

  // ---- Rendu ----
  function filtreActif() { return !!(etat.q || etat.outil || etat.theme); }

  function elements() {
    let liste;
    if (filtreActif()) {
      const q = etat.q.toLowerCase();
      liste = fichiers.filter(function (f) {
        const texte = (f.nom + " " + (f.auteur || "") + " " + (f.outil || "") + " " + (f.theme || "")).toLowerCase();
        return (!q || texte.indexOf(q) !== -1) && (!etat.outil || f.outil === etat.outil) && (!etat.theme || f.theme === etat.theme);
      }).map(function (f) { return { type: "fichier", d: f }; });
    } else {
      liste = dossiers.filter(function (d) { return (d.parent || "") === etat.dossier; }).map(function (d) { return { type: "dossier", d: d }; })
        .concat(fichiers.filter(function (f) { return (f.dossier || "") === etat.dossier; }).map(function (f) { return { type: "fichier", d: f }; }));
    }
    liste.sort(function (a, b) {
      if (a.type !== b.type) return a.type === "dossier" ? -1 : 1;     // dossiers en premier
      let r;
      if (etat.tri === "modifie") r = (a.d.modifie || "").localeCompare(b.d.modifie || "");
      else r = (a.d.nom || "").localeCompare(b.d.nom || "", "fr", { sensitivity: "base", numeric: true });
      return r * etat.sens;
    });
    return liste;
  }

  function rendreFil() {
    const fil = $("bib-fil"); fil.innerHTML = "";
    const etapes = [{ id: "", nom: B.titre }].concat(ancetres(etat.dossier).map(function (d) { return { id: d.id, nom: d.nom }; }));
    if (filtreActif()) etapes.splice(1, etapes.length, { id: null, nom: "Résultats" });
    etapes.forEach(function (e, i) {
      if (i > 0) fil.appendChild(el("span", "sep", "›"));
      const dernier = i === etapes.length - 1;
      if (dernier) { fil.appendChild(el("span", "courant", e.nom)); return; }
      const b = el("button", null, e.nom); b.type = "button";
      b.addEventListener("click", function () { if (filtreActif()) effacer(false); etat.dossier = e.id || ""; rendre(); });
      fil.appendChild(b);
    });
  }

  function ouvrirElement(it) {
    if (it.type === "dossier") { etat.dossier = it.d.id; rendre(); $("bib-fil").querySelector(".courant").scrollIntoView({ block: "nearest" }); return; }
    ouvrirApercu(it.d.nom, urlFichier(it.d), true);
  }

  function sousTexte(it) {
    if (it.type === "dossier") { const n = nbElements(it.d.id); return n + (n > 1 ? " éléments" : " élément"); }
    if (filtreActif() && it.d.dossier) { const d = dossier(it.d.dossier); return d ? "Dans « " + d.nom + " »" : ""; }
    return "";
  }

  function rendreListe(liste, zone) {
    const cadre = el("div", "bib-cadre");
    const table = el("table", "bib-table");
    const thead = el("thead"); const tr = el("tr");
    function th(cls, label, cle) {
      const c = el("th", cls); c.scope = "col";
      if (!cle) { c.textContent = label; if (!label) c.innerHTML = '<span class="sr-only">Type</span>'; return c; }
      const b = el("button", null, label); b.type = "button";
      if (etat.tri === cle) { b.textContent = label + (etat.sens > 0 ? " ↑" : " ↓"); c.setAttribute("aria-sort", etat.sens > 0 ? "ascending" : "descending"); }
      b.addEventListener("click", function () { etat.sens = etat.tri === cle ? -etat.sens : (cle === "modifie" ? -1 : 1); etat.tri = cle; rendre(); });
      c.appendChild(b); return c;
    }
    tr.append(th("col-icone", ""), th("col-nom", "Nom", "nom"), th("col-modifie", "Modifié", "modifie"), th("col-par", "Modifié par"), th("col-outil", "Outil"), th("col-theme", "Thème"));
    thead.appendChild(tr); table.appendChild(thead);
    const tbody = el("tbody");
    liste.forEach(function (it) {
      const r = el("tr");
      const tdI = el("td", "col-icone");
      tdI.innerHTML = it.type === "dossier" ? svgDossier(it.d.couleur || "#E8A400", 26) : svgFichier(it.d.nom, 22);
      const tdN = el("td", "col-nom");
      const b = el("button", "bib-nom", it.d.nom); b.type = "button"; b.title = it.d.nom;
      b.setAttribute("aria-label", (it.type === "dossier" ? "Ouvrir le dossier " : "Aperçu de ") + it.d.nom);
      b.addEventListener("click", function () { ouvrirElement(it); });
      tdN.appendChild(b);
      const st = sousTexte(it); if (st) tdN.appendChild(el("span", "bib-sous", st));
      const mm = el("span", "meta-mobile");
      [pastille(it.d.outil, B.outils), pastille(it.d.theme, B.themes)].forEach(function (p) { if (p) mm.appendChild(p); });
      if (it.d.modifie) mm.appendChild(el("span", "bib-sous", fmtDate(it.d.modifie)));
      tdN.appendChild(mm);
      const tdM = el("td", "col-modifie"); tdM.appendChild(el("div", "bib-gris", fmtDate(it.d.modifie)));
      const tdP = el("td", "col-par"); const pp = el("div", "bib-gris", it.d.auteur || ""); pp.title = it.d.auteur || ""; tdP.appendChild(pp);
      const tdO = el("td", "col-outil"); const po = pastille(it.d.outil, B.outils); if (po) tdO.appendChild(po);
      const tdT = el("td", "col-theme"); const pt = pastille(it.d.theme, B.themes); if (pt) tdT.appendChild(pt);
      r.append(tdI, tdN, tdM, tdP, tdO, tdT);
      r.addEventListener("dblclick", function () { ouvrirElement(it); });
      tbody.appendChild(r);
    });
    table.appendChild(tbody); cadre.appendChild(table); zone.appendChild(cadre);
  }

  function rendreGrille(liste, zone) {
    const ul = el("ul", "bib-grille");
    liste.forEach(function (it) {
      const li = el("li");
      const b = el("button", "bib-carte"); b.type = "button";
      b.setAttribute("aria-label", (it.type === "dossier" ? "Ouvrir le dossier " : "Aperçu de ") + it.d.nom);
      const v = el("span", "visuel");
      v.innerHTML = it.type === "dossier" ? svgDossier(it.d.couleur || "#E8A400", 64) : svgFichier(it.d.nom, 48);
      const t = el("span", "titre", it.d.nom); t.title = it.d.nom;
      const s = el("span", "bib-sous", sousTexte(it) || fmtDate(it.d.modifie));
      const ps = el("span", "pastilles");
      [pastille(it.d.outil, B.outils), pastille(it.d.theme, B.themes)].forEach(function (p) { if (p) ps.appendChild(p); });
      b.append(v, t, s, ps);
      b.addEventListener("click", function () { ouvrirElement(it); });
      li.appendChild(b); ul.appendChild(li);
    });
    zone.appendChild(ul);
  }

  function rendre() {
    rendreFil();
    const liste = elements();
    const zone = $("bib-zone"); zone.innerHTML = "";
    const n = liste.length;
    $("bib-info").textContent = filtreActif()
      ? n + (n > 1 ? " documents trouvés" : " document trouvé") + " dans toute la bibliothèque"
      : n + (n > 1 ? " éléments" : " élément");
    $("bib-effacer").hidden = !filtreActif();
    document.querySelectorAll(".bib-vues button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.vue === etat.vue ? "true" : "false"); });
    if (!n) {
      const v = el("div", "bib-vide bib-cadre");
      v.appendChild(el("strong", null, filtreActif() ? "Aucun document ne correspond" : "Ce dossier est vide"));
      v.appendChild(document.createTextNode(filtreActif() ? "Essayez un autre mot-clé ou effacez les filtres." : "Utilisez « Ajouter un document » pour y déposer un fichier."));
      zone.appendChild(v); window.dispatchEvent(new CustomEvent("bib:rendu")); return;
    }
    (etat.vue === "grille" ? rendreGrille : rendreListe)(liste, zone);
    window.dispatchEvent(new CustomEvent("bib:rendu"));
  }

  function effacer(relancer) {
    etat.q = ""; etat.outil = ""; etat.theme = "";
    $("bib-q").value = ""; $("bib-outil").value = ""; $("bib-theme").value = "";
    if (relancer !== false) rendre();
  }

  $("bib-q").addEventListener("input", function () { etat.q = this.value.trim(); rendre(); });
  $("bib-outil").addEventListener("change", function () { etat.outil = this.value; rendre(); });
  $("bib-theme").addEventListener("change", function () { etat.theme = this.value; rendre(); });
  $("bib-effacer").addEventListener("click", function () { effacer(); $("bib-q").focus(); });
  document.querySelectorAll(".bib-vues button").forEach(function (b) {
    b.addEventListener("click", function () {
      etat.vue = b.dataset.vue;
      try { localStorage.setItem("hub-dyneff-vue-biblio", etat.vue); } catch (e) {}
      rendre();
    });
  });

  // ---- Aperçu ----
  const apercu = $("apercu"), corps = $("apercu-corps");
  function message(titre, texte, url, nom) {
    corps.className = "apercu-corps"; corps.innerHTML = "";
    const m = el("div", "apercu-msg"); m.appendChild(el("strong", null, titre)); m.appendChild(document.createTextNode(texte));
    if (url) { m.appendChild(document.createElement("br")); const a = el("a", "bib-btn principal", "Télécharger le fichier"); a.href = url; a.download = nom || ""; m.appendChild(a); }
    corps.appendChild(m);
  }
  function ouvrirApercu(nom, url, verifier) {
    $("apercu-titre").textContent = nom;
    $("apercu-onglet").href = url;
    $("apercu-telecharger").href = url; $("apercu-telecharger").download = nom;
    corps.className = "apercu-corps"; corps.innerHTML = "";
    const genre = (TYPES[typeDe(nom)] || {}).apercu;

    function afficher() {
      if (genre === "pdf") {
        const f = document.createElement("iframe"); f.src = url; f.title = "Aperçu de " + nom; corps.appendChild(f);
      } else if (genre === "video") {
        corps.classList.add("sombre");
        const v = document.createElement("video"); v.controls = true; v.preload = "metadata"; v.src = url;
        v.addEventListener("error", function () {
          message("Cette vidéo ne peut pas être lue ici", "Le format n'est peut-être pas pris en charge par le navigateur (préférez le MP4) ou le fichier est absent du serveur.", url, nom);
        });
        corps.appendChild(v);
      } else if (genre === "img") {
        const i = document.createElement("img"); i.alt = nom; i.src = url;
        i.addEventListener("error", function () { message("Image introuvable", "Le fichier est absent du serveur ou son nom ne correspond pas.", null); });
        corps.appendChild(i);
      } else {
        message("Pas d'aperçu pour ce type de fichier", "Les fichiers " + (extension(nom) || "sans extension").toUpperCase() + " s'ouvrent dans leur application : téléchargez-le pour le consulter.", url, nom);
      }
    }

    // Sur un serveur web, on vérifie d'abord que le fichier existe bien
    if (verifier && /^https?:$/.test(location.protocol) && !/^blob:/.test(url)) {
      fetch(url, { method: "HEAD" }).then(function (r) {
        if (r.ok) afficher();
        else message("Fichier introuvable sur le serveur", "Le document « " + nom + " » est référencé mais absent du serveur. Prévenez la personne qui gère ce dossier.", null);
      }).catch(afficher);
    } else afficher();

    if (apercu.showModal && !apercu.open) apercu.showModal();
  }
  function fermerApercu() { if (apercu.open) apercu.close(); }
  apercu.addEventListener("close", function () { corps.innerHTML = ""; });   // coupe la vidéo
  $("apercu-fermer").addEventListener("click", fermerApercu);
  apercu.addEventListener("click", function (e) { if (e.target === apercu) fermerApercu(); });

  // Accès pour le mode édition (ressources/edition.js)
  window.HUB_BIB = { etat: etat, rendre: rendre, dossier: dossier, ancetres: ancetres, ouvrirApercu: ouvrirApercu };

  rendre();
})();
