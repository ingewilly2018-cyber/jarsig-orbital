# JARSIG Orbital

Application web d'exploration de la Lune et de préparation de missions. Elle associe une carte et un globe lunaire, des données astronomiques NASA/JPL, des bulletins de mission, une simulation d'atterrissage et des fonctions de sauvegarde et d'administration.

## Technologies utilisées

### Interface et serveur web

| Technologie | Utilisation |
|---|---|
| TypeScript | Typage du code côté client et serveur. |
| React 19 | Interface en composants. |
| TanStack Start | Framework React full-stack et fonctions serveur. |
| TanStack Router | Navigation et routes typées. |
| TanStack Query | Gestion et cache des requêtes côté interface. |
| Vite 8 | Serveur de développement et compilation. |
| Nitro | Construction et déploiement, configuré pour Cloudflare module. |
| Tailwind CSS 4 | Styles et responsive design. |
| Radix UI | Primitives accessibles pour les composants d'interface. |
| Lucide React | Icônes. |
| Recharts | Graphiques scientifiques. |
| React Hook Form et Zod | Gestion et validation des formulaires et données entrantes. |
| date-fns | Formatage et calcul des dates. |
| Sonner | Notifications. |
| Canvas 2D et WebGL | Tracé des contours géographiques et globe lunaire 3D. |

### Données, authentification et base

| Technologie | Utilisation |
|---|---|
| Supabase Auth | Connexion, comptes et identités. |
| PostgreSQL | Stockage des comptes liés, données lunaires, journaux, analyses et cache d'éphémérides. |
| postgres.js (postgres) | Connexion SQL serveur. |
| Drizzle ORM / Drizzle Kit | Outils de schéma présents dans le projet ; le schéma SQL de référence est backend/db/schema.sql. |
| TanStack Start Server Functions | Appels serveur aux services et à la base. |

### Outils de développement

Bun (paquets et scripts), Vitest (tests), React Testing Library et jsdom (tests d'interface), ESLint (analyse) et Prettier (formatage). Les versions exactes sont indiquées dans package.json et verrouillées par bun.lock.

## Services et sources de données

| Source | Utilisation |
|---|---|
| [NASA Moon Trek / LRO WAC](https://trek.nasa.gov/) | Tuiles WMTS de la surface lunaire, carte et texture du globe. |
| [NASA Image and Video Library](https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf) | Recherche d'images lunaires (pas de clé requise). |
| [NASA APOD](https://api.nasa.gov/) | Image astronomique du jour (NASA_API_KEY, ou DEMO_KEY à défaut). |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/api.html) | Éphémérides du Soleil et de la Terre pour un site lunaire. |
| [NASA Artemis RSS](https://www.nasa.gov/blogs/artemis/feed/) | Actualités et annonces Artemis. |
| [Calendrier NASA](https://www.nasa.gov/event-type/launch-schedule/) | Informations de lancements et missions. Les dates doivent être confirmées sur le site officiel, car elles évoluent. |
| [Natural Earth](https://www.naturalearthdata.com/) | Fichier GeoJSON des contours nationaux, utilisé pour la superposition illustrative sur la Lune. Ce n'est pas une API NASA. |
| [Étude des sites polaires](https://doi.org/10.1029/2025JE009434) | Référence des coordonnées de sites dans src/lib/lunar-sites.ts. |

Les requêtes nécessitant des secrets ou un accès serveur sont exécutées côté serveur. Les limites de taux et la disponibilité des services externes s'appliquent.

## Structure du projet

    jarsig-orbital/
    ├── backend/db/schema.sql       # Schéma PostgreSQL de référence
    ├── drizzle/schema.ts           # Entrée Drizzle (générée/actuellement vide)
    ├── public/                     # Icônes et fichiers statiques
    ├── scripts/seed-users.ts       # Initialisation des comptes Supabase
    ├── src/
    │   ├── components/             # Carte/globe NASA, fond étoilé, composants UI
    │   │   ├── NasaMoonGlobe.tsx
    │   │   ├── NasaWmtsMap.tsx
    │   │   └── ui/
    │   ├── hooks/                  # Hooks React partagés
    │   ├── integrations/supabase/  # Clients, types et middleware d'authentification
    │   ├── lib/                    # API NASA/JPL, base, missions et logique métier
    │   ├── routes/                 # Pages et routage
    │   │   ├── index.tsx           # Accueil
    │   │   ├── auth.tsx            # Connexion/inscription
    │   │   └── _authenticated/    # Pages protégées : admin, carte, missions, jeu, science
    │   ├── styles.css
    │   ├── router.tsx
    │   ├── server.ts               # Entrée serveur TanStack Start
    │   └── routeTree.gen.ts        # Arbre de routes généré
    ├── supabase/config.toml
    ├── .env.example
    ├── package.json
    ├── bun.lock
    ├── vite.config.ts
    └── vitest.config.ts

## Fonctionnalités et pages

- / : accueil et accès à l'exploration.
- /auth : authentification Supabase.
- /map : carte NASA/JPL déplaçable et zoomable, sélection de coordonnées et sites de référence.
- /science : positions du Soleil et de la Terre via Horizons, graphiques et analyses sauvegardables.
- /missions : informations Artemis et calendrier de lancements avec liens NASA.
- /play : sélection d'une zone, carte ou globe 3D, superposition illustrative de pays et jeu de simulation d'alunissage.
- /admin : gestion des comptes et rôles réservée aux administrateurs.

La carte et le globe reposent sur les images NASA LRO WAC. Le cercle d'emprise du pays est calculé selon son contour. Les coordonnées des sites polaires sont des références documentées dans src/lib/lunar-sites.ts.

## Installation et configuration

Prérequis : Bun, un projet Supabase pour Auth, une base PostgreSQL accessible depuis le serveur ; Node.js/npx est utile à la prévisualisation et au déploiement Nitro.

À la racine (dossier contenant package.json), installer les dépendances :

    bun install

Copier .env.example en .env et remplir les valeurs :

    DATABASE_URL=postgresql://...
    VITE_SUPABASE_URL=https://<projet>.supabase.co
    VITE_SUPABASE_PUBLISHABLE_KEY=<clé-publique>
    SUPABASE_URL=https://<projet>.supabase.co
    SUPABASE_PUBLISHABLE_KEY=<clé-publique>
    SUPABASE_SERVICE_ROLE_KEY=<clé-secrète>
    NASA_API_KEY=<clé-optionnelle>

La clé NASA est facultative pour APOD (le code utilise DEMO_KEY par défaut). Pour créer les comptes initiaux, renseigner également ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_USER_EMAIL et DEMO_USER_PASSWORD selon .env.example.

Ne jamais publier .env ni SUPABASE_SERVICE_ROLE_KEY. La clé de service est réservée au serveur et au script d'initialisation.

### Initialiser la base

Le schéma principal est backend/db/schema.sql. Sous PowerShell, avec DATABASE_URL défini dans l'environnement :

    psql $env:DATABASE_URL -f backend/db/schema.sql

Pour créer les comptes de développement après configuration des variables :

    bun run db:seed

Le SQL est prévu pour pouvoir être réappliqué sans supprimer les tables ou les lignes existantes. Vérifier la base ciblée avant toute opération en production.

## Commandes : démarrage, compilation et déploiement

Toutes les commandes sont à lancer depuis le dossier du projet contenant package.json.

### Développement

    bun run dev

Ouvrir l'adresse locale affichée par Vite dans le terminal, généralement http://localhost:5173. Les fonctionnalités Supabase et PostgreSQL demandent un .env valide et le schéma appliqué.

### Compiler pour production

    bun run build

### Prévisualiser localement la compilation

    npx vite preview

### Déployer sur Render

Créer un service de type **Web Service**. Utiliser ces commandes dans les paramètres du service :

    Build Command: bun install --frozen-lockfile && bun run build
    Start Command: bun run start

Le démarrage utilise le serveur de production Node et le port fourni par Render. Ne pas utiliser `bun run dev` comme commande de démarrage : Vite dev est réservé au développement local et n'expose pas le service comme attendu par Render.

Ajouter dans Render les variables serveur `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_SERVICE_ROLE_KEY`. Pour le client, ajouter également `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` : les variables `VITE_` sont intégrées lors du build. `SUPABASE_PROJECT_ID` et `VITE_SUPABASE_PROJECT_ID` ne sont pas l'URL ; le code de l'application n'en a pas besoin pour créer le client Supabase.

### Déployer sur Cloudflare

Pour cibler Cloudflare, sélectionner le preset pendant le build. Après connexion au bon compte Cloudflare et configuration des secrets :

    NITRO_PRESET=cloudflare-module bun run build
    npx nitro deploy --prebuilt

Configurer DATABASE_URL, les variables Supabase et tout secret dans l'environnement sécurisé de déploiement ; ne pas les intégrer aux fichiers du site.

### Qualité et tests

    bun run lint
    bun run test
    bun run test:watch

## Base de données et sécurité

Le schéma SQL est dans backend/db/schema.sql, la connexion serveur dans src/lib/db.server.ts et les opérations dans src/lib/database.functions.ts. La base contient notamment les comptes liés à Supabase, les zones polaires, les ressources de surface, les journaux, les analyses enregistrées et le cache des éphémérides. Les contrôles de rôle administrateur sont réalisés côté serveur. Les analyses enregistrées sont associées à leur créateur.

## Limites scientifiques et opérationnelles

- Les échéances des missions évoluent ; les publications NASA font foi.
- Horizons fournit des éphémérides pour les coordonnées et paramètres choisis. L'application n'est pas un système de navigation de mission.
- Les fenêtres d'éclairement et de visibilité sont estimées à partir d'échantillons. Le relief local détaillé, les occultations topographiques et la production réelle d'énergie solaire ne sont pas simulés.
- Le mini-jeu est pédagogique et indépendant des données opérationnelles NASA.
- Les frontières Natural Earth sont dessinées à titre illustratif sur le globe lunaire : elles ne décrivent pas des territoires lunaires.
