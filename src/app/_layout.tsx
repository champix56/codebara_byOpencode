import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { router, Stack } from 'expo-router';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { figerHistorique, razHistoriqueVersRacine, urlInitialeHorsRacine } from '../utils/figerUrl';
import { persistor, store } from '../store/store';

// Web — exigence produit « l'URL du navigateur reste toujours la racine et la
// construction des fenêtres repart du splash » (src/utils/figerUrl.ts) : le
// gel de l'API History est installé au niveau module, c'est-à-dire au
// chargement du bundle par expo-router/entry, AVANT toute écriture
// d'historique du router — l'adresse ne peut jamais afficher une route.
if (Platform.OS === 'web') figerHistorique();

// Layout racine : store Redux + réhydratation de la persistance, puis le Stack
// de navigation. Les barres de navigation (en-têtes natifs) sont activées par
// écran : cachées sur le splash et la connexion (cf. options Stack.Screen).
export default function RootLayout() {
  // Web — lien profond tapé à la main (…/maison, …/carte/4…) : l'hydratation
  // du router affiche d'abord la fenêtre du chemin. Dès le montage, l'entrée
  // d'historique est remise à la racine et le router est repositionné sur
  // l'écran de chargement : le flux complet repart du splash. Le ref garantit
  // un seul ramène (débogage : les effets sont exécutés deux fois).
  const ramene = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || ramene.current) return;
    ramene.current = true;
    if (urlInitialeHorsRacine()) {
      razHistoriqueVersRacine();
      router.replace('/');
    }
  }, []);
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <Stack screenOptions={{ headerShown: false }} />
      </PersistGate>
    </Provider>
  );
}
