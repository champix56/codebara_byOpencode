# Écrans / Fenêtres

Un fichier Markdown par écran (« fenêtre ») de l'application. Règle constante : toute description d'écran demandée est écrite **ici** et non dans la conversation, afin de limiter l'usage de tokens.

## Index

| Fichier | Écran | Dernière mise à jour |
| --- | --- | --- |
| [chargement.md](./chargement.md) | Écran de chargement (route `/`) — 2 tâches factices 2 s puis redirection | 2026-10-25 |
| [connexion.md](./connexion.md) | Connexion / création de compte (route `/login`) — en attendant le serveur : bouton debug et entrée directe | 2026-10-30 |
| [principal.md](./principal.md) | Fenêtre principale (route `/principal`) — carte plein écran, zones data-action taponables, bandeau publicitaire bas | 2026-10-30 |
| [usine.md](./usine.md) | Usine (route `/usine`) — scanneur de codes-barres EAN-8/13, UPC-A/UPC-E + UPC-B (caméra natif, saisie manuelle web) | 2026-10-30 |
| [maison.md](./maison.md) | Maison (route `/maison`) — formulaire du compte : modification nickname + mot de passe (tranche utilisateur persistée) | 2026-10-30 |
| [boutique.md](./boutique.md) | Boutique (route `/boutique`) — fenêtre vierge (retour discret) | 2026-10-30 |
| [arene.md](./arene.md) | Arène (route `/arene`) — fenêtre vierge (retour discret) | 2026-10-30 |

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
