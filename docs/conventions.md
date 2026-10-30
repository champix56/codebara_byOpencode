# Conventions

## Principes

- **Mobile-first** : priorité aux patterns mobiles, aux performances et à la compatibilité cross-platform.
- **Expo d'abord** : préférer les modules Expo recommandés aux librairies tierces, et vérifier les skills disponibles avant d'ajouter une dépendance.

## Vérifier la documentation Expo

Les API Expo changent à chaque release SDK — ne pas se fier à ses souvenirs. Avant d'écrire du code touchant une API Expo, EAS ou React Native :

1. Lire la version majeure de `expo` dans `package.json`.
2. Consulter les docs de cette version : `https://docs.expo.dev/versions/v<majeur>.0.0/`.
3. Sinon, `https://docs.expo.dev/llms.txt` — index complet des docs avec corrections des idées reçues courantes des LLM. Suivre le lien vers la page précise visée.

## Organisation du code (cible Expo Router)

- Routes dans `src/app/` — un fichier = un écran, `_layout.tsx` = navigators.
- Composants, hooks et utilitaires restent **hors de** `src/app/`.
- Imports de navigation : `Link`, `router`, `useLocalSearchParams` depuis `expo-router`.

## Règles dures

- Ne jamais créer ni éditer `ios/` / `android/` à la main (CNG). Configuration native uniquement via `app.json` et config plugins.
- Toujours `npx expo install` pour ajouter une dépendance.
- Lint + typecheck obligatoires avant de clôturer une tâche.
- Pas de secret (clé d'API, token) en dur dans le code ou dans la configuration versionnée.

## Documentation des écrans (règle constante)

Chaque écran (« fenêtre ») demandé par l'utilisateur est décrit dans **un fichier Markdown dédié**, jamais dans la conversation, afin de limiter l'usage de tokens :

- Emplacement : `docs/screens/<id>.md` — un fichier par écran, `<id>` en kebab-case correspondant au nom de l'écran ou de la route.
- Si le fichier existe déjà, le lire et le mettre à jour en place.
- Squelette attendu : Rôle, Structure visuelle, États, Navigation (+ notes utiles), en français et concis.
- Ajouter le fichier à l'index de [`screens/README.md`](./screens/README.md).
- Dans la conversation, ne répondre qu'avec le chemin du fichier et un résumé d'une ligne — jamais la description complète.
