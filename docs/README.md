# Documentation — codEbara

Application mobile Expo / React Native. Cette documentation est le point d'entrée du projet.

## Index

| Fichier | Contenu |
| --- | --- |
| [architecture.md](./architecture.md) | Stack, point d'entrée, structure des dossiers, dossiers natifs CNG — indexe les fichiers détaillés |
| [navigation.md](./navigation.md) | Pile de fenêtres en mémoire, flux chargement/connexion/principal, redirections |
| [web-url-figee.md](./web-url-figee.md) | Verrou d'URL web à la racine (figerUrl.ts), notes web annexes |
| [etat-global.md](./etat-global.md) | Redux Toolkit : store persisté, tranche utilisateur (tokens), DevTools, déconnexion |
| [services-serveur.md](./services-serveur.md) | api.ts (client HTTP, tokens rotatifs, sessions), collection.ts (cache .cdz), verification.ts |
| [cdz-pipeline.md](./cdz-pipeline.md) | Lecture/validation des archives .cdz (ZIP, sha256, hashs.json, saisons) |
| [cds-format.md](./cds-format.md) | Format .cds (saison d'affichage : fond + bâtiments cliquables), sélection serveur, endpoints /season, intégration client v0.0.12 (services/saison.ts) |
| [visuel-carte-3d.md](./visuel-carte-3d.md) | Visuel 3D vitrine de musée (rotation, inclinaison, reflets, zoom 2 doigts) |
| [serveur-dev-https.md](./serveur-dev-https.md) | Certificat auto-signé dev (génération, intégration Android/iOS, profil mobileconfig) |
| [development.md](./development.md) | Installation, commandes de dev, vérifications, gestion des dépendances, builds EAS |
| [conventions.md](./conventions.md) | Principes de code, politique de vérification des docs Expo, règles dures |
| [screens/](./screens/README.md) | Un fichier Markdown par écran (« fenêtre ») — descriptions délocalisées pour limiter l'usage de tokens |

## Comment la lire ?

- **Humain qui découvre le projet** : commencer par `architecture.md`, puis `development.md`.
- **Agents (OpenCode)** : la skill `project-docs` (`.opencode/skills/project-docs/`) indexe ce répertoire et charge UNIQUEMENT le fichier qui correspond à la question (règle anti-tokens : ne jamais lire tout le répertoire).

## Règle de maintenance

Toute évolution qui modifie la structure, les commandes ou les conventions doit être répercutée ici (voir la commande `/docs` d'OpenCode pour automatiser cette mise à jour après une session de travail).
