// Point d'entrée de l'application (package.json → "main": "index.ts").
//
// Modèle classique (sans router) : ce fichier enregistre le composant racine
// `App` via `registerRootComponent` (doc Expo SDK 58 — registerRootComponent :
// https://docs.expo.dev/versions/latest/sdk/expo.md). Aucune route : la
// construction des fenêtres repart de `App.tsx` et de la pile de navigation
// (src/navigation/navigateur.ts).
import { registerRootComponent } from 'expo';
import App from './App';
import { verrouillerUrlRacine } from './src/utils/figerUrl';

// Web — exigence produit « l'URL du navigateur reste toujours la racine, la
// construction des fenêtres repart du splash » (src/utils/figerUrl.ts) :
// gel de l'API History + ramène d'une adresse hors racine (lien profond tapé
// à la main) au « / », au chargement du bundle et AVANT le montage de l'app.
// Sans effet en natif (pas de barre d'adresse).
verrouillerUrlRacine();

registerRootComponent(App);
