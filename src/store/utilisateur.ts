import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// Tranche « utilisateur » : compte courant de la session, alimenté par le
// serveur pyCodebara2 (contrat docs/integration-client.md de pyCodebara2).
// - hash : champ interne serveur (contrôle du profil) — opaque pour l'app ;
// - apiToken : « API_TOKEN » long, ré-émis uniquement à la re-connexion
//   login/pass ;
// - requestToken : « API_REQUEST_TOKEN » une-requête, remplacé à chaque
//   appel protégé réussi (rotation, cf. src/services/api.ts).
// Le mot de passe en clair n'est JAMAIS stocké : le serveur attend
// sha256Hex(mail exact + motDePasseClair) (§3.2 du contrat).
export type Utilisateur = {
  idUser: number | null;
  nickname: string;
  mail: string;
  amount: number | null;
  hash: string | null;
  apiToken: string | null;
  requestToken: string | null;
};

const ETAT_INITIAL: Utilisateur = {
  idUser: null,
  nickname: '',
  mail: '',
  amount: null,
  hash: null,
  apiToken: null,
  requestToken: null,
};

// Compte injecté par le bouton debug de la connexion (bypass authentification) :
// id -9999, pseudo GOD, hash NULL, mail codebara@free.fr, aucun token serveur
// (le compte debug n'a pas de session : les appels protégés resteront inertes).
export const UTILISATEUR_DEBUG: Utilisateur = {
  idUser: -9999,
  nickname: 'GOD',
  mail: 'codebara@free.fr',
  amount: null,
  hash: null,
  apiToken: null,
  requestToken: null,
};

// Sous-ensemble modifiable depuis la fenêtre mairie (formulaire du compte).
export type ProfilPartiel = Partial<Pick<Utilisateur, 'nickname' | 'hash'>>;

const trancheUtilisateur = createSlice({
  name: 'utilisateur',
  initialState: ETAT_INITIAL,
  reducers: {
    // Chargement d'un compte : données serveur + les deux tokens (login/pass ou
    // création), ou données fraîches + tokens conservés (reprise de session).
    seConnecter: (etat, action: PayloadAction<Utilisateur>) => ({
      ...etat,
      ...action.payload,
    }),
    // Rotation des tokens : chaque appel protégé réussi renvoie un nouveau
    // « API_REQUEST_TOKEN » (§3.3 du contrat) ; API_TOKEN est conservé.
    renouvelerRequestToken: (etat, action: PayloadAction<string>) => ({
      ...etat,
      requestToken: action.payload,
    }),
    // Modification locale du profil (nickname et/ou hash) — fenêtre mairie :
    // PUT /user n'existe pas encore côté serveur (contrat §9.3).
    // Payload partiel : les champs absents conservent leur valeur.
    modifierProfil: (etat, action: PayloadAction<ProfilPartiel>) => ({
      ...etat,
      ...action.payload,
    }),
    // Retour à l'état initial (aussi appelé par le bouton de déconnexion).
    seDeconnecter: () => ETAT_INITIAL,
  },
});

export const { seConnecter, renouvelerRequestToken, modifierProfil, seDeconnecter } =
  trancheUtilisateur.actions;
export default trancheUtilisateur.reducer;
