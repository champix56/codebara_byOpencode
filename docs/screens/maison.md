# Fenêtre maison (collection)

Fenêtre : `maison` — fichier `src/components/maison-ecran.tsx` (rendu par `App.tsx` avec l'en-tête maison)

## Rôle

**Collection du joueur courant sous forme d'aperçus** — `GET /card` (contrat §5.4, tokens requis : la réponse ne porte QUE les cartes de la session). La grille affiche l'**image front** de chaque carte avec **les valeurs sous l'image** ; le nom n'est pas dans la liste serveur : il vient de l'index local du cache (`index.json` / IndexedDB web, alimenté aux ouvertures de détail). Chaque carte ouvre son **détail** en grand (fenêtre `carte`, id porté par la fenêtre).

## Structure visuelle

- Fond blanc, `ScrollView` + tirer-pour-actualiser, contenu centré (max 560 px), titre « Mes cartes ».
- **Barre d'outils** :
  - champ de **recherche** (« Chercher par nom ou #numéro ») — insensible aux accents (« zeph » trouve « Zéphyr »), un `#id` filtre par numéro ;
  - liste déroulante **Série** (`@react-native-picker/picker`) : « Toutes les séries » + une option par saison (`datas.seasonid` des archives locales) + « Série inconnue » (cartes sans archive ou sans saison) ;
  - **zoom** : boutons `+` / `−` encadrant « n/ligne » — de **6 cartes par ligne** (défaut web ; 3 en natif) à **2** (bornes 2..6 ; `+` agrandit les cartes, `−` les réduits).
- **Grille** : cellules flexwrap, cadres ratio 600/1037 (`front.png` en `resizeMode: contain`) — les cartes sans cache local affichent un cadre gris avec « #id ». Sous le cadre : **nom** (ou « Carte #id ») puis stats « P puissance · S santé · A attaque » (`datas.*` de l'archive, sinon valeurs serveur, « — » si absents).
- États d'affichage : chargement (« Chargement de la collection… »), vide (« Aucune carte encore — passe à l'usine scanner un code-barres ! »), sans-session, erreur (rouge + bouton vert « Réessayer »), filtre sans résultat (« Aucune carte ne correspond à la recherche. »).

## États

- `etat` : `chargement` / `pret` / `vide` / `sans-session` / `erreur` ; `cartes`, `noms` (Record id → nom, index local), `rafraichit` ; outils : `recherche`, `serie` ('toutes' / 'inconnue' / String(saison)), `colonnes` (2..6) ; `apercus` (Record id → { image data URI, datas }).
- Chargement à l'ouverture uniquement ; tirer-pour-actualiser relance ; appels protégés **sérialisés** (contrat §9.1). Rotation du request-token au succès (service).
- **Aperçus** : lecture **séquentielle** des archives locales (`lireCarteLocale` + `extraireApercu`, sans contrôles d'intégrité §6.3), une à une pour ne pas bloquer l'UI, annulée au démontage ; chaque id n'est tenté qu'une fois (`tenteRef` — un rafraîchissement ne relit pas les archives déjà couvertes). Une archive illisible reste sans aperçu (le détail la re-téléchargera, §5.5).
- Mort de session (« Invalid REQUEST TOKEN ») : reset + purge + connexion centralisés — l'écran ignore l'erreur.
- Sans session : état dédié (bypass debug ou jamais connecté).
- Échec de l'index local : ignoré silencieusement (noms « #id »).

## Navigation

- Entrée : tap la zone maison sur la carte ou le menu latéral.
- Tap sur une **cellule d'aperçu** → `naviguer({ nom: 'carte', carteId: id })` (fenêtre détail, empilée). Retour possible ; la maison redevient visible avec ses filtres conservés.
- Sortie propre par bouton retour → `retourner()`.

## Notes

- Contrat : `integration-client.md` à la racine (§5.4 liste sans noms ; §5.5 fichier ; §6.6 cache collection).
- **Série** = `seasonid` de `datas.json` du `.cdz` local (aucune autre notion de série côté serveur) — les options du select se construisent depuis les aperçus chargés ; « Série inconnue » n'apparaît que si des cartes en manquent.
- **Web** : cache en IndexedDB (`codebara-cdz` v1, places `cartes`/`index`) ; le Picker rend un `<select>` natif.
- **Web** : aucune URL n'apparaît dans le navigateur — règle globale d'URL figée à la racine (`src/utils/figerUrl.ts`, cf. `docs/architecture.md`).
- Validé navigateur headless (CDP, 2026-11-12) : 8 cellules / 7 aperçus, zoom 16.67 %→50 %→16.67 % avec bornes, recherche + filtres, détail/retour, URL « / », zéro exception.
