# Écrans / Fenêtres

Un fichier Markdown par écran (« fenêtre ») de l'application. Règle constante : toute description d'écran demandée est écrite **ici** et non dans la conversation, afin de limiter l'usage de tokens.

## Index

| Fichier | Écran | Dernière mise à jour |
| --- | --- | --- |
| [chargement.md](./chargement.md) | Écran de chargement (route `/`) — 2 tâches factices 2 s puis redirection | 2026-10-25 |
| [connexion.md](./connexion.md) | Connexion / création de compte (route `/login`) | 2026-10-25 |

## Format attendu

Chaque fichier `<id>.md` (`<id>` en kebab-case, aligné sur le futur nom de route) suit ce squelette :

```md
# <Nom de l'écran>

## Rôle
## Structure visuelle
## États
## Navigation
```

Facultatif : une section `## Notes` pour les contraintes de performance, plateformes ou implémentation.

## Règles

- Mettre à jour le fichier existant en place avant d'en créer un nouveau doublon.
- Ajouter chaque nouveau fichier au tableau d'index ci-dessus avec la date.
- La conversation ne contient que le chemin du fichier + un résumé d'une ligne.
