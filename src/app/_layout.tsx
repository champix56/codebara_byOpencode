import { Stack } from 'expo-router';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { persistor, store } from '../store/store';

// Layout racine : store Redux + réhydratation de la persistance, puis le Stack
// de navigation. Les barres de navigation (en-têtes natifs) sont activées par
// écran : cachées sur le splash et la connexion (cf. options Stack.Screen).
export default function RootLayout() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <Stack screenOptions={{ headerShown: false }} />
      </PersistGate>
    </Provider>
  );
}
