# Fenêtre maison (collection)

Route : `/maison` — fichier `src/components/maison-ecran.tsx`

## Rôle

**Liste des cartes d'un utilisateur courant** — `GET /card` (contrat §5.4, tokens requis : la réponse ne porte QUE les cartes de la session). Le nom n'est pas dans la liste : il vient de l'index local du cache (`<idUser>/index.json`, alimenté aux renommages). Chaque ligne ouvre le **détail** de la carte (route `/carte/[id]`).

## Structure visuelle

- Fond blanc, `ScrollView` + tirer-pour-actualiser, contenu centré, titre « Mes cartes ».
- Lignes pressables (trois vertis au tap) : **nom** (ou « Carte #id » si le nom n'est pas connu), stats serveur « Puissance / Santé / Attaque » (— si absents), checksum cardHash en petit gris (1 ligne).
- États d'affichage : chargement (« Chargement de la collection… »), vide (« Aucune carte encore — passe à l'usine scanner un code-barres ! »), sans-session, erreur (rouge + bouton vert « Réessayer »).

## États

- `etat` : `chargement` / `pret` / `vide` / `sans-session` / `erreur` ; `cartes`, `noms` (Record id → nom, index local), `rafraichit`.
- Chargement à l'ouverture uniquement ; tirer-pour-actualiser relance ; appels protégés **sérialisés** (contrat §9.1). Rotation du request-token au succès (service).
- Mort de session (« Invalid REQUEST TOKEN ») : reset + purge + `/login` centralisés — l'écran ignore l'erreur.
- Sans session : état dédié (bypass debug ou jamais connecté).
- Échec de l'index local : ignoré silencieusement (noms « #id »).

## Navigation

- Entrée : tap la zone maison sur la carte ou le menu latéral.
- Tap sur une ligne → `router.push(/carte/${id})` (fenêtre détail, push natif). Retour natif possible.
- Sortie propre par bouton retour → `router.back()`.

## Notes

- Contrat : `integration-client.md` à la racine (§5.4 liste sans noms ; §5.5 fichier ; §6.6 cache collection).
- Le **nom** affiché vient de `datas.json` (hash path du `.cdz`) — la liste serveur ne le porte pas.
- La génération de cartes se passe dans la fenêtre **usine** (§5.3 / §5.7).
