# Fenêtre boutique

## Rôle

Route `/boutique` : fenêtre « vierge » en attente de son contenu réel (branchement serveur à venir).

## Structure visuelle

- Plein écran blanc, sans contenu.
- Barre de navigation native (expo-router) : titre « Boutique » + bouton de retour natif (web compris).

## États

- Statique : aucune donnée, aucun état serveur pour l'instant.

## Navigation

- Entrée : tap la zone boutique sur la carte (fenêtre principale).
- Sortie : bouton retour de la barre de navigation native → `router.back()`. En natif, le geste système s'ajoute.
