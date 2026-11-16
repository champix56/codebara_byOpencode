# Notes de version (`notes`)

## Rôle

Fenêtre « nouveautés » du jeu : la liste incrémentielle des versions est
embarquée dans l'app (aucune requête). Ouverte depuis le champ de version
« CodEbara v0.0.x » pressable sous le bandeau publicitaire de la fenêtre
principale (exigence produit 2026-11-16).

## Structure visuelle

- Barre d'en-tête maison : titre « Notes de version » + bouton retour.
- Phrase d'introduction (« Nouveautés par version — la plus récente en premier »).
- Une section par version : titre `vX.Y.Z` + liste à puces. La version
  **courante** (première section du md) est encadrée (liseré vert, fond
  légèrement teinté) avec le badge « installée ».

## Données

- `src/data/notes-version.ts` — **GÉNÉRÉ, ne pas éditer** : `VERSION_APPLI`
  (première section du md) + `NOTES_VERSION` (toutes les sections).
- Source maintenue à la main : **`NOTES-VERSION.md`** (racine) — une section
  `## vX.Y.Z` par version, la plus récente **en premier** ; `x` de « v0.0.x »
  s'incrémente à chaque changement dans l'app. Après édition :
  `npm run maj:notes` (`scripts/maj-notes-version.mjs`).

## Navigation

- Entrée : `naviguer({ nom: 'notes' })` depuis le bandeau pub (`principal`).
- Sortie : bouton retour ‹ (dépile vers `principal` ; sur web, consomme une
  entrée d'historique — cf. `navigation.md`).

## Notes

- Les nouveautés sont suivies à partir de **v0.0.8** (l'état antérieur n'est
  pas listé — exigence produit).
- Contenu orienté joueur, sans détail technique interne.
