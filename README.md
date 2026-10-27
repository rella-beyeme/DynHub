# DynHub — Hub Dyneff

Page d'accueil interne de Dyneff, en trois onglets :

| Onglet | Contenu |
|---|---|
| **Intranet** | Accès aux sites SharePoint internes, photo d'accueil, liens, annonces, annuaire |
| **Tips, IA & outils collaboratifs** | Bibliothèque de guides : PDF, vidéos, fichiers de démo, avec aperçu dans la page |
| **Hub applicatif** | Applications Microsoft 365, assistants IA, applications internes et Méthode & Process |

- **Connexion** : avec les comptes Microsoft (Entra ID), ou des comptes de test en mode démonstration.
- **Modification** : chaque partie peut être confiée à des personnes précises (un site de l'intranet, un dossier de guides, une section d'applications…). Le contrôle est fait par le serveur.

---

## Lancer le hub sur la VM de test (Windows)

**Prérequis**
- **Node.js 20 ou plus récent** (version LTS conseillée), à télécharger sur <https://nodejs.org>.
- **Un accès à internet** au premier lancement, pour télécharger les dépendances.

**Récupérer le dépôt**

```bat
git clone https://github.com/rella-beyeme/DynHub.git
cd DynHub
```

**Lancer le hub**
- **Double-cliquez sur `demarrer.bat`.** Au premier lancement, le script :
  - installe les dépendances (`npm ci`) ;
  - crée le fichier de configuration `.env`, en mode démonstration, avec une clé de session aléatoire ;
  - démarre le serveur et ouvre le navigateur sur <http://localhost:3000>.
- **Pour arrêter le hub**, fermez la fenêtre noire du serveur.

### Comptes de test (mode démonstration)

La page de connexion propose de choisir un compte, sans mot de passe :

| Compte | Droits au départ |
|---|---|
| Cellule MP (administrateur) — `cellulemp@dyneff.fr` | Tout modifier, gérer les droits |
| Responsable CSE (test) | Aucun : à nommer, par exemple sur le site « CSE » |
| Responsable Tips (test) | Aucun : à nommer, par exemple sur l'onglet Tips |
| Lecteur simple (test) | Lecture seule |

**Pour essayer les droits**
1. Connectez-vous en administrateur.
2. Ouvrez le menu à votre nom, puis **Gérer les droits de modification**, et nommez un compte de test sur une partie.
3. Déconnectez-vous, puis reconnectez-vous avec ce compte.
4. Cliquez sur **Modifier** en haut à droite : seuls les boutons de ses parties apparaissent.

### Réglages utiles (fichier `.env`)

| Besoin | Réglage |
|---|---|
| Ouvrir le hub depuis un autre poste que la VM | `URL_PUBLIQUE=http://NOM-DE-LA-VM:3000`, puis autoriser le port 3000 dans le pare-feu Windows de la VM |
| Changer de port | `PORT=8080` **et** `URL_PUBLIQUE=http://localhost:8080` |
| Passer aux vrais comptes Microsoft | `MODE_CONNEXION=entra` et les trois valeurs `ENTRA_*` (voir [docs/INSTALLATION-DSI.md](docs/INSTALLATION-DSI.md), étape 2) |

Redémarrez `demarrer.bat` après chaque modification du `.env`.

> **Microsoft refuse le HTTP**, sauf pour `localhost`. Avec `MODE_CONNEXION=entra`, la VM doit donc être ouverte en `http://localhost:3000`, depuis la VM elle-même. Sinon, il faut la placer derrière un HTTPS : voir le guide DSI.

### Remettre la VM à zéro

1. Arrêtez le serveur.
2. Supprimez le dossier `data\` (contenus, droits, historique) et les fichiers déposés dans `documents\`.
3. Relancez `demarrer.bat` : le contenu de départ est recréé à partir de `scripts/donnees-initiales.json`.

---

## Organisation du dépôt

```
demarrer.bat / installer.bat   Lancement en double-clic (Windows)
serveur.js                     Serveur web (Express)
lib/                           Connexion Microsoft, droits, validation, stockage
public/                        Page du hub et mode édition
scripts/                       Contenu de départ, création de la configuration
config/vm-test.env.modele      Modèle de configuration de la VM de test
config/production.env.modele   Modèle de configuration de production (commenté)
documents/                     Guides déposés (seuls les exemples sont suivis par git)
images/                        Photo d'accueil, images envoyées depuis la page
modeles-office/                Modèles vierges Word / Excel / PowerPoint (boutons « Bureau »)
docs/INSTALLATION-DSI.md       Installation en production : Entra ID, HTTPS, service, sauvegardes
data/                          (créé au démarrage, hors git) contenus, droits, historique, journal
```

Sous Linux ou macOS : `npm ci --omit=dev && node scripts/preparer-config.js && npm start`.
