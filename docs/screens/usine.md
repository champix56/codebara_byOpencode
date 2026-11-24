# Fenêtre usine (scanner + fabrication de carte)

Fenêtre : `usine` — fichiers `src/components/usine-ecran.tsx` (natif) / `usine-ecran.web.tsx` (web), popup partagée `src/components/fabrication-carte.tsx` (rendu par `App.tsx` avec l'en-tête maison)

## Rôle

Scanner de codes-barres produits (EAN-8, EAN-13, UPC-A, UPC-E via caméra ; + UPC-B en saisie web) puis **demande de fabrication** : `POST /card {cb}` (§5.3) → réponse immédiate `{cardid}` (id définitif, pas de `.cdz`). Depuis le 2026-11-24, la génération est asynchrone côté serveur (pool de threads + file JSON + table miroir) : la carte est livrée plus tard via la fenêtre **Poste**, où le joueur l'accepte (nom optionnel) ou la refuse. L'ancien Pipeline synchrone « éclosion → PUT /card/name → stockage immédiat » n'est plus le chemin normal.

## Structure visuelle

### Natif — scanner

- `CameraView` plein écran, scanneur restreint aux 4 types ; panneau blanc en bas : astuce, dernier scan (format + badge valide/invalide + chiffres).
- Sous le chiffre : bouton vert **« Fabriquer la carte »** (désactivé si code invalide, sans session, popup déjà ouverte) + note grise « Sans session serveur, la fabrication est indisponible. » ; message d'état (vert/rouge) dans le panneau.

### Web — saisie + scan caméra (@zxing/browser)

- Titre, aide formats, champ numérique, libellé live, bouton **« Fabriquer la carte »** (désactivé tant que non valide ou sans session), message d'état.
- **Scan caméra** (exigence 2026-11-15, web uniquement, moteur `@zxing/browser` 0.2 + `@zxing/library`) : le bouton bleu **« Scanner avec la caméra »** n'apparaît que si un périphérique caméra est détecté (`navigator.mediaDevices` + `enumerateDevices` — une liste vide laisse le bouton, le démarrage affichera l'erreur). Appui : élément `<video>` créé par le DOM et inséré dans la View d'aperçu (300×200, liseré vert quand actif) — `BrowserMultiFormatReader` avec hints EAN-8/EAN-13/UPC-A/UPC-E, caméra **arrière** (`facingMode: 'environment'`). Le callback alimente le champ de saisie (même pipeline que la saisie manuelle : format + clé de contrôle) ; **anti-rafale 2,5 s** sur un même code ; frames sans code ignorées. Appui suivant : « Arrêter la caméra » (flux coupé, vidéo retirée) ; arrêt aussi au démontage.
- Erreurs caméra (rouge) : « Accès refusé » / « Aucune caméra détectée » / message brut ; la saisie manuelle reste utilisable.
- iOS/Android : restent sur `usine-ecran.tsx` (expo-camera) — `@zxing/browser` n'est embarqué que par la variante web.

### Popup « fabrication » (Modal, partagée natif/web)

- **Demande envoyée** (chemin normal depuis 2026-11-24) : « Carte #id créée — vous recevrez une notification dans la Poste une fois la génération terminée » + « Compris ». Aucun fichier n'est écrit localement ici.
- **Génération** (ancien mode synchrone `TEST`, toléré) : spinner vert + « Génération en cours — … jusqu'à 2 minutes » (fermeture non proposée pendant l'attente).
- **Éclosion** (ancien mode synchrone, toléré) : titre « Éclosion — carte #id », **visuel 3D en vitrine de musée pleine largeur** (`visuel-carte.tsx`, carte 220 px), champ « Nom de la carte » (obligatoire), bouton « Envoyer le nom ».
- La remise de la carte (visuel 3D + stats + nom optionnel) se fait désormais dans la fenêtre [poste](./poste.md), pas dans l'usine.
- **Erreur** : titre « Échec de fabrication », message rouge, bouton gris « Fermer ».

## États

- **Scanner** : permission caméra (une demande auto / anti-rafale 2,5 s, cf. notes) ; `fabrication` (code soumis + popup ouverte), `message` parent.
- **Popup — recette §6.1 / §5.15** : `POST /card` → `{cardid}` immédiat ; aucun base64, aucun stockage local, aucun `PUT /card/name` ici. Le `.cdz` n'est téléchargé que depuis la Poste, via `POST /awaiting_cards/{id}`, puis écrit dans `<idUser>/<cardid>.cdz` avec `majIndex` (nom optionnel saisi là-bas).
- **Ancien mode synchrone** (si le serveur renvoie malgré tout `card` + `checksum`) : base64 → octets → `sha256(bytes) == checksum` ; extraction ZIP + `hashs.json` internes ; écart → re-téléchargement unique `GET /card/{id}` puis re-validation ; stockage + popup éclosion + `PUT /card/name` conservés pour compatibilité.
- Étapes internes : `generer` / `eclosion` / `sans-fichier` / `erreur` ; garde-fous anti setState après démontage.
- Succession serveur inactif (§9.2) : 400 « Invalid Request with body… » → message dédié « Génération indisponible… » (jamais de déconnexion — le token reste bon).
- Timeout `POST /card` : **150 s** conservé par tolérance (l'ancien mode synchrone peut encore répondre après 10 s–2 min) ; la réponse asynchrone normale est immédiate, autres routes 10 s.

## Navigation

- Entrée : tap la zone usine sur la carte (fenêtre principale).
- Sortie : bouton retour de la barre d'en-tête maison → `retourner()` (dépile vers la fenêtre principale) ; la fermeture de la popup ne quitte pas la fenêtre. Depuis 2026-11-24, aucune redirection automatique vers le détail carte : le joueur récupère sa carte depuis la **Poste**.

## Notes

- Le stockage passe par `src/services/collection.ts` : répertoire **par id utilisateur** — natif `<documentDirectory>/<idUser>/<carteId>.cdz` (sandbox privé : accessible uniquement par l'application), web IndexedDB (`codebara-cdz`).
- Anti-rafale & permission caméra : cf. `docs/screens/usine.md` d'origine — inchangés.
- Plugin `expo-camera` configuré dans `app.json` (CNG : relancer `npx expo run:ios|android` après modification).
- Variante de plateforme : Metro choisit `usine-ecran.web.tsx` (formulaire) sur web et `usine-ecran.tsx` (caméra) en natif pour un même import ; `FabricationCarte` est unique aux deux.
- UPC-B (11 chiffres, sans clé de contrôle) : accepté uniquement en saisie web.
- Déterminisme (§9.4) : deux scans du même code + même saison → même illustration.
