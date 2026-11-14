# Simulateur patrimonial - Paris · Louer vs acheter

Application web pour comparer, sur un horizon de temps, trois trajectoires patrimoniales autour d’un projet immobilier à Paris : rester locataire, acheter puis revendre, ou acheter et conserver le bien en **location meublée (LMNP)**.

Aucune base de données : les hypothèses et le patrimoine de départ vivent dans le navigateur (et, en local, dans un fichier JSON optionnel). Idéal pour itérer sur des scénarios sans exposer de données personnelles.

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Les trois scénarios](#les-trois-scénarios)
- [Prérequis](#prérequis)
- [Installation et lancement](#installation-et-lancement)
- [Utilisation](#utilisation)
- [Sauvegardes et confidentialité](#sauvegardes-et-confidentialité)
- [Structure du projet](#structure-du-projet)
- [Scripts npm](#scripts-npm)
- [Personnalisation locale](#personnalisation-locale)
- [Limites et avertissement](#limites-et-avertissement)

---

## Fonctionnalités

| Zone | Description |
|------|-------------|
| **Paramètres** | Hypothèses par blocs : démarrage, achat, financement multi-prêts, revenus & épargne, LMNP & fiscalité |
| **Patrimoine** | Répartition de départ (montants, taux nets, libellés), camembert, export / import JSON |
| **Tableau mensuel** | Flux mois par mois par scénario, export CSV, ligne de départ mise en évidence |
| **Graphiques** | Projection patrimoine, écart vs location, composition (épargne / bien / dettes / net) |
| **Interface** | Menu latéral repliable, thème clair / sombre, largeur responsive |

Le moteur de calcul couvre notamment :

- phase d’attente en location avant l’achat
- frais de notaire, emprunts (banque, apport, prêt complémentaire), contrainte **HCSF**
- budget mensuel (revenus, charges, investissable)
- LMNP régime réel simplifié (amortissement, fiscalité après épuisement)
- revente vs conservation du bien au « départ de Paris » paramétré.

---

## Les trois scénarios

1. **Location seule** - pas d’achat ; loyer et épargne placée selon le rendement retenu.
2. **Achat + revente** - achat, remboursement, puis vente au moment du départ ; retour sur épargne liquide.
3. **Achat + LMNP** - conservation du bien en location meublée après le départ, avec effet de levier crédit et fiscalité LMNP modélisée.

Les graphiques et le tableau permettent de comparer ces trajectoires sur la même base d’hypothèses.

---

## Prérequis

- **Node.js** 20+ (recommandé)
- **npm** 10+

Aucune clé API ni compte externe.

---

## Installation et lancement

```bash
git clone https://github.com/Mathiio/paris-louer-acheter.git
cd paris-louer-acheter
npm install
npm run dev
```

Ouvrez l’URL affichée par Vite (souvent `http://localhost:5173`).

Build de production :

```bash
npm run build
npm run preview
```

Le dossier `dist/` contient les fichiers statiques déployables.

### Déploiement sur Netlify

Le fichier [`netlify.toml`](netlify.toml) configure build et publication (`dist/`).

1. Créez le dépôt GitHub [`paris-louer-acheter`](https://github.com/Mathiio/paris-louer-acheter) et poussez `main`.
2. Sur [Netlify](https://app.netlify.com/projects/paris-louer-acheter/configuration/deploys) : section **Build & deploy** → **Continuous deployment** → lier le dépôt GitHub (branche `main`). Netlify lit `netlify.toml` (`npm run build` → `dist/`).
3. Chaque **push sur `main`** déclenche un build Netlify (plus besoin de `netlify deploy` en local).

Aucune variable d’environnement n’est requise pour ce projet statique.

**Démo en ligne :** [paris-louer-acheter.netlify.app](https://paris-louer-acheter.netlify.app) (avec les hypothèses de démonstration du dépôt, pas vos données locales).

---

## Utilisation

### Navigation

- **Paramètres** — saisie des hypothèses (grille de cartes, sans menu déroulant de sections).
- **Patrimoine** — graphique à gauche, tableau des lignes à droite ; boutons Ajouter, Export, Import, Réinit.
- **Tableau mensuel** — choix du scénario, défilement jusqu’en bas de page, export CSV.
- **Graphiques** — trois vues dédiées ; la composition affiche un sélecteur Achat+revente / LMNP.

### Financement

Plusieurs lignes de prêt sont possibles (apport personnel, prêt bancaire, prêt complémentaire, PTZ, etc.) avec modes de montant, remboursement différé ou amortissement, et indicateurs de faisabilité dans l’éditeur.

### Persistance pendant la session

Toute modification est **auto-enregistrée** dans le `localStorage` du navigateur (clé `appart-sim-params-v1`), avec indication d’heure de sauvegarde dans l’en-tête.

---

## Sauvegardes et confidentialité

### Ce qui est versionné sur GitHub

- Le **code** et les **valeurs d’exemple** (`DEFAULT_PARAMS` dans `src/utils.js`) : montants ronds, scénario pédagogique.
- **Aucune** donnée personnelle ne doit être commitée volontairement.

### Ce qui reste chez vous

| Support | Rôle |
|---------|------|
| **localStorage** | Sauvegarde automatique de votre configuration courante |
| **`public/defaults.local.json`** | Fichier **ignoré par git** ; chargé au premier lancement si le navigateur est vide |
| **Export JSON** (Patrimoine) | Sauvegarde manuelle, à ranger hors du dépôt |

Fichiers exclus du dépôt (voir `.gitignore`) : `public/defaults.local.json`, `simulateur-immo-*.json`, etc.

### Ordre de chargement au démarrage

1. Données déjà présentes dans **localStorage** → priorité.
2. Sinon, tentative de lecture de **`/defaults.local.json`** (uniquement si vous avez créé ce fichier en local).
3. Sinon, **paramètres d’exemple** embarqués dans l’application.

---

## Personnalisation locale

Pour travailler avec **vos** chiffres sans les mettre dans Git :

1. Configurez le simulateur dans l’UI (ou importez un export existant).
2. **Patrimoine → Export** → enregistrez le JSON.
3. Copiez-le vers :

   ```text
   public/defaults.local.json
   ```

4. (Optionnel) Videz la sauvegarde du site pour ce domaine, ou utilisez **Réinit.** puis rechargement : l’app relira `defaults.local.json`.

Le fichier modèle vide `public/defaults.local.example.json` sert de référence de nom uniquement.

**Réinit.** remet les **valeurs d’exemple publiques**, pas votre fichier local.

---

## Structure du projet

```text
├── public/
│   ├── defaults.local.example.json   # exemple (versionné)
│   └── defaults.local.json           # vos valeurs (non versionné, à créer)
├── src/
│   ├── App.jsx              # Shell, navigation, orchestration
│   ├── AppNav.jsx           # Menu latéral
│   ├── Sidebar.jsx          # Paramètres (cartes)
│   ├── Portfolio.jsx        # Patrimoine de départ
│   ├── LoansEditor.jsx      # Éditeur de prêts
│   ├── MonthlyTable.jsx     # Flux mensuels + CSV
│   ├── ProjectionChart.jsx  # Courbes patrimoine
│   ├── GapChart.jsx         # Écart vs location
│   ├── CompositionChart.jsx # Décomposition du patrimoine
│   ├── simulator.js         # Moteur de simulation
│   ├── loans.js             # Prêts, HCSF, mensualités
│   ├── utils.js             # Défauts, formatage, persistance
│   ├── chartHelpers.js      # Utilitaires graphiques
│   └── ui/                  # Composants de formulaire partagés
├── scripts/
│   └── optimal-strategy.mjs # Exploration de paramètres (CLI, optionnel)
├── index.html
├── vite.config.js
└── package.json
```

---

## Scripts npm

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement avec rechargement à chaud |
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Sert le build localement |
| `npm run lint` | ESLint sur le projet |

---

## Limites et avertissement

Ce outil est un **modèle simplifié** à but exploratoire. Il ne remplace ni un conseil fiscal, juridique, bancaire ou en gestion de patrimoine, ni une offre de prêt réelle.

Les estimations (taxe foncière, loyer LMNP, amortissements, impôts) reposent sur des hypothèses documentées dans le code ; les situations réelles varient (avis d’imposition, taux négociés, vacance locative, plus-values, etc.).

Utilisez les résultats comme **ordre de grandeur** pour arbitrer des scénarios, pas comme promesse de performance.

---

## Contribuer

Les issues et pull requests sont les bienvenues. Merci de ne pas inclure de exports JSON ou de `defaults.local.json` contenant des données personnelles.

---

## Licence

Projet à usage personnel / open source. Ajoutez un fichier `LICENSE` si vous publiez avec une licence précise (MIT, etc.).