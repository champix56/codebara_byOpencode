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
  // « connexion » puis « récupération des cartes ».
  | { nom: 'chargement'; mode?: 'post-connexion' }
  | { nom: 'connexion' }
  | { nom: 'principal' }
  | { nom: 'usine' }
  | { nom: 'maison' }
  | { nom: 'mairie' }
  | { nom: 'boutique' }
  | { nom: 'arene' }
  | { nom: 'carte'; carteId: number };

type Ecouteur = (fenetre: Fenetre) => void;

// L'entrée dans l'application est TOUJOURS le splash (chargement) : une adresse
// tapée à la main ne peut sélectionner aucune autre fenêtre (exigence produit).
let pile: Fenetre[] = [{ nom: 'chargement' }];

let ecouteur: Ecouteur | null = null;

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
  pile = [...pile, fenetre];
  emettre();
}

// Change la fenêtre courante sans ajouter d'entrée : la précédente disparaît
// (retour arrière impossible vers elle — flux chargement/connexion/déconnexion).
export function remplacer(fenetre: Fenetre): void {
  pile = [...pile.slice(0, -1), fenetre];
  emettre();
}

// Bouton retour : dépile vers la fenêtre précédente. Renvoie `true` si un
// dépilement a eu lieu (`false` = déjà à la racine ; sur Android le bouton
// système rend alors la main à l'OS qui ferme l'app).
export function retourner(): boolean {
  if (pile.length <= 1) return false;
  pile = pile.slice(0, -1);
  emettre();
  return true;
}
