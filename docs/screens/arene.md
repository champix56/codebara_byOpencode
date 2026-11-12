# Fenêtre arène

Fenêtre : `arene` — `App.tsx` monte `components/fenetre-vierge.tsx` avec l'en-tête maison.

## Rôle

Fenêtre « vierge » en attente de son contenu réel (branchement serveur à venir).

## Structure visuelle

- Plein écran blanc, sans contenu.
- Barre d'en-tête maison (`src/components/entete-ecran.tsx`) : titre « Arène » + bouton de retour.

## États

- Statique : aucune donnée, aucun état serveur pour l'instant.

## Navigation

- Entrée : tap la zone arène sur la carte (fenêtre principale) ou le menu latéral.
- Sortie : bouton retour de la barre d'en-tête → `retourner()` (dépile vers la fenêtre principale). En natif, le bouton système s'ajoute.
