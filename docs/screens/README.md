# Écrans / Fenêtres

Un fichier Markdown par écran (« fenêtre ») de l'application. Règle constante : toute description d'écran demandée est écrite **ici** et non dans la conversation, afin de limiter l'usage de tokens.

## Index

| Fichier | Écran | Dernière mise à jour |
| --- | --- | --- |
| [chargement.md](./chargement.md) | Écran de chargement (route `/`) — barre 4 s + reprise de session par tokens (serveur pyCodebara2) | 2026-10-31 |
| [connexion.md](./connexion.md) | Connexion / création de compte (route `/login`) — vrai serveur (`GET /user/auth`, `POST /user`) + bouton debug | 2026-10-31 |
| [principal.md](./principal.md) | Fenêtre principale (route `/principal`) — carte plein écran, zones data-action taponables, bandeau publicitaire bas | 2026-10-30 |
| [usine.md](./usine.md) | Usine (route `/usine`) — scanner + fabrique : `POST /card` → popup éclosion (front + nom obligatoire) → `PUT /card/name` → stockage `<idUser>/<id>.cdz` | 2026-11-03 |
| [maison.md](./maison.md) | Maison (route `/maison`) — collection d'un utilisateur courant (`GET /card`), noms via index local, lignes pressables → détail | 2026-11-03 |
| [carte-detail.md](./carte-detail.md) | Détail carte (route `/carte/[id]`) — front.png en grand, perso, stats `datas.json`, depuis le cache local ou `GET /card/{id}` | 2026-11-03 |
| [mairie.md](./mairie.md) | Mairie (route `/mairie`) — informations personnelles : nickname envoyé au serveur (`PUT /user` §5.10), mot de passe **saisi par l'utilisateur** (masqué + œil, indicateur de niveau, 5 règles) → déconnexion sur 200 | 2026-11-03 |
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
