# Écrans / Fenêtres

Un fichier Markdown par écran (« fenêtre ») de l'application. Règle constante : toute description d'écran demandée est écrite **ici** et non dans la conversation, afin de limiter l'usage de tokens.

## Index

| Fichier | Écran | Dernière mise à jour |
| --- | --- | --- |
| [chargement.md](./chargement.md) | Splash par étapes réelles — « tentative de connexion auto » / « connexion » puis « récupération des cartes » (vérification hash du cache, modal de destruction d'archive corrompue, re-téléchargement des manquantes) | 2026-11-12 |
| [connexion.md](./connexion.md) | Connexion / création de compte — vrai serveur (`GET /user/auth`, `POST /user`) + bouton debug ; succès → splash post-connexion (étapes connexion + récupération des cartes) | 2026-11-12 |
| [principal.md](./principal.md) | Fenêtre principale — carte de saison plein écran, ressources graphiques taponables (`batiments.*.fenetre` → `ZONES`), bandeau publicitaire bas + champ version « CodEbara v0.0.x » pressable (→ notes de version) | 2026-11-19 |
| [notes-version.md](./notes-version.md) | Notes de version — nouveautés par version (données générées depuis NOTES-VERSION.md, npm run maj:notes), version courante mise en avant | 2026-11-16 |
| [usine.md](./usine.md) | Usine — natif : scanner expo-camera ; **web : scan caméra @zxing/browser** (+ saisie manuelle) — `POST /card` → popup éclosion (visuel 3D vitrine pleine largeur : front/back + nom obligatoire) → `PUT /card/name` → stockage `<idUser>/<id>.cdz` → redirection détail carte | 2026-11-15 |
| [maison.md](./maison.md) | Maison — collection en grille d'aperçus (image front + valeurs), zoom 6→2 par ligne, recherche nom/#id, filtre série (nom de saison lu dans `datas.json`, sinon n°), cellules → détail | 2026-11-15 |
| [carte-detail.md](./carte-detail.md) | Détail carte (fenêtre `carte`, id porté par la fenêtre) — visuel 3D vitrine pleine largeur (pupitre, spot, ombre glissante, fond lointain en parallaxe ; recto front.png / verso back.png non miroir, 360° h, ±30° v, reflets, **zoom pincement 2 doigts**), perso, renommage ✎ (`PUT /card/name` §5.7), stats `datas.json`, cache local ou `GET /card/{id}` | 2026-11-15 |
| [mairie.md](./mairie.md) | Mairie — informations personnelles : nickname envoyé au serveur (`PUT /user` §5.10), mot de passe **saisi par l'utilisateur** (masqué + œil, indicateur de niveau, 5 règles) → déconnexion sur 200 | 2026-11-11 |
| [boutique.md](./boutique.md) | Boutique — fenêtre vierge (retour discret) | 2026-11-11 |
| [arene.md](./arene.md) | Arène — fenêtre vierge (retour discret) | 2026-11-11 |
| [ecole.md](./ecole.md) | École — 2 onglets : Recherche (joueurs par début de nickname/mail, `friendStatus` → Ajouter / En attente / Ami, **aucun accès maison**) et Amis (demandes repliables Accepter/Refuser + amis validés → maison visitée) | 2026-11-19 |
| [maison-visite.md](./maison-visite.md) | Maison visitée (ami validé) — cartes `GET /friend/{id}/cards` décodées **en mémoire**, grille + détail 3D, **lecture seule** (aucun stockage, renommage ni téléchargement) | 2026-11-19 |
| [poste.md](./poste.md) | Poste — messagerie (`GET /notifications` + `PUT` à l'ouverture), réception des cartes achevées : visuel 3D + stats, **accepter** (nom optionnel → `POST /awaiting_cards/{id}`, cache local) ou **refuser** (`DELETE`) ; retour verrouillé ; échec = purge automatique | 2026-11-24 |

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
- Identifiants ASCII sans accent partout dans le code (`ecole.md`, `Fenetre.nom`
  `ecole`, composants, valeurs `fenetre`) ; l'accent n'apparaît que dans les
  textes affichés (« École »).
- La conversation ne contient que le chemin du fichier + un résumé d'une ligne.
