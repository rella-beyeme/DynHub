# Hub Dyneff — guide d'installation (DSI)

> Pour un essai sur la VM de test, suivez le [README](../README.md) : double-clic sur `demarrer.bat`. Ce guide concerne l'installation en production.

Le hub est une petite application **Node.js** hébergée sur un serveur Windows interne. Il réunit :
- l'**Intranet** : accueil modulaire, actualités, agenda, annuaire, 12 espaces services ;
- le **Hub applicatif** ;
- **Tips, IA & outils collaboratifs**, une bibliothèque de guides PDF et vidéos.

**Connexion et droits**
- **Connexion** : SSO **Active Directory** (Negotiate : Kerberos, sinon NTLM). Le poste transmet la session Windows, sans saisie.
- **Droits** : chaque module, espace service, dossier Tips ou section du hub peut être confié à des comptes ou à des **groupes AD**. Les groupes imbriqués sont pris en compte.
- **Contrôle** : le serveur vérifie les droits à chaque modification.

```
Poste (session DYNFR) ──Negotiate──> Node.js sur Windows (membre du domaine) ──> data/ documents/ images/
                                           │  SSPI : jeton Windows + groupes de sécurité
                                           └──LDAP(S) facultatif──> contrôleur de domaine
                                              (recherche dans l'écran des droits, mode formulaire)
```

---

## 1. Prérequis

| Élément | Détail |
|---|---|
| Serveur | **Windows Server membre du domaine DYNFR** (exigé par le SSO, qui s'appuie sur SSPI) |
| Node.js | Version 20, 22 ou 24 LTS, en **x64** (`node --version`) |
| Nom DNS | Nom court ou FQDN interne, par exemple `hub` / `hub.dynfr.local` |
| Navigateurs | Adresse du hub dans la zone **Intranet local** (GPO, voir § 4) |
| LDAP (facultatif) | Compte de service en lecture seule, LDAPS 636 vers un contrôleur de domaine |
| Disque | Selon les vidéos déposées (prévoir plusieurs Go) |

> **Pas de serveur Windows dans le domaine ?** Utilisez `MODE_CONNEXION=ldap`. Les utilisateurs saisissent alors leur identifiant et leur mot de passe Windows, vérifiés sur l'AD en LDAPS. Ce n'est plus du SSO silencieux, mais les droits par groupes fonctionnent de la même façon.

## 2. Installer

```bat
git clone https://github.com/rella-beyeme/DynHub.git D:\DynHub
cd /d D:\DynHub
npm ci --omit=dev
copy config\production.env.modele .env
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Collez la valeur générée dans `SECRET_SESSION`, puis complétez le `.env` (tout y est commenté) :

| Variable | Valeur |
|---|---|
| `URL_PUBLIQUE` | `http://hub.dynfr.local` ou `https://…`, telle que tapée dans le navigateur |
| `MODE_CONNEXION` | `windows` |
| `DOMAINES_AUTORISES` | `DYNFR` (refuse les comptes locaux et les autres domaines) |
| `FORCER_NTLM` | `non` en production (Kerberos, voir § 3), `oui` pour un test rapide |
| `ADMINS` | `groupe:GG_Hub_Admins` et/ou des comptes `DYNFR\login` |
| `LDAP_*` | Facultatif : recherche de personnes et de groupes dans l'écran des droits |

Lancez `npm start`, puis vérifiez `http://localhost:3000/sante` : la réponse doit être `{"ok":true}`.

**Mise à jour depuis la version précédente (connexion Microsoft)** : au premier démarrage, l'intranet et les droits sont convertis automatiquement, et l'ancienne version est archivée dans `data/historique/`.
- `MODE_CONNEXION=entra` n'existe plus. Le serveur refuse de démarrer tant que ce n'est pas corrigé.
- Les droits nommés par e-mail continuent de fonctionner, si l'attribut `mail` est renseigné dans l'AD.

## 3. Kerberos ou NTLM

Le hub accepte **Negotiate** : le navigateur essaie Kerberos, puis NTLM.

| | Kerberos (recommandé) | NTLM (`FORCER_NTLM=oui`) |
|---|---|---|
| Configuration | Un SPN `HTTP/<nom>` sur le compte qui exécute Node | Aucune |
| Proxy inverse | Possible | **Non** : NTLM est lié à la connexion TCP et ne traverse pas un proxy |
| Sécurité | Meilleure | Acceptable sur un réseau interne |

**SPN** :
- **Le service tourne en `LocalSystem` / `NetworkService`** et les utilisateurs tapent le **nom de la machine** : le SPN `HOST/` du compte ordinateur suffit, il n'y a rien à faire.
- **Les utilisateurs passent par un alias DNS** (`hub.dynfr.local`) : déclarez le SPN sur le compte ordinateur :
  ```
  setspn -S HTTP/hub.dynfr.local DYNFR\SRV-HUB$
  setspn -S HTTP/hub DYNFR\SRV-HUB$
  ```
  Utilisez un enregistrement **A**, pas CNAME, pour éviter les surprises côté navigateur.
- **Le service tourne sous un compte de service** (gMSA conseillé) : déclarez les SPN sur ce compte.

**Vérifier** : sur un poste, ouvrez le hub, puis lancez `klist` dans une invite de commandes. Un ticket `HTTP/hub.dynfr.local` doit apparaître.

## 4. Navigateurs (GPO)

Le SSO n'est silencieux que si l'adresse du hub est dans la zone **Intranet local** :
- **GPO « Liste des attributions de sites aux zones »** : ajoutez `http://hub.dynfr.local` (ou `https://…`) avec la valeur **1** (Intranet). Edge et Chrome s'appuient sur ce réglage.
- **Si besoin, la stratégie Edge/Chrome `AuthServerAllowlist`** : `hub.dynfr.local,hub`.
- **Les noms courts** (`http://hub:3000`) sont en principe déjà considérés comme intranet.

**Firefox** :
- `network.negotiate-auth.trusted-uris = hub.dynfr.local` ;
- `network.automatic-ntlm-auth.trusted-uris = hub.dynfr.local`.

## 5. HTTPS

Node écoute en HTTP. **Deux choix** :
1. **HTTP interne direct** (le plus simple avec le SSO). Les mots de passe ne circulent pas : Kerberos et NTLM sont des échanges de jetons. Mais les contenus ne sont pas chiffrés.
2. **Proxy inverse HTTPS (IIS ARR, nginx) avec Kerberos uniquement** (`FORCER_NTLM=non`). Points à respecter :
   - le proxy doit transmettre l'en-tête `Authorization` sans le traiter : l'authentification Windows **désactivée** sur le site IIS ;
   - le SPN porte sur le nom public ;
   - mettez `DERRIERE_PROXY=oui` ;
   - pour les vidéos, augmentez la taille d'envoi (`maxAllowedContentLength="524288000"` sous IIS, `client_max_body_size 500m` sous nginx).

## 6. Faire tourner le hub en service

Avec [NSSM](https://nssm.cc) :

```bat
nssm install HubDyneff "C:\Program Files\nodejs\node.exe" serveur.js
nssm set HubDyneff AppDirectory D:\DynHub
nssm set HubDyneff AppStdout D:\DynHub\data\service.log
nssm set HubDyneff AppStderr D:\DynHub\data\service.log
nssm start HubDyneff
```

Par défaut, le service tourne en `LocalSystem` (voir § 3 pour le SPN). Pour un compte dédié : `nssm set HubDyneff ObjectName DYNFR\svc-hub <motdepasse>`. Ce compte doit pouvoir écrire dans `data\`, `documents\` et `images\`.

## 7. Comment fonctionnent les droits

**Qui**
- **Administrateurs** : liste `ADMINS` du `.env`, plus ceux nommés dans la page. Ils modifient tout et attribuent les droits (menu à leur nom → **Gérer les droits de modification**).
- **Modificateurs** : un compte `DYNFR\login`, un **groupe AD** (nom du groupe, ex. `GG_Intranet_RH`) ou une adresse e-mail.

**Sur quoi**
- **Intranet** : tout l'intranet, un module de l'accueil (À la une, actualités, agenda, sécurité, CSE, sondage…), un **espace service** entier ou un seul de ses modules (bandeau, raccourcis, FAQ, documents, contacts…).
- **Tips** : toute la partie, ou un dossier et ses sous-dossiers.
- **Hub** : tout le hub, ou une section d'applications.

**Héritage** : un droit sur un parent donne tous ses enfants. Exception utile : le responsable d'un espace service peut publier une actualité **pour son service**, sans pouvoir toucher aux autres.

**Groupes**
- En SSO, ce sont les groupes de sécurité du jeton Windows, imbrications comprises.
- En mode `ldap`, la règle `LDAP_MATCHING_RULE_IN_CHAIN` donne le même résultat.
- Les groupes sont gardés `GROUPES_DUREE_HEURES` (4 h). Ensuite, ils sont relus par le compte de service LDAP, ou une reconnexion silencieuse est demandée.

**Contrôle** : chaque enregistrement est revérifié par le serveur. Une tentative non autorisée renvoie une erreur 403 et n'est jamais enregistrée.

## 8. Sauvegardes et restauration

| Dossier | Contenu |
|---|---|
| `data/` | `hub.json` (contenus), `droits.json`, `sondage.json`, `historique/` (300 dernières versions), `journal.log` (qui a fait quoi), `corbeille/` |
| `documents/` | Guides PDF, vidéos, fichiers de démo |
| `images/` | Photos et images envoyées depuis la page |

**Restaurer une version** :
1. Arrêtez le service.
2. Copiez le fichier voulu de `data/historique/` à la place de `data/hub.json` (ou de `droits.json`).
3. Redémarrez le service.

## 9. Sécurité, en bref

**Connexion et session**
- **Connexion** : SSPI (Negotiate). Le mot de passe ne transite jamais par le hub. En mode `ldap`, il est vérifié par une liaison LDAPS puis oublié, et les tentatives sont limitées (10 échecs par 15 minutes).
- **Comptes acceptés** : seuls ceux des `DOMAINES_AUTORISES`. Les comptes désactivés sont refusés en mode `ldap`.
- **Session** : cookie signé (`HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS). Il contient seulement l'identifiant, le nom et l'e-mail. Les groupes sont gardés côté serveur.

**Requêtes et contenus**
- **Modifications** : elles exigent un en-tête dédié et la même origine (protection CSRF).
- **Contenus** :
  - formulaires générés et validés à partir d'une même description des modules (`lib/schemas.js`) ;
  - liens limités à `https`, aux pages du hub, `mailto:` et `tel:` ;
  - aucune page HTML libre.
- **Fichiers** :
  - formats limités (ni HTML ni SVG) et noms nettoyés ;
  - pas de sortie possible du dossier `documents/`.

**Divers**
- **Sondage** : anonyme. Le serveur garde seulement une empreinte (HMAC) de chaque votant.
- **En-têtes HTTP** : CSP, `X-Content-Type-Options` et `X-Frame-Options`.

## 10. Dépannage

| Symptôme | Cause probable |
|---|---|
| Fenêtre d'identification dans le navigateur | Adresse hors zone Intranet local (§ 4), ou SPN manquant / en double (`setspn -Q HTTP/hub.dynfr.local`) |
| « Connexion Windows impossible » | Poste hors domaine ou compte local. Si `LDAP_URL` est renseigné, un lien vers le formulaire de secours est proposé |
| « Accès refusé : compte … » | Domaine absent de `DOMAINES_AUTORISES` |
| Une personne d'un groupe n'a pas ses droits | Groupe de distribution (et non de sécurité), ou appartenance récente : elle doit fermer puis rouvrir sa session Windows (nouveau jeton) |
| Le serveur refuse de démarrer en mode `windows` | Serveur non Windows ou module `node-expose-sspi` absent : relancez `npm ci` |

---

## Pour les modificateurs (à transmettre)

1. **Passer en modification** : cliquez sur **Modifier** en haut à droite. Un bouton apparaît sur chaque module que vous pouvez modifier. Les emplacements vides deviennent visibles.
2. **Modifier un module** : cliquez sur son bouton, faites vos changements, puis cliquez sur **Enregistrer**.
3. **Actualités** : le responsable d'un espace service publie depuis le module « Actualités » de son espace.
4. **Tips** :
   - **Ajouter un document** envoie un fichier dans le dossier ouvert ;
   - **Nouveau dossier** crée un sous-dossier.
5. **Pour revenir en lecture**, cliquez sur **Terminer**.
