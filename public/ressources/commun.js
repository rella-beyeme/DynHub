/*
 * HUB DYNEFF — petits outils communs aux scripts de la page.
 */
(function () {
  "use strict";
  const S = window.HUB_SCHEMAS;

  // Création d'un élément : el("a", { classe: "x", texte: "…", href: "…" }, [enfants])
  function el(tag, attrs, enfants) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v === false || v == null) continue;
      if (k === "texte") e.textContent = v;
      else if (k === "classe") e.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, "");
      else e.setAttribute(k, v);
    }
    (enfants || []).forEach((c) => { if (c != null && c !== false) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }

  const NS = "http://www.w3.org/2000/svg";
  function icone(nom, options) {
    const o = Object.assign({ taille: 24, couleur: "currentColor", epaisseur: 2 }, options || {});
    const def = S.ICONES[nom] || S.ICONES.document;
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", o.taille); svg.setAttribute("height", o.taille);
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", o.couleur); svg.setAttribute("stroke-width", o.epaisseur);
    svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true"); svg.setAttribute("class", "ico");
    const p = document.createElementNS(NS, "path"); p.setAttribute("d", def.d);
    svg.appendChild(p);
    return svg;
  }
  // Pastille colorée avec pictogramme (fond pâle du thème, trait foncé)
  function pictogramme(nomIcone, nomTheme, classe, taille) {
    const t = theme(nomTheme);
    return el("span", { classe: "pictogramme " + (classe || ""), style: { background: t.doux } }, [icone(nomIcone, { taille: taille || 20, couleur: t.texte })]);
  }
  function theme(nom) { return S.THEMES[nom] || S.THEMES.gris; }

  // Lien : https://… (nouvel onglet), #/… (page du hub), mailto:/tel:, vide = « à compléter »
  function lier(a, url) {
    url = String(url || "").trim();
    if (!url) {
      a.classList.add("a-completer");
      a.setAttribute("aria-disabled", "true");
      a.title = "Lien à compléter";
      a.removeAttribute("href");
      return a;
    }
    a.href = url;
    if (/^https?:/i.test(url)) { a.target = "_blank"; a.rel = "noopener"; }
    return a;
  }
  function lien(url, attrs, enfants) { return lier(el("a", attrs, enfants), url); }

  function initiales(nom) {
    const mots = String(nom || "?").replace(/[\[\]()]/g, "").replace(/[^A-Za-zÀ-ÿ0-9 ,'-]/g, " ").split(/[\s,]+/).filter(Boolean);
    return (mots.length > 1 ? mots[0][0] + mots[1][0] : String(mots[0] || "?").slice(0, 2)).toUpperCase();
  }

  // ---------- Dates ----------
  function dateDe(iso) { const p = String(iso || "").split("-"); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; }
  function aujourdhui() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function isoAujourdhui() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function dateLongue(d) {
    const t = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function dateCourte(iso) {
    const d = dateDe(iso); if (!d) return "";
    const o = { day: "numeric", month: "short" };
    if (d.getFullYear() !== new Date().getFullYear()) o.year = "numeric";
    return d.toLocaleDateString("fr-FR", o);
  }
  function relatif(iso) {
    const d = dateDe(iso); if (!d) return "";
    const n = Math.round((aujourdhui() - d) / 86400000);
    if (n === 0) return "Aujourd'hui";
    if (n === 1) return "Hier";
    if (n > 1 && n < 7) return "Il y a " + n + " jours";
    return dateCourte(iso);
  }
  function moisCourt(iso) { const d = dateDe(iso); return d ? d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "") : ""; }

  // Texte long : une ligne vide sépare les paragraphes
  function paragraphes(texte) {
    return String(texte || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => el("p", { classe: "texte-long", texte: p }));
  }
  function normaliser(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

  window.HUB_UI = { el, icone, pictogramme, theme, lier, lien, initiales, dateDe, aujourdhui, isoAujourdhui, dateLongue, dateCourte, relatif, moisCourt, paragraphes, normaliser };
})();
