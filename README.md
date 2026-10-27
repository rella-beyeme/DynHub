# DynHub — Intranet & Hub Dyneff

Page d'accueil interne de Dyneff, en trois parties :

| Partie | Contenu |
|---|---|
| **Intranet** (nouveau visuel) | Accueil (alerte, À la une, accès rapides, mot de la direction, actualités, agenda, sécurité, bienvenue, espaces services, offres, campagne, CSE, sondage, Dyneff en bref, sites), pages Actualités, Agenda, Annuaire, Sites, et **12 espaces services** (RH, Marketing & Communication, QHSE, DSI, CSE…) |
| **Hub applicatif** | Microsoft 365 (boutons En ligne / Bureau), assistants IA (DynIA, Copilot, ChatGPT, Claude), applications internes, Méthode & Process |
| **Tips, IA & outils collaboratifs** | Bibliothèque de guides : PDF, vidéos, fichiers de démo, avec aperçu dans la page |

- **Connexion** : SSO interne **Active Directory** — la session Windows suffit, sans mot de passe à saisir.
- **Modification** : chaque module de l'intranet a son bouton « Modifier ». Chaque partie peut être confiée à des **comptes** ou à des **groupes AD** (par exemple `GG_Intranet_RH` sur l'espace RH). Le serveur contrôle chaque modification.

---

## Lancer le hub sur la VM de test (Windows)

**Prérequis**
- **VM membre du domaine** `DYNFR`, et session ouverte avec un compte du domaine.
- **Node.js 20 ou plus récent** (LTS), depuis <https://nodejs.org>.
- **Un accès à internet** au premier lancement et après chaque mise à jour, pour télécharger les dépendances.

**Première installation**

```bat
cd C:\Users\rella-beyeme\Documents
git clone https://github.com/rella-beyeme/DynHub.git
```

Double-cliquez ensuite sur **`demarrer.bat`**. Le script :
1. installe les dépendances (`npm ci`), et les réinstalle automatiquement quand une mise à jour les change ;
2. crée le fichier `.env` (connexion Windows, clé de session aléatoire). Un ancien `.env` est sauvegardé en `.env.v1`, et ses réglages sont repris ;
3. démarre le serveur et ouvre <http://localhost:3000>.

Vous êtes reconnu automatiquement. **Pour arrêter le hub**, fermez la fenêtre noire.

**Mise à jour** : `git pull`, puis `demarrer.bat`. Les contenus déjà saisis sont conservés. Ceux de la version précédente sont repris dans le nouvel intranet (sites, liens, annonces → actualités), et une copie est archivée dans `data\historique\`.

### Qui est administrateur ?

Le `.env` contient `ADMINS="DYNFR\rella-beyeme, cellulemp@dyneff.fr"`. Pour vérifier votre identifiant Windows, tapez `whoami` dans une invite de commandes. S'il est différent, corrigez `ADMINS`, puis relancez.

On peut aussi désigner un groupe AD : `ADMINS="groupe:GG_Hub_Admins"`.

### Donner des droits

1. Cliquez sur votre nom, puis **Gérer les droits de modification**.
2. Choisissez une partie : tout l'intranet, un module de l'accueil, un espace service entier ou un seul de ses modules, un dossier Tips, une section du hub…
3. Ajoutez un **compte** (`DYNFR\login`), un **groupe AD** ou un e-mail. La recherche dans l'annuaire est disponible quand un compte de service LDAP est configuré. Sinon, tapez le nom exact.

Les **groupes AD** sont recommandés : la DSI gère les membres dans l'AD, sans toucher au hub. Les groupes imbriqués sont pris en compte. Un changement de groupe est visible à la prochaine connexion, ou au plus tard après `GROUPES_DUREE_HEURES` (4 h par défaut).

Ensuite, la personne clique sur **Modifier** en haut de la page. Elle ne voit que les boutons des parties qui lui sont confiées.

### Si le SSO ne fonctionne pas

| Symptôme | Solution |
|---|---|
| Le navigateur demande un identifiant / mot de passe | Ajoutez l'adresse du hub à la zone **Intranet local** (Options Internet → Sécurité → Intranet local → Sites). `localhost` et les noms courts (`http://DYNMPL063:3000`) y sont en principe déjà |
| Page « Connexion Windows impossible » | La VM n'est pas dans le domaine, ou la session est un compte local. Vérifiez avec `whoami` |
| « Accès refusé : compte … » | Le domaine n'est pas dans `DOMAINES_AUTORISES` |
| Le serveur refuse de démarrer (module `node-expose-sspi`) | Relancez `installer.bat`. Sinon, passez temporairement en `MODE_CONNEXION=ldap` (formulaire Windows) ou `demo` |

### Modes de connexion (`MODE_CONNEXION` dans `.env`)

| Mode | Usage |
|---|---|
| `windows` *(défaut)* | SSO Active Directory (Negotiate / NTLM / Kerberos). Le serveur doit être un Windows membre du domaine |
| `ldap` | Formulaire identifiant / mot de passe Windows, vérifié sur le contrôleur de domaine. Renseignez `LDAP_URL` (ex. `ldaps://dc01.dynfr.local:636`) |
| `demo` | Comptes de test sans AD, pour essayer les droits. Voir ci-dessous |

### Comptes de test (`MODE_CONNEXION=demo`)

| Compte | Groupe AD simulé | Pour essayer |
|---|---|---|
| `DYNFR\rella-beyeme` | — | Administrateur |
| `DYNFR\rh.test` | `GG_Intranet_RH` | Donnez le droit « Espace Ressources humaines » au groupe `GG_Intranet_RH` |
| `DYNFR\cse.test` | `GG_Intranet_CSE` | Espace CSE |
| `DYNFR\tips.test` | `GG_Tips_IA` | Partie Tips |
| `DYNFR\lecteur.test` | — | Lecture seule |

### Réglages utiles (`.env`)

| Besoin | Réglage |
|---|---|
| Ouvrir le hub depuis un autre poste | `URL_PUBLIQUE=http://DYNMPL063:3000`, puis ouvrez le port 3000 dans le pare-feu de la VM |
| Changer de port | `PORT=8080` **et** `URL_PUBLIQUE=http://localhost:8080` |
| Recherche de personnes et de groupes dans l'écran des droits | `LDAP_URL`, `LDAP_COMPTE_SERVICE`, `LDAP_MOT_DE_PASSE_SERVICE` (compte en lecture seule) |

Relancez `demarrer.bat` après chaque modification du `.env`.

### Remettre la VM à zéro

1. Arrêtez le serveur.
2. Supprimez le dossier `data\`.
3. Relancez `demarrer.bat` : le contenu de départ est recréé à partir de `scripts/donnees-initiales.json`.

---

## Organisation du dépôt

```
demarrer.bat / installer.bat   Lancement en double-clic (Windows)
serveur.js                     Serveur web (Express) et API
lib/annuaire.js                Active Directory : SSO Windows (SSPI), LDAP, groupes
lib/auth.js                    Pages de connexion, session
lib/droits.js                  Catalogue des droits (par module), héritage
lib/schemas.js                 Description des modules (formulaires + validation)
lib/intranet-donnees.js        Contenu de départ de l'intranet, reprise de la v1
lib/contenus.js, stockage.js   Validation et enregistrement (historique, journal)
public/hub-applicatif.html     Page unique (intranet, hub, tips)
public/ressources/             intranet.js, hub.js, tips.js, edition.js, styles, polices
scripts/                       Contenu de départ, création du .env
config/                        Modèles de .env (VM de test, production)
docs/INSTALLATION-DSI.md       Installation en production : SSO AD, service, sauvegardes
data/                          (créé au démarrage, hors git) contenus, droits, historique
```
