# Conventions

## Principes

- **Mobile-first** : priorité aux patterns mobiles, aux performances et à la compatibilité cross-platform.
- **Expo d'abord** : préférer les modules Expo recommandés aux librairies tierces, et vérifier les skills disponibles avant d'ajouter une dépendance.

## Vérifier la documentation Expo

Les API Expo changent à chaque release SDK — ne pas se fier à ses souvenirs. Avant d'écrire du code touchant une API Expo, EAS ou React Native :

1. Lire la version majeure de `expo` dans `package.json`.
2. Consulter les docs de cette version : `https://docs.expo.dev/versions/v<majeur>.0.0/`.
3. Sinon, `https://docs.expo.dev/llms.txt` — index complet des docs avec corrections des idées reçues courantes des LLM. Suivre le lien vers la page précise visée.

## Organisation du code (SPA sans router)

- **Aucune route, aucune URL** : navigation par état via `src/navigation/navigateur.ts` (`naviguer`, `remplacer`, `retourner`, type `Fenetre`) — jamais de lib de routing, jamais d'écriture d'historique navigateur.
- Écrans racine dans `src/ecrans/` (chargement, connexion, principal) ; les autres fenêtres sont rendues par `App.tsx` (en-tête maison `src/components/entete-ecran.tsx`).
- Composants, hooks et utilitaires restent **hors de** `src/ecrans/`.
- État global : Redux Toolkit dans `src/store/` (tranches + persistance redux-persist) — toujours les hooks typés `useAppDispatch` / `useAppSelector` de `src/store/hooks.ts`.
- Variante de plateforme : un composant commun peut avoir un frère `.web.tsx` choisi par Metro au même import (ex. `usine-ecran.tsx` = caméra natif, `usine-ecran.web.tsx` = saisie manuelle web) — jamais de `Platform.OS` pour tout un écran.

## Règles dures

- Ne jamais créer ni éditer `ios/` / `android/` à la main (CNG). Configuration native uniquement via `app.json` et config plugins.
- Toujours `npx expo install` pour ajouter une dépendance.
- Lint + typecheck obligatoires avant de clôturer une tâche.
- Pas de secret (clé d'API, token) en dur dans le code ou dans la configuration versionnée.

## Variables d'environnement

- Les clés préfixées **`EXPO_PUBLIC_`** sont en plus inlinées dans le bundle JS (client web/mobile) par Expo CLI — cf. [`/guides/environment-variables`](https://docs.expo.dev/guides/environment-variables.md). Tout le contenu de `.env` est en revanche chargé dans le process des commandes Expo (visible côté config dynamique).
- Variables « bare » à lire depuis le **code client** (ex. `DEBUG`) : passer par la config dynamique [`app.config.ts`](../app.config.ts) — `process.env.DEBUG === 'true'` → `extra.debug` — puis lire via `Constants.expoConfig.extra.debug` (expo-constants). Pattern documenté dans [`/workflow/configuration`](https://docs.expo.dev/workflow/configuration.md) (dynamic configuration).
- Valeurs par défaut versionnées dans `.env` ; surcharges locales dans `.env*.local` (non versionné ; l'existant du shell gagne sur `.env`).
- Rien de confidentiel derrière ces mécanismes : valeurs visibles en clair (bundle/manifest).

## Documentation des écrans (règle constante)

Chaque écran (« fenêtre ») demandé par l'utilisateur est décrit dans **un fichier Markdown dédié**, jamais dans la conversation, afin de limiter l'usage de tokens :

- Emplacement : `docs/screens/<id>.md` — un fichier par écran, `<id>` en kebab-case correspondant au nom de la fenêtre.
- Si le fichier existe déjà, le lire et le mettre à jour en place.
- Squelette attendu : Rôle, Structure visuelle, États, Navigation (+ notes utiles), en français et concis.
- Ajouter le fichier à l'index de [`screens/README.md`](./screens/README.md).
- Dans la conversation, ne répondre qu'avec le chemin du fichier et un résumé d'une ligne — jamais la description complète.
