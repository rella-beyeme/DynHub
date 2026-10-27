/*
 * HUB DYNEFF — Hub applicatif : cartes des applications, sections repliables,
 * recherche. Contenu : constantes HUB et DOC_GENERALE insérées par le serveur.
 */
(function () {
  const ICONE_WEB = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>';
  const ICONE_BUREAU = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>';
  const ICONE_CHEVRON = '<svg class="chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  // Sections repliées : mémorisées dans le navigateur de chaque utilisateur
  const CLE_SECTIONS = "hub-dyneff-sections";
  function lireEtat() { try { return JSON.parse(localStorage.getItem(CLE_SECTIONS)) || {}; } catch (e) { return {}; } }
  function ecrireEtat(v) { try { localStorage.setItem(CLE_SECTIONS, JSON.stringify(v)); } catch (e) {} }
  const etat = lireEtat();   // { idSection: true (repliée) / false (dépliée) }

  const ICONE_DOC = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>';

  const conteneur = document.getElementById("sections");
  const sommaire  = document.getElementById("sommaire");

  function creerCarte(sec, app) {
    const li = document.createElement("li");
    li.className = "app";
    li.dataset.recherche = (app.name + " " + (app.desc || "") + " " + sec.title).toLowerCase();

    const lienOk = app.url && app.url.trim() !== "";
    const bureauOk = app.desktop && app.desktop.trim() !== "";

    // Avec version bureau : la carte n'est pas cliquable, deux boutons en dessous.
    // Sans version bureau : toute la carte ouvre la version en ligne.
    const a = document.createElement(bureauOk ? "div" : "a");
    a.className = "ouvrir";
    if (bureauOk) {
      // rien : les liens sont dans les boutons
    } else if (lienOk) {
      a.href = app.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("aria-label", app.name + " (s'ouvre dans un nouvel onglet)");
    } else {
      a.href = "#";
      a.setAttribute("aria-disabled", "true");
      a.addEventListener("click", function (e) { e.preventDefault(); });
    }

    const icone = document.createElement("span");
    icone.className = "icone";
    if (app.logo) {
      const img = document.createElement("img");
      img.src = app.logo; img.alt = "";
      // Si le logo ne se charge pas, on affiche l'initiale à la place
      img.onerror = function () { icone.innerHTML = ""; icone.appendChild(initiale(app.name)); };
      icone.appendChild(img);
    } else {
      icone.appendChild(initiale(app.name));
    }

    const texte = document.createElement("span");
    texte.className = "texte";
    texte.innerHTML = '<span class="nom"></span><span class="desc"></span>';
    texte.querySelector(".nom").textContent = app.name;
    texte.querySelector(".desc").textContent = app.desc || "";
    if (!lienOk) {
      const b = document.createElement("span");
      b.className = "a-completer"; b.textContent = "Lien à compléter";
      texte.appendChild(b);
    }

    a.append(icone, texte);
    li.appendChild(a);

    if (bureauOk) {
      const liens = document.createElement("div");
      liens.className = "liens";

      const web = document.createElement("a");
      web.className = "web";
      web.innerHTML = ICONE_WEB + "<span>En ligne</span>";
      if (lienOk) {
        web.href = app.url; web.target = "_blank"; web.rel = "noopener";
        web.setAttribute("aria-label", app.name + " en ligne (s'ouvre dans un nouvel onglet)");
      } else {
        web.href = "#"; web.setAttribute("aria-disabled", "true");
        web.addEventListener("click", function (e) { e.preventDefault(); });
      }

      const bureau = document.createElement("a");
      bureau.className = "bureau";
      bureau.innerHTML = ICONE_BUREAU + "<span>Bureau</span>";
      if (app.desktop.indexOf("COLLER_ICI") !== -1) {
        // Lien pas encore renseigné : bouton grisé
        bureau.classList.add("a-configurer");
        bureau.innerHTML = ICONE_BUREAU + "<span>Bureau</span><small>à configurer</small>";
        bureau.href = "#";
        bureau.setAttribute("aria-disabled", "true");
        bureau.setAttribute("aria-label", "Version bureau de " + app.name + " : lien à configurer");
        bureau.title = "Lien vers le logiciel à configurer dans le code du hub";
        bureau.addEventListener("click", function (e) { e.preventDefault(); });
      } else {
        bureau.href = app.desktop;   // même onglet : le navigateur passe la main au logiciel
        bureau.setAttribute("aria-label", "Ouvrir l'application " + app.name + " installée sur ce poste");
        bureau.title = "Ouvre le logiciel installé sur votre PC";
      }

      liens.append(web, bureau);
      li.appendChild(liens);
    }

    // Bouton « Documentation »
    const lienDoc = (app.doc && app.doc.trim()) || (DOC_GENERALE && DOC_GENERALE.trim()) || "";
    const doc = document.createElement(lienDoc ? "a" : "span");
    doc.className = "doc";
    if (lienDoc) {
      doc.href = lienDoc; doc.target = "_blank"; doc.rel = "noopener";
      doc.innerHTML = ICONE_DOC + '<span>Documentation</span><span class="fleche" aria-hidden="true">→</span>';
      doc.setAttribute("aria-label", "Documentation de " + app.name + " (s'ouvre dans un nouvel onglet)");
    } else {
      doc.classList.add("a-venir");
      doc.innerHTML = ICONE_DOC + '<span>Documentation à venir</span>';
    }
    li.appendChild(doc);


    return li;
  }

  // « DynProjet » → DP, « Power BI » → PB, « Teams » → T
  function lettres(nom) {
    nom = (nom || "?").trim();
    const mots = nom.split(/\s+/);
    if (mots.length > 1) return (mots[0].charAt(0) + mots[1].charAt(0)).toUpperCase();
    const maj = nom.slice(1).match(/[A-ZÀ-Ý]/);
    return (nom.charAt(0) + (maj ? maj[0] : "")).toUpperCase();
  }

  function initiale(nom) {
    const s = document.createElement("span");
    s.className = "initiale";
    s.textContent = lettres(nom);
    s.setAttribute("aria-hidden", "true");
    return s;
  }

  // Construction des sections
  HUB.forEach(function (sec) {
    const section = document.createElement("section");
    section.className = "groupe";
    section.id = sec.id;
    section.style.setProperty("--accent", sec.accent || "#EF3125");
    section.setAttribute("aria-labelledby", "t-" + sec.id);

    const tete = document.createElement("h2");
    tete.className = "groupe-titre";
    tete.id = "t-" + sec.id;
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "bascule";
    bouton.setAttribute("aria-controls", "g-" + sec.id);
    bouton.innerHTML = '<span class="titre"></span><span class="nb"></span><span class="sous"></span>' + ICONE_CHEVRON;
    bouton.querySelector(".titre").textContent = sec.title;
    bouton.querySelector(".sous").textContent = sec.subtitle || "";
    bouton.querySelector(".nb").textContent = sec.apps.length;
    bouton.querySelector(".nb").setAttribute("aria-label", sec.apps.length + " applications");
    tete.appendChild(bouton);

    const ul = document.createElement("ul");
    ul.className = "grille";
    ul.id = "g-" + sec.id;
    sec.apps.forEach(function (app) { ul.appendChild(creerCarte(sec, app)); });

    section.append(tete, ul);
    conteneur.appendChild(section);

    // État initial : choix de l'utilisateur, sinon réglage « ferme » de la section
    const ferme = (sec.id in etat) ? etat[sec.id] : !!sec.ferme;
    appliquer(section, ferme);
    bouton.addEventListener("click", function () {
      const f = !section.classList.contains("ferme");
      appliquer(section, f);
      etat[sec.id] = f; ecrireEtat(etat);
    });

    const lien = document.createElement("a");
    lien.href = "#/hub/" + sec.id;
    lien.textContent = sec.title;
    // Cliquer sur un raccourci déplie la section si elle était repliée, puis y descend
    lien.addEventListener("click", function (e) {
      e.preventDefault();
      if (section.classList.contains("ferme")) { appliquer(section, false); etat[sec.id] = false; ecrireEtat(etat); }
      section.scrollIntoView({ behavior: "smooth" });
      try { history.replaceState(null, "", "#/hub/" + sec.id); } catch (err) { /* ignoré */ }
    });
    sommaire.appendChild(lien);
  });

  function appliquer(section, ferme) {
    section.classList.toggle("ferme", ferme);
    section.querySelector(".bascule").setAttribute("aria-expanded", ferme ? "false" : "true");
  }

  // Boutons « Tout déplier » / « Tout replier »
  const tout = document.createElement("span");
  tout.className = "tout";
  tout.innerHTML = '<button type="button" data-f="0">Tout déplier</button><button type="button" data-f="1">Tout replier</button>';
  tout.querySelectorAll("button").forEach(function (b) {
    b.addEventListener("click", function () {
      const f = b.dataset.f === "1";
      document.querySelectorAll("section.groupe").forEach(function (sec) { appliquer(sec, f); etat[sec.id] = f; });
      ecrireEtat(etat);
    });
  });
  sommaire.appendChild(tout);

  // Recherche instantanée
  const filtre = document.getElementById("filtre");
  filtre.addEventListener("input", function () {
    const q = filtre.value.trim().toLowerCase();
    document.getElementById("page-hub").classList.toggle("recherche-active", q !== "");
    let total = 0;
    document.querySelectorAll("section.groupe").forEach(function (sec) {
      let visibles = 0;
      sec.querySelectorAll(".app").forEach(function (c) {
        const ok = !q || c.dataset.recherche.includes(q);
        c.hidden = !ok;
        if (ok) visibles++;
      });
      sec.hidden = visibles === 0;
      total += visibles;
    });
    document.getElementById("vide").hidden = total > 0;
  });
  // Accès depuis la navigation (#/hub/<section>)
  window.HUB_APPS = {
    allerA: function (id) {
      const section = document.getElementById(id);
      if (!section || !section.classList.contains("groupe")) return;
      if (section.classList.contains("ferme")) { appliquer(section, false); etat[id] = false; ecrireEtat(etat); }
      section.scrollIntoView();
    }
  };

  // Raccourci clavier : touche « / » pour rechercher
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.body.classList.contains("vue-hub") && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      e.preventDefault(); filtre.focus();
    }
  });
})();
