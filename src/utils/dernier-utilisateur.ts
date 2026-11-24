import AsyncStorage from '@react-native-async-storage/async-storage';

// Dernier identifiant connecté — stockage DÉDIÉ, hors tranche Redux persistée.
// `persistor.purge()` (déconnexion, mot de passe changé…) vide la clé `racine`
// de redux-persist : ce « souvenir » doit survivre pour que le service de
// notifications puisse interroger `GET /notifications` avec `iduser` seul,
// même quand la session est morte ou que l'utilisateur s'est déconnecté.
const CLE_DERNIER_ID = '@codebara/dernier-iduser';

export async function enregistrerDernierIdUser(idUser: number): Promise<void> {
  try {
    await AsyncStorage.setItem(CLE_DERNIER_ID, String(idUser));
  } catch {
    // Stockage indisponible : la notification système reste facultative.
  }
}

export async function lireDernierIdUser(): Promise<number | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_DERNIER_ID);
    if (brut === null) return null;
    const id = Number(brut);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}
