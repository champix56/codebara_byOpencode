import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { Platform } from 'react-native';
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  persistReducer,
  persistStore,
} from 'redux-persist';
import reducerUtilisateur from './utilisateur';

// Persistance sur le stockage local (AsyncStorage — localStorage sur web) :
// seul l'utilisateur doit survivre au redémarrage de l'app.
const configPersistance = {
  key: 'racine',
  storage: AsyncStorage,
  whitelist: ['utilisateur'],
};

const reducer = persistReducer(
  configPersistance,
  combineReducers({ utilisateur: reducerUtilisateur }),
);

export const store = configureStore({
  reducer,
  middleware: (defaut) =>
    defaut({
      serializableCheck: {
        // Actions internals de redux-persist : non sérialisables par nature.
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
  // Redux DevTools :
  // - web : activé par défaut par RTK (devTools) → extension navigateur « Redux DevTools » ;
  // - natif en dev : connexion à un moniteur distant (@redux-devtools/cli, port 8000).
  //   Mettre EXPO_PUBLIC_DEVTOOLS_HOST=<IP LAN de la machine> pour un téléphone physique.
  enhancers: (getDefaultEnhancers) => {
    const defaut = getDefaultEnhancers();
    if (__DEV__ && Platform.OS !== 'web') {
      // Hermes n'expose pas la Web Crypto : le global `crypto` n'existe pas, alors
      // qu'uuid (dépendance de @redux-devtools/remote) le lit au premier appel
      // (« Property 'crypto' doesn't exist » sur v4.js). Polyfill minimal via
      // expo-crypto (getRandomValues synchrone), posé AVANT le require du dessous
      // pour que le module uuid s'évalue avec le global déjà en place.
      const globalAvecCrypto = globalThis as {
        crypto?: { getRandomValues?: unknown; randomUUID?: unknown },
      };
      if (typeof globalAvecCrypto.crypto?.getRandomValues !== 'function') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const ExpoCrypto = require('expo-crypto') as typeof import('expo-crypto');
        globalAvecCrypto.crypto = {
          getRandomValues: ExpoCrypto.getRandomValues,
          randomUUID: ExpoCrypto.randomUUID,
        };
      }
      // Chargé uniquement sur ce chemin dév natif : absent des bundles de prod.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { devToolsEnhancer } = require('@redux-devtools/remote') as typeof import('@redux-devtools/remote');
      return defaut.concat(
        devToolsEnhancer({
          name: 'codEbara',
          hostname: process.env.EXPO_PUBLIC_DEVTOOLS_HOST ?? 'localhost',
          port: 8000,
        }),
      );
    }
    return defaut;
  },
});

// Point d'accès pour purger le stockage persistant (déconnexion).
export const persistor = persistStore(store);

export type EtatRacine = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
