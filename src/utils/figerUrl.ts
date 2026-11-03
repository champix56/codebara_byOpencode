// Utilitaire web : URL du navigateur toujours figée à la racine de l'app.
//
// Exigence produit (2026-11-03) : dans le navigateur, aucune route ne doit
// apparaître dans l'URL (…/login, …/maison, …/carte/4… interdits) — seule la
// base de l'app — et la construction des fenêtres doit toujours repartir du
// splash. Or expo-router adresse ses navigations en écrivant l'API History
// du navigateur (pushState / replaceState) : ces deux méthodes sont
// réécrites pour que toute écriture cible la racine « / ». L'écran affiché
// reste commandé exclusivement par le router (la navigation interne ne
// change pas) ; seule la barre d'adresse est figée. En natif la fenêtre
// n'a pas d'URL : tout est sans effet (garde `typeof window`).
//
// Autre rôle : mémoïser l'URL INITIALE du navigateur, capturée à la toute
// première évaluation du module (importée dès le chargement du bundle par
// le layout racine) — à cet instant le router n'a rien écrit, donc l'URL
// reflète ce que l'utilisateur a tapé (éventuellement un lien profond
// « …/maison », que le layout racine corrige après montage). Idempotence
// assurée par un marqueur posé sur `window`, car le module peut être
// réévalué (Fast Refresh) ; le test headless de 2026-11-03 (Chrome) verrouille
// ce comportement.

type FenetreAvecMarqueur = Window & typeof globalThis & { __urlFige?: boolean };

// URL complète (chemin + requête + ancre) telle qu'elle était au chargement
// du bundle ; `null` hors navigateur (natif, SSR statique).
const urlInitiale: string | null =
  typeof window === 'undefined' ? null : window.location.pathname + window.location.search + window.location.hash;

// `true` si l'utilisateur est arrivé par un chemin qui n'est pas la racine
// (lien profond tapé à la main ou adresse front partagée).
export function urlInitialeHorsRacine(): boolean {
  return urlInitiale !== null && urlInitiale !== '/';
}

// Installe la réécriture de l'API History (idempotent : sans effet si déjà
// posé par un déclenchement antérieur). Le `state` écrit par react-navigation
// (clé de reprise au popstate) est conservé tel quel : seul le chemin est
// réécrit — la navigation par bouton arrière du navigateur reste fonctionnelle
// de fenêtre à fenêtre, mais l'adresse affichée reste « / ».
export function figerHistorique(): void {
  if (typeof window === 'undefined') return; // natif : pas de barre d'adresse
  const fenetre = window as FenetreAvecMarqueur;
  if (fenetre.__urlFige) return;
  fenetre.__urlFige = true;

  const push = window.history.pushState.bind(window.history);
  const replace = window.history.replaceState.bind(window.history);
  // La `url` reçue du router (une route de fenêtre) est écrasée par la racine.
  window.history.pushState = function (etat, titre, _url) {
    return push.call(window.history, etat, titre, '/');
  };
  window.history.replaceState = function (etat, titre, _url) {
    return replace.call(window.history, etat, titre, '/');
  };
}

// Réécrit (dans une seule entrée d'historique) le chemin courant vers la
// racine en conservant le `state` existant. À appeler à un cold start hors
// racine, immédiatement avant `router.replace('/')`.
export function razHistoriqueVersRacine(): void {
  window.history.replaceState(window.history.state, '', '/');
}
