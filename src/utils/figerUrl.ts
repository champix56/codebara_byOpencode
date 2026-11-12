// Utilitaire web : URL du navigateur toujours figée à la racine de l'app.
//
// Exigence produit (2026-11-03) : dans le navigateur, aucune route ne doit
// apparaître dans l'URL (…/login, …/maison, …/carte/4… interdits) — seule la
// base de l'app — et la construction des fenêtres doit toujours repartir du
// splash. Depuis le 2026-11-11 l'app n'a PLUS AUCUN ROUTER (navigation par
// état, src/navigation/navigateur.ts) : rien n'écrit jamais d'entrée
// d'historique, donc l'adresse ne peut pas bouger d'elle-même. Ce module
// ne reste que pour verrouiller la règle :
// 1. réécriture de `history.pushState` / `history.replaceState` — toute
//    écriture (lib tierce, code futur) cible la racine « / » ;
// 2. adresse initiale hors racine (lien profond tapé à la main) → remise à
//    « / » dans une seule écriture, avant le montage de l'app : le flux repart
//    du splash (fenêtre « chargement »), aucun chemin ne peut sélectionner une
//    page. En natif la fenêtre n'a pas d'URL : tout est sans effet (garde
//    `typeof window`).
//
// Idempotence assurée par un marqueur posé sur `window`, car le module peut
// être réévalué (Fast Refresh) ; le test headless de 2026-11-03 (Chrome) et le
// contrôle hors navigateur `scripts/verifier-figer-url.mjs` verrouillent ce
// comportement.

type FenetreAvecMarqueur = Window & typeof globalThis & { __urlFige?: boolean };

// Installe le verrou (idempotent : sans effet si déjà posé par un
// déclenchement antérieur). Le `state` éventuellement écrit est conservé tel
// quel : seul le chemin cible est réécrit vers « / ».
export function verrouillerUrlRacine(): void {
  if (typeof window === 'undefined') return; // natif : pas de barre d'adresse
  const fenetre = window as FenetreAvecMarqueur;
  if (fenetre.__urlFige) return;
  fenetre.__urlFige = true;

  const push = window.history.pushState.bind(window.history);
  const replace = window.history.replaceState.bind(window.history);
  // L'`url` reçue (un chemin de fenêtre, même parasite) est écrasée par la racine.
  window.history.pushState = function (etat, titre, _url) {
    return push.call(window.history, etat, titre, '/');
  };
  window.history.replaceState = function (etat, titre, _url) {
    return replace.call(window.history, etat, titre, '/');
  };

  // Lien profond tapé à la main : l'entrée courante est ramenée à « / » (une
  // seule écriture) avant le montage de l'application — le flux repart du
  // splash quel que soit le chemin demandé.
  const horsRacine =
    window.location.pathname !== '/' || window.location.search !== '' || window.location.hash !== '';
  if (horsRacine) {
    window.history.replaceState(window.history.state, '', '/');
  }
}
