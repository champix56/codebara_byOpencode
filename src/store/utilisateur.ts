import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// Tranche « utilisateur » : compte courant de la session.
// hash : empreinte du mot de passe renvoyée par le serveur (jamais saisie en clair) ;
// token : jeton de session (nombre factice en debug, chaîne à venir côté serveur).
export type Utilisateur = {
  idUser: number | null;
  nickname: string;
  hash: string | null;
  token: number | string | null;
  mail: string;
};

// Sous-ensemble modifiable depuis la fenêtre maison (formulaire du compte).
export type ProfilPartiel = Partial<Pick<Utilisateur, 'nickname' | 'hash'>>;

const ETAT_INITIAL: Utilisateur = {
  idUser: null,
  nickname: '',
  hash: null,
  token: null,
  mail: '',
};

// Compte injecté par le bouton debug de la connexion (bypass authentification) :
// id -9999, pseudo GOD, hash NULL, token -1, mail codebara@free.fr.
export const UTILISATEUR_DEBUG: Utilisateur = {
  idUser: -9999,
  nickname: 'GOD',
  hash: null,
  token: -1,
  mail: 'codebara@free.fr',
};

const trancheUtilisateur = createSlice({
  name: 'utilisateur',
  initialState: ETAT_INITIAL,
  reducers: {
    // Chargement d'un compte (serveur à venir, ou compte debug).
    seConnecter: (etat, action: PayloadAction<Utilisateur>) => ({
      ...etat,
      ...action.payload,
    }),
    // Modification locale du profil (nickname et/ou hash) — fenêtre maison.
    // Payload partiel : les champs absents conservent leur valeur.
    modifierProfil: (etat, action: PayloadAction<ProfilPartiel>) => ({
      ...etat,
      ...action.payload,
    }),
    // Retour à l'état initial (aussi appelé par le bouton de déconnexion).
    seDeconnecter: () => ETAT_INITIAL,
  },
});

export const { seConnecter, seDeconnecter, modifierProfil } = trancheUtilisateur.actions;
export default trancheUtilisateur.reducer;
