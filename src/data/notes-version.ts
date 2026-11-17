// GÉNÉRÉ par scripts/maj-notes-version.mjs — NE PAS ÉDITER À LA MAIN.
// Source maintenue : NOTES-VERSION.md (racine) — npm run maj:notes après édition.
// VERSION_APPLI = première section du md (la plus récente) ; affichée en jeu
// sous le bandeau publicitaire (« CodEbara v0.0.12 ») et
// consommée par la fenêtre notes de version.

export const VERSION_APPLI = '0.0.12';

export type NoteVersion = { version: string; lignes: string[] };

export const NOTES_VERSION: NoteVersion[] = [
  {
    "version": "v0.0.12",
    "lignes": [
      "Nouveau : la saison d'affichage (décor de la carte du jeu) est chargée depuis le serveur et mise à jour automatiquement à chaque connexion. Le jeu affiche maintenant le décor de la saison en cours, ses bâtiments et ses détails."
    ]
  },
  {
    "version": "v0.0.11",
    "lignes": [
      "La collection est vérifiée directement avec le serveur à chaque connexion : les cartes abîmées sur le téléphone sont réparées automatiquement, et les cartes manquantes sont récupérées et contrôlées dès leur téléchargement."
    ]
  },
  {
    "version": "v0.0.10",
    "lignes": [
      "Le nom de la carte est écrit sur la carte elle-même, à la place prévue par le paquet (taille et couleur du texte incluses) — visuel 3D et grille de la maison."
    ]
  },
  {
    "version": "v0.0.9",
    "lignes": [
      "Le dos de la carte s'affiche à nouveau dans le visuel 3D sur Android et iOS (correctif supplémentaire)."
    ]
  },
  {
    "version": "v0.0.8",
    "lignes": [
      "Scanne une carte avec la caméra directement depuis le navigateur (usine).",
      "Après la fabrication, la fenêtre du détail carte s'ouvre automatiquement pour nommer la carte.",
      "Le nom d'une carte se change depuis son détail (crayon ✎).",
      "La maison regroupe les cartes par saison, nom lu dans les paquets.",
      "Pince la carte à deux doigts dans le visuel 3D pour zoomer (×0,5 à ×3).",
      "Le dos de la carte s'affiche correctement dans le visuel 3D (Android et iOS).",
      "Le détail d'une carte tient désormais dans l'écran sur mobile : avatar, visuel et caractéristiques.",
      "Sur navigateur, le bouton retour revient à la fenêtre précédente du jeu au lieu de quitter le site.",
      "Cette fenêtre de nouveautés — reviens-y pour suivre les prochaines versions."
    ]
  }
];
