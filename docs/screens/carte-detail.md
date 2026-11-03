# Fenêtre détail carte

Route : `/carte/[id]` — fichier `src/app/carte/[id].tsx` (monte `src/components/carte-detail.tsx`)

## Rôle

**Vue d'une carte unique** en détail, ouverte depuis la liste de la maison (push natif). L'archive `.cdz` est lue du **cache local** `<idUser>/<carteId>.cdz` (§6.6) ; si elle est absente ou corrompue : `GET /card/{id}` (§5.5 — `card` TOUJOURS renvoyé), validation complète (sha256 global == `cardHash`, §6.3), stockage et maj de l'index du nom.

## Structure visuelle

- Barre de navigation native : titre « Carte » + bouton retour.
- En-tête : avatar `perso.png` (≤256×256, arrondi) + nom (`datas.name`, « Carte #id » si vide) + `#id`.
- **`front.png` en grand** (600×1037, `aspectRatio`, data URI base64) — le serveur dessine déjà nom, stats, barres et specials sur l'image (§6.2, rendu recommandé v1).
- Bloc stats (tolérant §6.4) : Puissance (`datas.power` ou valeur serveur), Santé, Attaque, Rareté, Saison.
- Bloc « Capacités spéciales » si `specials` non vide : nom, attaque/santé, durée (`turn`).

## États

- `etat` : `chargement` (« Chargement de la carte… ») / `pret` {cdz, serveur} / `sans-session` / `erreur` (+ bouton vert « Réessayer »).
- Chargement : cache local d'abord (§6.6) — archive illisible ou hash interne en écart → retombe automatiquement sur le serveur (§5.5). Validation : signature ZIP + checksum/cardHash + `hashs.json` internes (§6.3).
- En succédant de téléchargement réseau : stockage `<idUser>/<carteId>.cdz` + index du nom (`majIndex`) — la fenêtre reste hors ligne ensuite.
- Sans session ET cache absent : message « Connecte-toi pour ouvrir le détail… ».
- Numéro invalide dans l'URL : « Numéro de carte inconnu ».
- Rotation du request-token au succès serveur, sérialisation des appels (contrat §9.1) ; mort de session → gestion centralisée (reset + purge + `/login`).

## Navigation

- Entrée : tap une ligne de la liste maison (`router.push('/carte/844')`).
- Sortie : bouton retour de la barre → `router.back()` ; geste iOS en natif.

## Notes

- Le fichier `back.png` extrait mais non affiché (mise en réserve) ; `deck.json` non consommé (rendu libre à venir).
- Attention contrat §12.5 : `GET /card/{id}` ne vérifie PAS l'appartenance — appels uniquement depuis la collection du joueur.
- Sur web : archive dans IndexedDB (`codebara-cdz`) plutôt que sur disque (expo-file-system natif-only).
