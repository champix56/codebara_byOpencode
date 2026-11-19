# Notes de version — CodEbara

Mode incrémentiel : chaque changement dans l'app ajoute une nouvelle section
`## vX.Y.Z` **en haut** de la liste. La première section est la version
courante embarquée dans l'app (`src/data/notes-version.ts`, généré par
`npm run maj:notes`). Les nouveautés sont suivies à partir de v0.0.8 ; les
évolutions antérieures ne sont pas listées.

## v0.0.13

- L'école s'ouvre sur deux onglets : la recherche de joueurs (ajouter un ami, demande en attente ou déjà ami) et la liste des amis, avec les demandes reçues à accepter ou à refuser.
- Clique sur un ami pour visiter sa maison et regarder ses cartes en grand. La visite est en lecture seule : aucune carte de ton ami ne peut être modifiée.

## v0.0.12

- Nouveau : la saison d'affichage (décor de la carte du jeu) est chargée depuis le serveur et mise à jour automatiquement à chaque connexion. Le jeu affiche maintenant le décor de la saison en cours, ses bâtiments et ses détails.

## v0.0.11

- La collection est vérifiée directement avec le serveur à chaque connexion : les cartes abîmées sur le téléphone sont réparées automatiquement, et les cartes manquantes sont récupérées et contrôlées dès leur téléchargement.

## v0.0.10

- Le nom de la carte est écrit sur la carte elle-même, à la place prévue par le paquet (taille et couleur du texte incluses) — visuel 3D et grille de la maison.

## v0.0.9

- Le dos de la carte s'affiche à nouveau dans le visuel 3D sur Android et iOS (correctif supplémentaire).

## v0.0.8

- Scanne une carte avec la caméra directement depuis le navigateur (usine).
- Après la fabrication, la fenêtre du détail carte s'ouvre automatiquement pour nommer la carte.
- Le nom d'une carte se change depuis son détail (crayon ✎).
- La maison regroupe les cartes par saison, nom lu dans les paquets.
- Pince la carte à deux doigts dans le visuel 3D pour zoomer (×0,5 à ×3).
- Le dos de la carte s'affiche correctement dans le visuel 3D (Android et iOS).
- Le détail d'une carte tient désormais dans l'écran sur mobile : avatar, visuel et caractéristiques.
- Sur navigateur, le bouton retour revient à la fenêtre précédente du jeu au lieu de quitter le site.
- Cette fenêtre de nouveautés — reviens-y pour suivre les prochaines versions.
