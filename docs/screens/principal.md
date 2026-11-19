# Fenêtre principale

Fenêtre : `principal` — fichier `src/ecrans/principal.tsx`

## Rôle

Écran d'accueil de l'app (fenêtre `principal`) : affiche la **carte de la saison d'affichage courante** (`.cds` chargé au splash, ou saison embarquée en secours) et rend ses ressources graphiques taponables — chacune ouvre la fenêtre déclarée par `batiments.*.fenetre` dans le `season.json`. **Seule cette fenêtre** dispose d'un menu latéral (accès aux autres fenêtres + déconnexion). Un **bandeau publicitaire** est réservé dans la partie basse de l'écran.

## Structure visuelle

- **Barre d'en-tête maison** (`src/components/entete-ecran.tsx`) : logo `assets/icon.png` de la hauteur du texte juste avant le titre **« CodEbara »**, bouton ☰ à gauche (slot `gauche`), **pas de retour en arrière** (hub du jeu, entrée par remplacement). À droite : pièce `assets/coin.png` + valeur `1000` en bulle vert clair, puis avatar (jusqu'à 2 initiales du nickname) cliquable → `mairie`.
- **Carte** (`src/components/carte-interactive.tsx`) : viewbox + zones construites par `principal.tsx` depuis `saisonAffichageCourante()` (images du `.cds` en cache natif ou data URI web ; SVG `../img2.svg` / `src/data/carte.ts` en secours). Chaque zone devient un `Pressable` (opacité 0,85 à l'appui) dont `action` est la fenêtre à ouvrir.
- **Bandeau publicitaire** (composant `BandeauPub`) : bande de **68 px + inset safe-area** en bas, fond gris très clair avec filet haut discret et libellé « Espace publicitaire » — contenu placeholder en attendant le serveur. **Sous le bandeau (exigence 2026-11-16) : champ de version « CodEbara v0.0.x »** pressable (vert) — ouvre la fenêtre `notes` (cf. `notes-version.md`) ; `VERSION_APPLI` vient de `src/data/notes-version.ts` (généré depuis `NOTES-VERSION.md`).
- **Menu latéral** (composant `MenuLateral` — ouvert par ☰, fermé par tap sur la zone assombrie) : liste les fenêtres Usine, Maison, Mairie, Boutique, Arène, **École** ; en bas un bouton rouge **« Se déconnecter »**.

## États

- `menuOuvert` : le menu latéral glisse depuis la gauche (200 ms, Animated natif).
- Aucun état serveur ici : la géométrie vient de la saison courante, sinon du fichier généré `src/data/carte.ts`.
- Une `fenetre` de saison sans correspondance dans `ZONES` est ignorée (garde-fou) au lieu de faire planter la navigation.

## Navigation

- **Déconnexion** (menu latéral) : `dispatch(seDeconnecter())` remet la tranche utilisateur à l'état initial, `persistor.purge()` efface sa persistance du stockage local, puis `remplacer({ nom: 'connexion' })`.
- Entrée : depuis la fenêtre connexion (authentification réussie, ou bouton debug) via `remplacer` — retour arrière impossible vers la connexion.
- Sortie : tap sur une ressource de saison → `naviguer` vers la fenêtre `fenetre` déclarée (`usine`, `maison`, `mairie`, `boutique`, `arene`, `notes`, `ecole` — table `ZONES`) ; ou menu latéral → les mêmes fenêtres (dont `ecole`, libellé « École »).

## Notes

- Source de vérité de la carte : `../img2.svg` (dossier parent du projet). Le script `scripts/extraire-carte-svg.mjs` extrait les PNG dans `assets/carte/` et régénère `src/data/carte.ts` (`node scripts/extraire-carte-svg.mjs`).
- Le bandeau pub vit dans `src/components/bandeau-pub.tsx` : le branchement des vraies campagnes se fera là, sans toucher à la fenêtre.
- Le store Redux (tranche utilisateur persistée) est décrit dans [`../architecture.md`](../architecture.md).
