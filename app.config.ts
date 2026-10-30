// Configuration dynamique du projet. Expo lit d'abord app.json puis transmet le
// résultat normalisé ici (paramètre `config`) : ce fichier le complète, sans duplication.
// Documentation : https://docs.expo.dev/workflow/configuration.md (dynamic configuration).
import { ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext) => {
  // Variable « bare » DEBUG=true (ex : `DEBUG=true npx expo start`, ou DEBUG=true
  // dans .env que la CLI Expo charge dans le process). Si elle vaut exactement
  // « true », le bouton debug de la fenêtre de connexion apparaît.
  const debug = process.env.DEBUG === 'true';
  // Miroir pour le code client : EXPO_PUBLIC_DEBUG est inlinée dans tous les bundles
  // JS. (Sur web, Constants.expoConfig n'est pas injecté de façon fiable en dev :
  // cf. explication dans docs/screens/connexion.md.)
  process.env.EXPO_PUBLIC_DEBUG = debug ? 'true' : 'false';
  return {
    ...config,
    extra: { ...config.extra, debug },
  };
};
