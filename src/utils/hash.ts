import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

// §3.2 du contrat : le serveur compare le champ reçu au hash stocké à la
// création (SHA2(mail + motDePasseClair, 256)). Le client doit donc envoyer
// exactement SHA256(UTF-8(mail_exact) + UTF-8(motDePasseClair)) en hex
// minuscule — concaténation sans séparateur, casse du mail incluse.
export async function hacherMotDePasse(mailExact: string, motDePasseClair: string): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, mailExact + motDePasseClair);
}
