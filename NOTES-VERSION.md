# Notes de version — CodEbara

Mode incrémentiel : chaque changement dans l'app ajoute une nouvelle section
`## vX.Y.Z` **en haut** de la liste. La première section est la version
courante embarquée dans l'app (`src/data/notes-version.ts`, généré par
`npm run maj:notes`). Les nouveautés sont suivies à partir de v0.0.8 ; les
évolutions antérieures ne sont pas listées.

## v0.0.22

- Tu peux choisir un avatar pour ton compte : six images intégrées ou une photo de ta bibliothèque, recadrée en cercle avec zoom et déplacement. L'avatar est enregistré sur le serveur et s'affiche dans l'en-tête et dans l'École. Sans avatar, tes initiales apparaissent dans un cercle gris.
- La monnaie affichée dans l'en-tête est maintenant ton montant réel, pas une valeur fixe.
- Les maisons affichent des aperçus de cartes à 20 % : la tienne les garde en cache, celle d'un ami les reçoit directement. L'archive complète n'est téléchargée que quand tu ouvres le détail d'une carte.

## v0.0.21

- Correction d'un crash au démarrage sur les builds Android installés via APK : la minification du code ne supprime plus les classes nécessaires aux notifications en arrière-plan.

## v0.0.20

- Nouveau script `npm run release` : il crée le tag et la release GitHub avec le dernier APK (`codebara.0.0.x.apk`) et l'export web zippé (`codebara.0.0.x.web.zip`).

## v0.0.19

- Chaque notification de création de carte indique maintenant le numéro de la carte, même quand la génération a échoué.
- En cas d'échec, la Poste affiche le motif précis dans le corps du message, avec une icône : un œuf pour une carte générée, une croix rouge pour un échec.

## v0.0.18

- Les notifications continuent d'arriver quand l'appli est fermée : le téléphone interroge le serveur pour le dernier joueur connecté, sans utiliser ni consommer tes tokens de session.
- Chaque notification joue un son et fait vibrer, que l'appli soit ouverte ou non.
- Sur navigateur, le service worker tente le même suivi lorsque l'onglet est fermé, selon les possibilités du navigateur.

## v0.0.17

- La version de l'app s'affiche aussi sur la fenêtre de connexion ; un appui dessus ouvre les notes de version, comme depuis la principale.

## v0.0.16

- notifications système sur mobile et sur le web : tu es prévenu dès qu’un message arrive, avec le logo et sa nature, sans le corps du message.
- Un appui sur une notification ouvre ta Poste (ou la connexion si ta session est terminée), sans changer l’adresse de l’application.
- Après la fabrication d’une carte, le popup validé te ramène automatiquement à la page principale.
- Sur le web, la page principale ne s’ouvre plus tant que la saison en cours n’est pas complètement arrivée ; son nom s’affiche en haut de la carte.

## v0.0.15

- Fabriquer une carte ne t'immobilise plus devant l'usine : la génération se fait en arrière-plan et tu reçois une notification quand elle est prête.
- Nouvelle fenêtre « Poste » pour lire tes messages et récupérer tes cartes, accessible depuis le menu ou le bâtiment de la saison.
- À la réception, vois ta carte en 3D avec ses caractéristiques, puis accepte-la (avec ou sans nom) ou refuse-la.
- Si une carte ne peut pas être générée, tu es prévenu dans la Poste et la carte est retirée automatiquement.

## v0.0.14

- Plein écran sur mobile : les boutons de navigation système sont masqués, seule la barre de notification du haut reste visible.
- Un bouton flash (torche) est disponible dans la fenêtre caméra de l'usine pour scanner en basse lumière.
- Correction du crash sur Android lors de l'affichage du nom incrusté sur les cartes (taille de police négative).
- Stabilité améliorée lors de la visite de la maison d'un ami : plus de fermeture de l'application sur la dernière carte.

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
