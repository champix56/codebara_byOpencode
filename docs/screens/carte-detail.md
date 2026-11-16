# Fenêtre détail carte

Fenêtre : `carte` — `App.tsx` monte `src/components/carte-detail.tsx` avec l'en-tête maison ; le `carteId` est porté par la fenêtre (plus aucun segment d'URL)

## Rôle

**Vue d'une carte unique** en détail, ouverte depuis la liste de la maison (empilement). L'archive `.cdz` est lue du **cache local** `<idUser>/<carteId>.cdz` (§6.6) ; si elle est absente ou corrompue : `GET /card/{id}` (§5.5 — `card` TOUJOURS renvoyé), validation complète (sha256 global == `cardHash`, §6.3), stockage et maj de l'index du nom.

## Structure visuelle

- Barre d'en-tête maison : titre « Carte » + bouton retour.
- **Mise en page compacte (exigence 2026-11-15) : tout tient DANS l'écran sur
  mobile** — avatar `perso.png` centré en tête de fenêtre, visuel 3D, specs en
  dessous ; ScrollView en garde-fou. La largeur de la carte du visuel est
  calculée par `useWindowDimensions` : bornée par 42 % de la largeur d'écran,
  par un budget vertical (~45 % de la hauteur — la vitrine 3D fait ~2,5× la
  largeur de la carte), 200 px max, 120 px plancher.
- Nom (`datas.name`, « Carte #id » si vide) centré sous l'avatar + `#id`.
- **Nom incrusté sur le visuel 3D** (exigence 2026-11-16) : position et style
  lus dans `deck.json` (`positions.name` — x, y, taille de police, couleur) ;
  cf. `visuel-carte-3d.md` / `cdz-pipeline.md`.
- **Renommage sur place** (exigence 2026-11-15) : crayon **✎** à côté du nom → champ texte pré-rempli (60 car. max) + « Enregistrer » / « Annuler » + erreur éventuelle.
- **Visuel 3D en vitrine de musée (`visuel-carte.tsx`, carte compacte, cf. ci-dessus)** : la vitrine occupe **toute la largeur du parent** (fond sombre `#191d24`, liseré) ; la carte (faces `front.png` / `back.png` sur un plan à perspective) est posée sur un **pupitre** (dalle, fût, socle) éclairé par un **spot plafonnier** (faisceau triangulaire + halo chaud) — son **ombre glisse sur la dalle** avec la rotation. Le **fond lointain** bouge en **parallaxe** (bien moins que la carte) sous une **vignette** qui assombrit les bords : il paraît plus loin que la carte. Glissement **horizontal** = rotation complète (360° libres) — le **dos (`back.png`) apparaît passé 90°, non miroir** : **face unique, angle effectif θ/θ+180, image qui bascule** (correctif 2026-11-16 — aucune rotation imbriquée ni `backfaceVisibility` : Android ne rend pas les enfants d'un pivot 3D composé au-delà de 90°) ; glissement **vertical** = inclinaison bornée ±30° qui révèle les **reflets de lumière** ; **pincer à deux doigts** (écarter / resserrer) = **zoom ×0,5 à ×3** (distance entre les deux touches, rotation figée pendant le pincement, zoom conservé au relâchement). Pointeur (web) ou doigt (natif) via le même système répondeur, posé sur toute la vitrine. La pose est conservée au relâchement.
- Bloc stats (tolérant §6.4) : Puissance (`datas.power` ou valeur serveur), Santé, Attaque, Rareté, **Saison** — nom lisible (`datas.saison`, parsing opportuniste) sinon `seasonid`, « — » si aucun.
- Bloc « Capacités spéciales » si `specials` non vide : nom, attaque/santé, durée (`turn`).

## États

- `etat` : `chargement` (« Chargement de la carte… ») / `pret` {cdz, serveur} / `sans-session` / `erreur` (+ bouton vert « Réessayer ») ; `renommage` : { actif, nom, enCours, erreur }.
- Chargement : cache local d'abord (§6.6) — archive illisible ou hash interne en écart → retombe automatiquement sur le serveur (§5.5). Validation : signature ZIP + checksum/cardHash + `hashs.json` internes (§6.3).
- En succédant de téléchargement réseau : stockage `<idUser>/<carteId>.cdz` + index du nom + saison (`majIndex`) — la fenêtre reste hors ligne ensuite.
- **Renommage (✎)** : `PUT /card/name {cid, name}` (§5.7) → réponse SANS checksum → validation par extraction interne (ZIP + hashs.json) → **v2 remplace le cache** + index (nom + saison) → l'affichage repart sur la nouvelle archive. Archive invalide (non-ZIP/tar.xz §5.7) : erreur affichée, la v1 reste en place.
- Sans session ET cache absent : message « Connecte-toi pour ouvrir le détail… ».
- Id non numérique : impossible désormais — l'id vient de la fenêtre maison (`naviguer`), jamais d'une URL ; un id inconnu au serveur/cache tombe sur l'état erreur.
- Rotation du request-token au succès serveur, sérialisation des appels (contrat §9.1) ; mort de session → gestion centralisée (reset + purge + connexion).

## Navigation

- Entrée : tap une **cellule d'aperçu** de la grille maison (`naviguer({ nom: 'carte', carteId })`).
- Sortie : bouton retour de la barre d'en-tête → `retourner()` (dépile vers la maison).

## Notes

- Le fichier `back.png` est affiché comme **face arrière du visuel 3D** (visible en tournant la carte) ; `deck.json` non consommé (rendu libre à venir).
- Attention contrat §12.5 : `GET /card/{id}` ne vérifie PAS l'appartenance — appels uniquement depuis la collection du joueur.
- Sur web : archive dans IndexedDB (`codebara-cdz`) plutôt que sur disque (expo-file-system natif-only).
