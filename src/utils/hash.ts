import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

// Empreinte d'un mot de passe (SHA-256) : placeholder strictement local en
// attendant le serveur, qui prendra en charge le changement de mot de passe et
// renverra son propre hash lors de la connexion.
export async function calculerEmpreinte(motDePasse: string): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, motDePasse);
}
