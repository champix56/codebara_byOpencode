# Fenêtre usine (scanner + fabrication de carte)

Fenêtre : `usine` — fichiers `src/components/usine-ecran.tsx` (natif) / `usine-ecran.web.tsx` (web), popup partagée `src/components/fabrication-carte.tsx` (rendu par `App.tsx` avec l'en-tête maison)

## Rôle

Scanner de codes-barres produits (EAN-8, EAN-13, UPC-A, UPC-E via caméra ; + UPC-B en saisie web) puis **fabrication de la carte** : `POST /card {cb}` (§5.3) → archive `.cdz` → popup « éclosion » (front + nom OBLIGATOIRE) → `PUT /card/name` (§5.7) → version finale stockée localement.

## Structure visuelle

### Natif — scanner

- `CameraView` plein écran, scanneur restreint aux 4 types ; panneau blanc en bas : astuce, dernier scan (format + badge valide/invalide + chiffres).
- Sous le chiffre : bouton vert **« Fabriquer la carte »** (désactivé si code invalide, sans session, popup déjà ouverte) + note grise « Sans session serveur, la fabrication est indisponible. » ; message d'état (vert/rouge) dans le panneau.

### Web — saisie

- Titre, aide formats, champ numérique, libellé live, bouton **« Fabriquer la carte »** (désactivé tant que non valide ou sans session), message d'état.

### Popup « fabrication » (Modal, partagée natif/web)

- **Génération** : spinner vert + « Génération en cours — … jusqu'à 2 minutes » (fermeture non proposée pendant l'attente).
- **Éclosion** : titre « Éclosion — carte #id », `front.png` du zip affiché tel quel (600×1037, data URI), champ « Nom de la carte » (placeholder « Obligatoire », 60 car. max), bouton « Envoyer le nom » (désactivé si vide ou en envoi — libellé « Envoi… »).
- **Sans fichier** (réponse asynchrone §5.3 à venir) : « Carte #id créée — apparaîtra dans la maison une fois finalisée » + « Compris ».
- **Erreur** : titre « Échec de fabrication », message rouge, bouton gris « Fermer ».

## États

- **Scanner** : permission caméra (une demande auto / anti-rafale 2,5 s, cf. notes) ; `fabrication` (code soumis + popup ouverte), `message` parent.
- **Popup — recette §6.1** : `POST /card` → base64 → octets → `sha256(bytes) == checksum` ; extraction ZIP + `hashs.json` internes ; **écart → re-téléchargement unique `GET /card/{id}`** puis re-validation ; **stockage immédiat de la v1** `<idUser>/<cardid>.cdz` ; puis popup éclosion.
- **Renommage** : `PUT /card/name {cid, name}` → réponse `{cid, card}` SANS checksum → validation par extraction interne (signature ZIP + hashs.json) → **v2 remplace la v1** + index nom (`majIndex`). **ZIP uniquement** : une archive non-ZIP (bug serveur tar.xz §5.7, décision produit 2026-11-03) est refusée avec un message « la version d'origine reste dans la collection » — la v1 stockée fait foi.
- Étapes internes : `generer` / `eclosion` / `sans-fichier` / `erreur` ; garde-fous anti setState après démontage.
- Succession serveur inactif (§9.2) : 400 « Invalid Request with body… » → message dédié « Génération indisponible… » (jamais de déconnexion — le token reste bon).
- Timeout `POST /card` : **150 s** (génération IA synchrone 10 s à 2 min, contrat §5.3) ; autres routes 10 s.

## Navigation

- Entrée : tap la zone usine sur la carte (fenêtre principale).
- Sortie : bouton retour de la barre d'en-tête maison → `retourner()` (dépile vers la fenêtre principale) ; la fermeture de la popup ne quitte pas la fenêtre.

## Notes

- Le stockage passe par `src/services/collection.ts` : répertoire **par id utilisateur** — natif `<documentDirectory>/<idUser>/<carteId>.cdz` (sandbox privé : accessible uniquement par l'application), web IndexedDB (`codebara-cdz`).
- Anti-rafale & permission caméra : cf. `docs/screens/usine.md` d'origine — inchangés.
- Plugin `expo-camera` configuré dans `app.json` (CNG : relancer `npx expo run:ios|android` après modification).
- Variante de plateforme : Metro choisit `usine-ecran.web.tsx` (formulaire) sur web et `usine-ecran.tsx` (caméra) en natif pour un même import ; `FabricationCarte` est unique aux deux.
- UPC-B (11 chiffres, sans clé de contrôle) : accepté uniquement en saisie web.
- Déterminisme (§9.4) : deux scans du même code + même saison → même illustration.
