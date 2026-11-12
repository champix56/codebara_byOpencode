# Fenêtre détail carte

Fenêtre : `carte` — `App.tsx` monte `src/components/carte-detail.tsx` avec l'en-tête maison ; le `carteId` est porté par la fenêtre (plus aucun segment d'URL)

## Rôle

**Vue d'une carte unique** en détail, ouverte depuis la liste de la maison (empilement). L'archive `.cdz` est lue du **cache local** `<idUser>/<carteId>.cdz` (§6.6) ; si elle est absente ou corrompue : `GET /card/{id}` (§5.5 — `card` TOUJOURS renvoyé), validation complète (sha256 global == `cardHash`, §6.3), stockage et maj de l'index du nom.

## Structure visuelle

- Barre d'en-tête maison : titre « Carte » + bouton retour.
- En-tête : avatar `perso.png` (≤256×256, arrondi) + nom (`datas.name`, « Carte #id » si vide) + `#id`.
- **Visuel 3D (`visuel-carte.tsx`, 300 px)** : faces `front.png` / `back.png` sur un plan à perspective — glissement **horizontal** = rotation complète (360° libres, le dos apparaît passé 90°), glissement **vertical** = inclinaison bornée ±30° qui révèle les **reflets de lumière** (bandes translucides glissant avec la rotation, intensifiées par l'inclinaison). Pointeur (web) ou doigt (natif) via le même système répondeur. La pose est conservée au relâchement.
- Bloc stats (tolérant §6.4) : Puissance (`datas.power` ou valeur serveur), Santé, Attaque, Rareté, Saison.
- Bloc « Capacités spéciales » si `specials` non vide : nom, attaque/santé, durée (`turn`).

## États

- `etat` : `chargement` (« Chargement de la carte… ») / `pret` {cdz, serveur} / `sans-session` / `erreur` (+ bouton vert « Réessayer »).
- Chargement : cache local d'abord (§6.6) — archive illisible ou hash interne en écart → retombe automatiquement sur le serveur (§5.5). Validation : signature ZIP + checksum/cardHash + `hashs.json` internes (§6.3).
- En succédant de téléchargement réseau : stockage `<idUser>/<carteId>.cdz` + index du nom (`majIndex`) — la fenêtre reste hors ligne ensuite.
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
