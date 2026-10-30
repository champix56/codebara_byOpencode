# Fenêtre principale

## Rôle

Écran d'accueil de l'app (route `/principal`) : affiche la carte (`../img2.svg`) et rend les zones portant un `data-action` taponables — chacune ouvre sa fenêtre dédiée. **Seule cette fenêtre** dispose d'un menu latéral (accès aux autres fenêtres + déconnexion). Un **bandeau publicitaire** est réservé dans la partie basse de l'écran.

## Structure visuelle

- **Barre de navigation native** (expo-router) : titre **« CodEbara »**, bouton ☰ à gauche, **pas de retour en arrière** (entrée par `router.replace`, geste de balayage iOS désactivé).
- **Carte** : chaque `<image>` du SVG est dessinée dans une surface mesurée, échelle `xMidYMid meet` (tout le viewBox visible, centré, marges égales). Les images portant un `data-action` deviennent des `Pressable` (opacité 0,85 à l'appui).
- **Bandeau publicitaire** (composant `BandeauPub`) : bande de **52 px + inset safe-area** en bas, fond gris très clair avec filet haut discret et libellé « Espace publicitaire » — contenu placeholder en attendant le serveur.
- **Menu latéral** (composant `MenuLateral` — ouvert par ☰, fermé par tap sur la zone assombrie) : liste les fenêtres Usine, Maison, Boutique, Arène ; en bas un bouton rouge **« Se déconnecter »**.

## États

- `menuOuvert` : le menu latéral glisse depuis la gauche (200 ms, Animated natif).
- Aucun état serveur : la géométrie vient du fichier généré `src/data/carte.ts`.
- Une `data-action` sans route connue est ignorée (garde-fou `ROUTES_ZONES`).

## Navigation

- **Déconnexion** (menu latéral) : `dispatch(seDeconnecter())` remet la tranche utilisateur à l'état initial, `persistor.purge()` efface sa persistance du stockage local, puis `router.replace('/login')`.
- Entrée : depuis `/login` (Connexion, ou bouton debug) via `router.replace` — retour arrière impossible vers la connexion.
- Sortie : tap zone → `router.push` vers `/usine`, `/maison`, `/boutique` ou `/arene` ; ou menu latéral → mêmes routes.

## Notes

- Source de vérité de la carte : `../img2.svg` (dossier parent du projet). Le script `scripts/extraire-carte-svg.mjs` extrait les PNG dans `assets/carte/` et régénère `src/data/carte.ts` (`node scripts/extraire-carte-svg.mjs`).
- Le bandeau pub vit dans `src/components/bandeau-pub.tsx` : le branchement des vraies campagnes se fera là, sans toucher à la fenêtre.
- Le store Redux (tranche utilisateur persistée) est décrit dans [`../architecture.md`](../architecture.md).
