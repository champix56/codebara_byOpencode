import { Asset } from 'expo-asset';

// Avatars fournis avec l'application (assets/avatars/*.png). Ils sont
// redimensionnés puis envoyés au serveur comme une photo : aucun chemin
// d'asset n'est jamais envoyé, seul le PNG final 150×150 circule.
export type AvatarIntegre = {
  id: string;
  titre: string;
  module: number;
};

export const AVATARS_INTEGRES: AvatarIntegre[] = [
  { id: 'coin', titre: 'Pièce', module: require('../../assets/avatars/av-coin.png') },
  { id: 'egg', titre: 'Œuf', module: require('../../assets/avatars/av-egg.png') },
  { id: 'energie', titre: 'Énergie', module: require('../../assets/avatars/av-energie.png') },
  { id: 'hibou', titre: 'Hibou', module: require('../../assets/avatars/av-hibou.png') },
  { id: 'monde', titre: 'Monde', module: require('../../assets/avatars/av-monde.png') },
  { id: 'robot', titre: 'Robot', module: require('../../assets/avatars/av-robot.png') },
];

// URI locale exploitable par react-native-svg (et par le canvas web).
export async function uriAvatarIntegre(module: number): Promise<string> {
  const asset = Asset.fromModule(module);
  if (!asset.downloaded) await asset.downloadAsync();
  return asset.localUri ?? asset.uri;
}
