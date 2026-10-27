# Hub Dyneff — guide d'installation (DSI)

> Pour un simple essai sur une VM de test Windows, il suffit de suivre le [README](../README.md) : double-clic sur `demarrer.bat`. Ce guide concerne l'installation en production.

Le hub est une petite application **Node.js** hébergée sur un serveur interne. Il réunit trois onglets : **Intranet**, **Tips, IA & outils collaboratifs** (bibliothèque de guides PDF et vidéos) et **Hub applicatif**.

- **Connexion** : chaque personne se connecte avec son compte Microsoft Dyneff (Entra ID), en SSO.
- **Modification** : chaque partie du hub (un site de l'intranet, un dossier de guides, une section d'applications…) peut être confiée à des personnes précises.
- **Contrôle des droits** : il est fait **par le serveur**, à chaque modification.

```
Navigateur ──HTTPS──> Proxy (IIS / nginx) ──> Node.js (port 3000) ──> data/ documents/ images/
                                      └──> login.microsoftonline.com (connexion)
                                      └──> graph.microsoft.com (recherche de personnes, admins)
```

---

## 1. Prérequis

| Élément | Détail |
|---|---|
| Serveur | Windows Server ou Linux, interne |
| Node.js | Version 20, 22 ou 24 LTS (`node --version`) |
| Nom DNS | Par exemple `hub.dyneff.fr` |
| Certificat HTTPS | Certificat interne ou public, porté par le proxy |
| Accès sortant | `login.microsoftonline.com` et `graph.microsoft.com` (HTTPS 443) |
| Disque | Selon les vidéos déposées (prévoir plusieurs Go) |

## 2. Enregistrer l'application dans Entra ID (≈ 15 min)

Portail **entra.microsoft.com**, rôle *Administrateur d'applications* ou supérieur.

1. **Identité → Applications → Inscriptions d'applications → Nouvelle inscription**
   - Nom : `Hub Dyneff`
   - Types de comptes : **Comptes dans cet annuaire d'organisation uniquement**
   - URI de redirection : plateforme **Web**, `https://hub.dyneff.fr/auth/retour`
2. Sur la page **Vue d'ensemble**, notez :
   - l'**ID d'application (client)** → `ENTRA_CLIENT_ID` ;
   - l'**ID de l'annuaire (locataire)** → `ENTRA_TENANT_ID`.
3. **Certificats et secrets → Nouveau secret client** : durée de 24 mois, puis copiez la **Valeur** → `ENTRA_CLIENT_SECRET`.
   ⚠️ Notez la date d'expiration dans votre agenda. À l'échéance, la connexion cessera de fonctionner.
4. **Autorisations d'API → Ajouter une autorisation → Microsoft Graph** :
   - *Délégué* : `openid`, `profile`, `email` (avec `User.Read`, déjà présent) ;
   - *Application* : `User.Read.All`. Elle sert uniquement à la recherche de personnes dans l'écran « Gérer les droits ».
   - Puis **Accorder un consentement d'administrateur pour Dyneff**.
5. *(Facultatif)* Pour réserver le hub à certaines personnes :
   - allez dans **Applications d'entreprise → Hub Dyneff → Propriétés** et réglez **Affectation requise : Oui** ;
   - affectez ensuite les groupes concernés dans **Utilisateurs et groupes**.

> Sans l'autorisation `User.Read.All`, tout fonctionne quand même. Les administrateurs ajoutent alors les modificateurs en tapant leur adresse e-mail complète.

## 3. Installer

```bash
# 1. Récupérer le dépôt sur le serveur, puis dans ce dossier :
git clone https://github.com/rella-beyeme/DynHub.git && cd DynHub
npm ci --omit=dev

# 2. Créer la configuration
cp config/production.env.modele .env      # Windows : copy config\production.env.modele .env

# 3. Générer la clé de session et la coller dans SECRET_SESSION
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Renseignez le fichier `.env` (tout est commenté dedans) :

| Variable | Valeur |
|---|---|
| `URL_PUBLIQUE` | `https://hub.dyneff.fr` (identique à l'URI de redirection, sans `/auth/retour`) |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` | Valeurs de l'étape 2 |
| `ADMINS` | E-mails des administrateurs permanents, par exemple `cellulemp@dyneff.fr` |
| `TAILLE_MAX_MO` | Taille maximale d'un fichier déposé (500 par défaut) |
| `DERRIERE_PROXY` | `oui` si un proxy porte le HTTPS (cas recommandé) |

Lancez le serveur avec `npm start`, puis vérifiez `http://localhost:3000/sante` : la réponse doit être `{"ok":true}`. Au premier démarrage, le contenu actuel du hub est créé dans `data/hub.json`.

**Documents existants** : copiez les PDF, vidéos et fichiers de démo dans `documents/`, en respectant les sous-dossiers `Fichier Demo/` et `Guides video/`. Les noms de fichiers doivent rester identiques.

## 4. HTTPS (proxy inverse)

Node écoute en HTTP local. Le proxy porte le certificat et transmet les requêtes.

**IIS** (modules *URL Rewrite* et *Application Request Routing*) :
- Créez une règle de proxy inverse vers `http://localhost:3000`.
- Activez *Preserve host header*.
- Pour les vidéos, augmentez la limite d'envoi dans `web.config` : `<requestLimits maxAllowedContentLength="524288000" />` (500 Mo).

**nginx** :

```nginx
server {
  listen 443 ssl;
  server_name hub.dyneff.fr;
  ssl_certificate     /etc/ssl/hub.crt;
  ssl_certificate_key /etc/ssl/hub.key;
  client_max_body_size 500m;            # = TAILLE_MAX_MO
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

## 5. Faire tourner le hub en service

**Windows**, avec [NSSM](https://nssm.cc) :

```bat
nssm install HubDyneff "C:\Program Files\nodejs\node.exe" serveur.js
nssm set HubDyneff AppDirectory D:\DynHub
nssm set HubDyneff AppStdout D:\DynHub\data\service.log
nssm set HubDyneff AppStderr D:\DynHub\data\service.log
nssm start HubDyneff
```

**Linux**, avec systemd (`/etc/systemd/system/hub-dyneff.service`) :

```ini
[Unit]
Description=Hub Dyneff
After=network.target
[Service]
WorkingDirectory=/opt/DynHub
ExecStart=/usr/bin/node serveur.js
Restart=always
User=hub
[Install]
WantedBy=multi-user.target
```

Activez-le avec `systemctl enable --now hub-dyneff`.

## 6. Sauvegardes et restauration

Sauvegardez chaque jour ces trois dossiers :

| Dossier | Contenu |
|---|---|
| `data/` | `hub.json` (contenus), `droits.json` (droits), `historique/` (300 dernières versions), `journal.log` (qui a fait quoi), `corbeille/` (fichiers retirés) |
| `documents/` | Guides PDF, vidéos, fichiers de démo |
| `images/` | Photo d'accueil, logos envoyés |

**Restaurer une version** :
1. Arrêtez le service.
2. Copiez le fichier voulu de `data/historique/` à la place de `data/hub.json`, ou de `data/droits.json` pour les droits.
3. Redémarrez le service.

Les fichiers retirés depuis la page ne sont jamais effacés. Ils sont déplacés dans `data/corbeille/`. Videz ce dossier de temps en temps.

## 7. Comment fonctionnent les droits

- **Les administrateurs** (liste `ADMINS` du `.env`, plus ceux nommés dans la page) peuvent tout modifier. Ce sont aussi eux qui nomment les modificateurs, depuis le menu à leur nom : **Gérer les droits de modification**.
- **Un modificateur peut être nommé sur** :
  - un onglet entier (Intranet, Tips, Hub) ;
  - ou une seule partie : un site de l'intranet (Dyneff, CSE…), les liens, les annonces, l'accueil, un dossier de guides, une section d'applications, les réglages d'un onglet.
- **Héritage** : une personne nommée sur un onglet peut modifier toutes ses parties. Une personne nommée sur un dossier de guides peut aussi modifier ses sous-dossiers.
- **Ce qu'on voit à l'écran** : une personne ne voit les boutons « Modifier » que pour ses parties, après avoir cliqué sur « Modifier » en haut de la page. Le serveur revérifie chaque modification. Une tentative non autorisée est refusée (erreur 403) et n'est jamais enregistrée.

## 8. Sécurité, en bref

- **Connexion** : flux OpenID Connect avec code d'autorisation et PKCE. Seuls les comptes du tenant Dyneff sont acceptés.
- **Session** : cookie signé (`HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS) qui ne contient que le nom, l'e-mail et l'identifiant Entra. Aucun jeton n'est stocké.
- **Requêtes de modification** : elles exigent un en-tête dédié et la même origine (protection CSRF).
- **Contrôle des contenus** : adresses limitées à `http(s)`, liens « Bureau » limités à `ms-*`, `msteams`, `onenote` et `mailto` (plus `SCHEMAS_BUREAU`), longueurs bornées.
- **Fichiers déposés** : formats limités (PDF, vidéos, images, Office, CSV, TXT, ZIP ; ni HTML ni SVG), noms nettoyés, aucune sortie possible du dossier `documents/`.
- **En-têtes HTTP** : CSP, `X-Content-Type-Options`, `X-Frame-Options` et HSTS en HTTPS.
- **Changement de la clé de session** : modifier `SECRET_SESSION` déconnecte tout le monde.

## 9. Mode démonstration (tests sans Entra)

Le mode démonstration sert à essayer le hub et ses droits avant l'enregistrement dans Entra ID. Mettez dans le `.env` :

```
NODE_ENV=development
MODE_CONNEXION=demo
COMPTES_DEMO="admin@dyneff.fr:Admin Hub,cse@dyneff.fr:Claire CSE,lecteur@dyneff.fr:Léa Lectrice"
ADMINS=admin@dyneff.fr
```

La page de connexion propose alors de choisir un de ces comptes. Ce mode est **refusé au démarrage si `NODE_ENV=production`**.

---

## Pour les modificateurs (à transmettre)

1. **Passer en modification** : connectez-vous, puis cliquez sur **Modifier** en haut à droite. Des boutons jaunes apparaissent sur les parties que vous pouvez modifier.
2. **Modifier une partie** : cliquez sur un bouton jaune, faites vos changements, puis cliquez sur **Enregistrer**. La page se recharge avec la nouvelle version.
3. **Gérer les documents (onglet Tips)** :
   - **Ajouter un document** envoie un fichier dans le dossier ouvert.
   - **Nouveau dossier** crée un sous-dossier.
   - **Modifier ce dossier** permet de changer les étiquettes, réordonner ou retirer des fichiers.
4. **Si un message signale qu'une autre personne a modifié la même partie**, rechargez la page et refaites votre changement.
5. **Pour revenir en lecture**, cliquez sur **Terminer**.
