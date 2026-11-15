# Fenêtre détail carte

Fenêtre : `carte` — `App.tsx` monte `src/components/carte-detail.tsx` avec l'en-tête maison ; le `carteId` est porté par la fenêtre (plus aucun segment d'URL)

## Rôle

**Vue d'une carte unique** en détail, ouverte depuis la liste de la maison (empilement). L'archive `.cdz` est lue du **cache local** `<idUser>/<carteId>.cdz` (§6.6) ; si elle est absente ou corrompue : `GET /card/{id}` (§5.5 — `card` TOUJOURS renvoyé), validation complète (sha256 global == `cardHash`, §6.3), stockage et maj de l'index du nom.

## Structure visuelle

- Barre d'en-tête maison : titre « Carte » + bouton retour.
- En-tête : avatar `perso.png` (≤256×256, arrondi) + nom (`datas.name`, « Carte #id » si vide) + `#id`.
- **Renommage sur place** (exigence 2026-11-15) : crayon **✎** à côté du nom → champ texte pré-rempli (60 car. max) + « Enregistrer » / « Annuler » + erreur éventuelle.
- **Visuel 3D en vitrine de musée pleine largeur (`visuel-carte.tsx`, carte 300 px)** : la vitrine occupe **toute la largeur du parent** (fond sombre `#191d24`, liseré) ; la carte (faces `front.png` / `back.png` sur un plan à perspective) est posée sur un **pupitre** (dalle, fût, socle) éclairé par un **spot plafonnier** (faisceau triangulaire + halo chaud) — son **ombre glisse sur la dalle** avec la rotation. Le **fond lointain** bouge en **parallaxe** (bien moins que la carte) sous une **vignette** qui assombrit les bords : il paraît plus loin que la carte. Glissement **horizontal** = rotation complète (360° libres) — le **dos (`back.png`) apparaît passé 90°, non miroir** (`transform-style: preserve-3d` sur web, composition native correcte d'origine) ; glissement **vertical** = inclinaison bornée ±30° qui révèle les **reflets de lumière** ; **pincer à deux doigts** (écarter / resserrer) = **zoom ×0,5 à ×3** (distance entre les deux touches, rotation figée pendant le pincement, zoom conservé au relâchement — exigence 2026-11-15). Pointeur (web) ou doigt (natif) via le même système répondeur, posé sur toute la vitrine. La pose est conservée au relâchement.
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
