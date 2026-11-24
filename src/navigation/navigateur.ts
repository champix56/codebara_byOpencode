// Navigation par état — l'app est une SPA SANS router et SANS URL.
//
// Exigence produit (2026-11-11) : aucune route n'existe dans le projet — aucun
// chemin ne doit accéder à une page ou une construction particulière. Tout
// dépend de l'entrée dans l'application (fenêtre « chargement », toujours
// première) puis du parcours sur les boutons du jeu. Ce module tient lieu de
// navigateur : une pile de fenêtres en mémoire, commandée par les écrans.
//
// API miroir de l'ancien router (pour des migrations lisibles) :
// - `naviguer`   ≈ router.push     — empile une fenêtre (bouton retour actif) ;
// - `remplacer`  ≈ router.replace  — remplace la fenêtre courante sans empiler
//   (chargement → connexion/principal, connexion → principal, déconnexion) ;
// - `retourner`  ≈ router.back     — dépile vers la fenêtre précédente.
//
// Le service `api.ts` (hors React) et les composants appellent ce module
// directement ; `App.tsx` s'abonne (`enregistrerEcouteur`) et rend la fenêtre
// courante. Aucune écriture d'historique navigateur : l'URL reste la racine.

export type Fenetre =
  // mode 'auto' : connexion automatique par tokens (splash au démarrage) ;
  // mode 'post-connexion' : splash relancé par le bouton Connexion — étapes
  // « connexion » puis « récupération des cartes » ;
  // mode 'debug' : compte GOD sans tokens — saute auth + cartes, garde l'étape
  // saison (et son attente sur le web).
  | { nom: 'chargement'; mode?: 'post-connexion' | 'debug' }
  | { nom: 'connexion' }
  | { nom: 'principal' }
  | { nom: 'usine' }
  | { nom: 'maison' }
  | { nom: 'mairie' }
  | { nom: 'boutique' }
  | { nom: 'arene' }
  | { nom: 'notes' }
  | { nom: 'carte'; carteId: number }
  | { nom: 'ecole' }
  // Messagerie : notifications du joueur, réception des cartes achevées.
  | { nom: 'poste' }
  // Maison d'un ami visitée en lecture seule (cartes chargées en mémoire,
  // jamais enregistrées localement, aucune action de modification).
  | { nom: 'maison-visite'; amiId: number; nickname: string };

type Ecouteur = (fenetre: Fenetre) => void;

// L'entrée dans l'application est TOUJOURS le splash (chargement) : une adresse
// tapée à la main ne peut sélectionner aucune autre fenêtre (exigence produit).
let pile: Fenetre[] = [{ nom: 'chargement' }];

// Verrou de navigation posé par la messagerie tant qu'une carte achevée est
// affichée : ni retour, ni ouverture d'une autre fenêtre avant acceptation/refus.
let bloquerNavigation = false;

export function definirBlocageRetour(bloque: boolean): void {
  bloquerNavigation = bloque;
}

export function estRetourBloque(): boolean {
  return bloquerNavigation;
}

let ecouteur: Ecouteur | null = null;

// Fenêtres dépilées par `retourner` (la plus récente en dernier) — consommées
// par `remonter` (« avant » du navigateur web).
let pileAnnulees: Fenetre[] = [];

export function enregistrerEcouteur(nouvelEcouteur: Ecouteur | null): void {
  ecouteur = nouvelEcouteur;
}

// Fenêtre affichée à l'instant — état initial du composant racine (App).
export function fenetreCourante(): Fenetre {
  return pile[pile.length - 1];
}

function emettre(): void {
  ecouteur?.(fenetreCourante());
}

// Ouvre une fenêtre au-dessus de la courante (bouton retour / `retourner` actif).
export function naviguer(fenetre: Fenetre): void {
  if (bloquerNavigation) return;
  pile = [...pile, fenetre];
  // Une nouvelle navigation invalide la pile « avant » (comme un navigateur).
  pileAnnulees = [];
  emettre();
}

// Change la fenêtre courante sans ajouter d'entrée : la précédente disparaît
// (retour arrière impossible vers elle — flux chargement/connexion/déconnexion).
// `forcer` : sortie de session (api.ts) — doit rester possible même quand la
// messagerie verrouille la navigation.
export function remplacer(fenetre: Fenetre, forcer = false): void {
  if (bloquerNavigation && !forcer) return;
  if (forcer) bloquerNavigation = false;
  pile = [...pile.slice(0, -1), fenetre];
  pileAnnulees = [];
  emettre();
}

// Bouton retour : dépile vers la fenêtre précédente. Renvoie `true` si un
// dépilement a eu lieu (`false` = déjà à la racine ; sur Android le bouton
// système rend alors la main à l'OS qui ferme l'app). La fenêtre retirée est
// gardée en mémoire (pileAnnulees) pour l'équivalent « avant » (remonter,
// utilisé par le glissement d'historique du navigateur web).
export function retourner(): boolean {
  // Verrou : signaler « rien à dépiler » pour que l'historique web ne boucle
  // pas ; App.tsx consomme séparément le bouton système Android.
  if (bloquerNavigation) return false;
  if (pile.length <= 1) return false;
  pileAnnulees = [...pileAnnulees, pile[pile.length - 1]];
  pile = pile.slice(0, -1);
  emettre();
  return true;
}

// « Avant » : repose la dernière fenêtre dépilée par `retourner` (glissement
// avant du navigateur web). Renvoie `false` s'il n'y a rien à remonter.
export function remonter(): boolean {
  if (bloquerNavigation) return false;
  if (pileAnnulees.length === 0) return false;
  pile = [...pile, pileAnnulees[pileAnnulees.length - 1]];
  pileAnnulees = pileAnnulees.slice(0, -1);
  emettre();
  return true;
}

// Profondeur courante de la pile — utilisée par le verrou d'historique web
// (une entrée d'historique navigateur par niveau de pile).
export function longueurPile(): number {
  return pile.length;
}
