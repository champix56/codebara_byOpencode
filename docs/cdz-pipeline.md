# Pipeline des archives `.cdz` (`src/utils/cdz.ts` + `src/utils/base64.ts`)

- Signature ZIP (garde-fou anti tar.xz §5.7), unzip **jszip**.
- `sha256(bytes)` via `expo-crypto.digest` : contrôle global `sha256(archive) == checksum == cardHash` (§6.3).
- Contrôles `hashs.json` internes (front / back / perso / datas) après tout téléchargement — écart = fichier corrompu → re-télécharger.
- `datas.json` parsing tolérant (§6.4) : champs optionnels, specials vides, champs additionnels futurs — **saison opportuniste** : nom lu dans les clés `season`/`seasonName`/`seasonname`, `seasonid` optionnel (les archives actuelles n'en portent aucun ; le code est prêt dès que le serveur l'écrit).
- Décision produit : **ZIP uniquement** (aucun fallback tar.xz).
- `extraireApercu(bytes)` — extraction **allégée** (front.png + datas.json, sans les contrôles §6.3) pour les aperçus de la grille maison ; les contrôles complets (`ouvrirCdz`) restent réservés à la fenêtre détail et à la fabrication.
- `src/utils/base64.ts` — encode/decode pur JS (Hermes, sans atob/btoa natifs).

Contenu type d'une archive : `front.png` (600×1037, rendu complet serveur), `back.png`, `perso.png` (≤256×256), `datas.json`, `deck.json` (non consommé), `hashs.json`.
