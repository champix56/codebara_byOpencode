# Fenêtre usine (scanneur de codes-barres)

## Rôle

Route `/usine` : scanner de codes-barres produits — **EAN-8, EAN-13, UPC-A et UPC-E** — via la caméra sur iOS/Android. Sur le web (pas de caméra exploitable dans Expo) : formulaire de saisie manuelle, qui accepte en plus l'UPC-B.

## Structure visuelle

### Natif (`src/components/usine-ecran.tsx`)

- `CameraView` plein écran sur fond noir, scanneur restreint aux 4 types (`ean8`, `ean13`, `upc_a`, `upc_e`).
- Barre de navigation native : titre « Usine » + bouton de retour natif (web compris).
- Panneau blanc en bas de la prévisualisation : astuce (« Visez un code-barres… ») puis dernier scan — libellé du format + badge « Code valide » (vert) / « Clé de contrôle invalide » (rouge) + les chiffres.

### Web (`src/components/usine-ecran.web.tsx`)

- Titre, aide listant les formats, champ numérique 13 caractères max (séparateurs filtrés).
- Libellé live du format détecté (vert si valide, rouge sinon), bouton « Valider le code » désactivé tant que non valide.
- Après validation : « Code X prêt — en attente du serveur (branchement à venir) » (TODO).

## États

- **Natif** : 1) permission en cours de résolution (« Préparation de la caméra… ») ; 2) caméra refusée → écran dédié « Activer la caméra » + lien « Ouvrir les réglages » ; 3) caméra active → scan continu. Une seule demande automatique par ouverture ; anti-rafale : code identique ignoré 2,5 s.
- **Web** : saisie vide → libellé caché ; saisie en cours → détection à la volée par la longueur (8 → EAN-8/UPC-E, 11 → UPC-B, 12 → UPC-A, 13 → EAN-13).
- Règles de validation partagées et sans React : `src/utils/codes-bar.ts` (clé de contrôle EAN/UPC, expansion UPC-E selon le 6e chiffre).

## Navigation

- Entrée : tap la zone usine sur la carte (fenêtre principale).
- Sortie : bouton retour de la barre de navigation native → `router.back()` (le geste système s'ajoute en natif).

## Notes

- Plugin `expo-camera` configuré dans `app.json` : `cameraPermission` en français, `microphonePermission: false` (aucun enregistrement), `recordAudioAndroid: false`, `barcodeScannerEnabled: true` — appliqué par la génération continue (CNG), il faut relancer `npx expo run:ios|android` (ou un build EAS) après modification.
- Variante de plateforme : Metro choisit `usine-ecran.web.tsx` (formulaire) sur le web et `usine-ecran.tsx` (caméra) en natif, pour un même import.
- Un seul appareil actif à la fois : la pile démonte la fenêtre au retour, ce qui coupe la caméra.
- UPC-B (11 chiffres, National Drug Code, **sans clé de contrôle**) ne correspond à aucune symbologie de scanneur caméra : il n'est pas scannable nativement, il est accepté par validation structurelle dans le formulaire web.
- Un code de 8 chiffres peut être ambigu (EAN-8 ou UPC-E affiché) : la clé valide dans les deux cas → libellé « formats confondus » ; côté natif, le type renvoyé par la caméra (type upc_e) lève le doute.
