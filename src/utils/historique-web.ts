// WEB ONLY — synchronisation de la pile de fenêtres avec l'historique du
// navigateur (exigence produit 2026-11-15). Sans ce module, le glissement
// arrière du navigateur (bouton ‹ du chrome, Alt+gauche, geste balayage)
// quittait l'app vers la page précédente du site ; le but : le retour du
// navigateur revient à la FENÊTRE précédente de l'app (principal → maison →
// carte…) et n'en sort jamais.
//
// Une entrée d'historique par niveau de pile :
//   - `synchroniser` (appelé à chaque changement de fenêtre) pousse une entrée
//     `{ profondeur }` quand la pile grandit (`naviguer`), la remplace quand
//     elle ne change pas (`remplacer` — chargement→connexion→principal) et ne
//     fait rien quand elle rétrécit (c'est déjà un `popstate`) ;
//   - le listener `popstate` replie/replie la pile pour rejoindre la profondeur
//     de l'entrée atteinte (`retourner` / `remonter`) ;
//   - si le navigateur descend SOUS la racine de l'app (state null — le joueur
//     revient sur l'entrée qui précédait le chargement de l'app), on repousse
//     une entrée à la racine : le glissement ne quitte jamais l'app.
//
// L'URL reste TOUJOURS la racine : les pushState/replaceState passent par les
// réécritures de `figerUrl.ts` (posées avant, par `index.ts`).
//
// Le bouton ‹ dans l'en-tête (web) appelle `retourWeb` = history.back() : la
// pile est alors dépliée par le popstate — navigation et historique restent
// alignés (un ‹ = une entrée consommée).

import { longueurPile, remonter, retourner } from '../navigation/navigateur';

type EtatHistorique = { profondeur: number } | null;

let installé = false;
let profondeurPrécédente = 1;
// Vrai pendant une restauration pilotée par popstate : les emettre() internes
// (retourner/remonter) ne doivent PAS re-synchroniser (sinon un « avant » du
// navigateur repousserait une entrée en double).
let enPopstate = false;

function pousser(profondeur: number): void {
  window.history.pushState({ profondeur }, '', '/');
}

function remplacer(profondeur: number): void {
  window.history.replaceState({ profondeur }, '', '/');
}

// Appelé par App.tsx à chaque changement de fenêtre rendue.
export function synchroniser(): void {
  if (typeof window === 'undefined' || !window.history) return;
  if (enPopstate) return; // la pile est en train de rejoindre un popstate
  const profondeur = longueurPile();
  if (profondeur > profondeurPrécédente) {
    pousser(profondeur);
  } else if (profondeur === profondeurPrécédente) {
    remplacer(profondeur);
  }
  // profondeur < précédente : dépilement DÉJÀ issu d'un popstate (retour web)
  // — écrire une entrée le mettrait en boucle.
  profondeurPrécédente = profondeur;
}

// Bouton retour de l'en-tête sur le web : consomme une entrée d'historique ;
// le popstate qui suit replie la pile (alignement un pour un).
export function retourWeb(): void {
  if (typeof window === 'undefined' || !window.history) return;
  window.history.back();
}

// À installer une seule fois (App.tsx, web).
export function installerHistoriqueWeb(): void {
  if (installé || typeof window === 'undefined' || !window.history) return;
  installé = true;
  // La page courante devient l'entrée racine de l'app.
  remplacer(longueurPile());
  window.addEventListener('popstate', (événement) => {
    const état = (événement.state ?? null) as EtatHistorique;
    const cible = état && typeof état.profondeur === 'number' ? état.profondeur : 0;
    if (cible < 1) {
      // Le joueur est descendu avant la racine de l'app : on repousse une
      // entrée racine — il reste dans l'app, à la fenêtre courante.
      pousser(longueurPile());
      return;
    }
    // Rejoint la profondeur demandée (arrière et avant) — emettre() tiré par
    // retourner/remonter est ignoré par synchroniser pendant ce bloc.
    enPopstate = true;
    while (longueurPile() > cible && retourner()) {
      /* dépile */
    }
    while (longueurPile() < cible && remonter()) {
      /* remonte */
    }
    enPopstate = false;
    profondeurPrécédente = longueurPile();
  });
}
