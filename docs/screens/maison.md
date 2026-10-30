# Fenêtre maison

## Rôle

Route `/maison` : **liste des cartes en possession** du joueur — le résultat de `GET /card` du serveur pyCodebara2 (contrat §5.4 id, checksum, puissance, santé, attaque). Origine : la modification du profil a été déplacée vers la fenêtre mairie.

## Structure visuelle

- Fond blanc, `ScrollView` avec **tirer-pour-actualiser** (`RefreshControl`), contenu centré.
- Titre « Mes cartes ».
- Cartes : rangées grises arrondies — `# id` gras, ligne stats « Puissance / Santé / Attaque » (— si champ absent), checksum SHA-256 en small gris (1 ligne).
- Sans session serveur : message « Connecte-toi au serveur pour voir la collection… » (compte debug ou jamais connecté).
- Chargement : « Chargement de la collection… » ; collection vide : « Aucune carte encore — passe à l'usine scanner un code-barres ! ».
- Erreur : message rouge du serveur + bouton vert « Réessayer ».

## États

- `etat` : `chargement` / `pret` / `vide` / `sans-session` / `erreur`.
- Chargement **à l'ouverture uniquement** (`useEffect` + `charger`) ; tirer-pour-actualiser relance — un seul appel à la fois (les appels protégés sont **sérialisés** par le service, le couple de tokens ne pouvant servir qu'une fois, contrat §9.1).
- Rotation des tokens appliquée au succès par `src/services/api.ts` (`renouvelerRequestToken`).
- Mort de session (« Invalid REQUEST TOKEN ») : réinitialisation de la tranche **+ purger la persistance + redirection `/login`** centralisées dans le service ; l'écran ne fait rien d'autre.
- `sans-session` si `apiToken`/`requestToken` absents (bypass debug).

## Navigation

- Entrée : tap la zone maison sur la carte ou le menu latéral (fenêtre principale).
- Sortie : bouton retour de la barre de navigation native → `router.back()` ; geste iOS en natif.

## Notes

- Le rendu graphique et le nom des cartes viendront du fichier `.cdz` (` perso.png`/`datas.json` via `GET /card/{id}` §5.5) — la liste brute règne pour l'instant.
- La **génération** d'une carte (scan usine → `POST /card`, §5.3) n'est encore branchée — à faire dans la fenêtre usine.
- Contrat : `/home/champix/projets/pyCodebara2/docs/integration-client.md`.
