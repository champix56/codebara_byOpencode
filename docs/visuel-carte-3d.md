# Visuel 3D de la carte — vitrine de musée (`src/components/visuel-carte.tsx`)

Utilisé par la réception d'une carte fabriquée en usine (popup éclosion) et la
fenêtre détail (cf. `screens/usine.md` / `screens/carte-detail.md`). Pur React
Native — aucune dépendance native (web, iOS, Android). Toute la géométrie dérive
de la largeur de la carte (paramètre `largeur`).

## Mise en scène

- La vitrine occupe **toute la largeur du parent** (`width: '100%'`, éléments
  centrés par `left: '50%'` + marge négative) ; la carte (faces `front.png`
  recto / `back.png` verso sur un plan à perspective) est mise en valeur sur un
  **pupitre** (dalle `#3c414d`, fût, socle) dans une vitrine sombre (`#191d24`)
  éclairée par un **spot plafonnier** (faisceau triangulaire dessiné par bordures
  + halos chauds).
- L'**ombre de la carte glisse sur la dalle** avec la rotation
  (`-sin(rotationY)`) ; le **fond lointain** suit en **parallaxe** bien plus
  lentement + léger agrandissement, sous une **vignette** à deux anneaux — il
  paraît plus loin que la carte.

## Gestes (PanResponder posé sur toute la vitrine, pointeur web ou doigt natif)

- **Glissement horizontal = rotation complète illimitée** : le dos (`back.png`)
  apparaît passé 90° **NON MIROIR** — web exige `transform-style: preserve-3d`
  sur le pivot (sinon aplanissement = miroir ; cast `PROFONDEUR_WEB`, web seul —
  react-native-web transmet bien la propriété via son compilateur CSS), natif
  compose correctement d'origine (`backfaceVisibility` standard).
- **Glissement vertical = inclinaison bornée ±30°** qui révèle les **reflets de
  lumière** (bandes translucides pures RN — glissement avec la rotation via sin,
  intensité avec l'inclinaison).
- **Pincement à deux doigts = zoom ×0,5 à ×3** (exigence 2026-11-15) : distance
  entre les deux touches de `nativeEvent.touches`, écart de référence figé au
  premier mouvement du pincé, rotation figée pendant le pincement, référence de
  rotation réarmée à la sortie (pas de coup de rotation avec le dx cumulatif) —
  l'échelle est posée sur le pivot.
- La pose (rotation, inclinaison, zoom) est **conservée au relâchement** ;
  dans une `ScrollView`, un geste vertical passe à la liste (capture à partir
  d'un déplacement réel).
