# Écrans / Fenêtres

Un fichier Markdown par écran (« fenêtre ») de l'application. Règle constante : toute description d'écran demandée est écrite **ici** et non dans la conversation, afin de limiter l'usage de tokens.

## Index

| Fichier | Écran | Dernière mise à jour |
| --- | --- | --- |
| [chargement.md](./chargement.md) | Splash par étapes réelles — « tentative de connexion auto » / « connexion » puis « récupération des cartes » (vérification hash du cache, modal de destruction d'archive corrompue, re-téléchargement des manquantes) | 2026-11-12 |
| [connexion.md](./connexion.md) | Connexion / création de compte — vrai serveur (`GET /user/auth`, `POST /user`) + bouton debug ; succès → splash post-connexion (étapes connexion + récupération des cartes) | 2026-11-12 |
| [principal.md](./principal.md) | Fenêtre principale — carte plein écran, zones data-action taponables, bandeau publicitaire bas | 2026-11-11 |
| [usine.md](./usine.md) | Usine — scanner + fabrique : `POST /card` → popup éclosion (visuel 3D front/back + nom obligatoire) → `PUT /card/name` → stockage `<idUser>/<id>.cdz` | 2026-11-12 |
| [maison.md](./maison.md) | Maison — collection en grille d'aperçus (image front + valeurs), zoom 6→2 par ligne, recherche nom/#id, filtre série (saison `.cdz`), cellules → détail | 2026-11-12 |
| [carte-detail.md](./carte-detail.md) | Détail carte (fenêtre `carte`, id porté par la fenêtre) — visuel 3D front/back tournable (360° h, ±30° v, reflets de lumière), perso, stats `datas.json`, depuis le cache local ou `GET /card/{id}` | 2026-11-12 |
| [mairie.md](./mairie.md) | Mairie — informations personnelles : nickname envoyé au serveur (`PUT /user` §5.10), mot de passe **saisi par l'utilisateur** (masqué + œil, indicateur de niveau, 5 règles) → déconnexion sur 200 | 2026-11-11 |
| [boutique.md](./boutique.md) | Boutique — fenêtre vierge (retour discret) | 2026-11-11 |
| [arene.md](./arene.md) | Arène — fenêtre vierge (retour discret) | 2026-11-11 |

## Format attendu

Chaque fichier `<id>.md` (`<id>` en kebab-case, aligné sur le nom de la fenêtre) suit ce squelette :

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
