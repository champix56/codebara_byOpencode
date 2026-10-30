# Documentation — codEbara

Application mobile Expo / React Native. Cette documentation est le point d'entrée du projet.

## Index

| Fichier | Contenu |
| --- | --- |
| [architecture.md](./architecture.md) | Stack technique, point d'entrée, structure des dossiers, navigation |
| [development.md](./development.md) | Installation, commandes de dev, vérifications, gestion des dépendances, builds EAS |
| [conventions.md](./conventions.md) | Principes de code, politique de vérification des docs Expo, règles dures |
| [screens/](./screens/README.md) | Un fichier Markdown par écran (« fenêtre ») — descriptions délocalisées pour limiter l'usage de tokens |

## Comment la lire ?

- **Humain qui découvre le projet** : commencer par `architecture.md`, puis `development.md`.
- **Agents (OpenCode)** : la skill `project-docs` (`.opencode/skills/project-docs/`) indexe ce répertoire et charge le bon fichier selon la question.

## Règle de maintenance

Toute évolution qui modifie la structure, les commandes ou les conventions doit être répercutée ici (voir la commande `/docs` d'OpenCode pour automatiser cette mise à jour après une session de travail).
