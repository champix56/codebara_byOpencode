// Base64 pur JS (Hermes + web) : évite les globals atob/btoa absents d'Hermes.
// Table d'encodage inversée construite au chargement du module.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const INVERSE = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let index = 0; index < ALPHABET.length; index += 1) {
    table[ALPHABET.charCodeAt(index)] = index;
  }
  return table;
})();

// Décode une chaîne base64 (padding = toléré, espaces/tirets ignorés ?) — ici les
// réponses serveur sont propres : seuls le padding et les retours à la ligne sont
// éventuellement présents. Décoré retourne exactement les octets d'origine.
export function decoderBase64(texte: string): Uint8Array {
  const serie = texte.replace(/[\r\n\s]/g, '');
  let longueur = serie.length;
  while (longueur > 0 && serie[longueur - 1] === '=') longueur -= 1;
  const surplus = longueur % 4;
  // Reste possible après nettoyage du padding : 0, 2 ou 3 caractères —
  // 1 seul caractère final est illégal (impossible à décoder).
  if (surplus === 1) throw new Error('Base64 invalide (longueur)');
  const tailles = Math.floor(longueur / 4) * 3 + (surplus === 0 ? 0 : surplus - 1);
  const octets = new Uint8Array(tailles);
  let position = 0;
  let debut = 0;
  while (debut < longueur) {
    const dispo = Math.min(4, longueur - debut);
    let triplets = 0;
    for (let index = 0; index < dispo; index += 1) {
      const valeur = INVERSE[serie.charCodeAt(debut + index)];
      if (valeur < 0) throw new Error('Base64 invalide (caractère)');
      triplets |= valeur << (18 - index * 6);
    }
    octets[position] = (triplets >> 16) & 0xff;
    position += 1;
    if (dispo >= 2) {
      octets[position] = (triplets >> 8) & 0xff;
      position += 1;
    }
    if (dispo >= 3) {
      octets[position] = triplets & 0xff;
      position += 1;
    }
    debut += dispo;
  }
  return octets;
}

// Encode des octets en base64 (padding '=' pour les longueurs non multiples de 3).
export function encoderBase64(octets: Uint8Array): string {
  let sortie = '';
  for (let debut = 0; debut < octets.length; debut += 3) {
    const reste = octets.length - debut;
    const a = octets[debut];
    const b = reste > 1 ? octets[debut + 1] : 0;
    const c = reste > 2 ? octets[debut + 2] : 0;
    sortie += ALPHABET[a >> 2];
    sortie += ALPHABET[((a & 0x03) << 4) | (b >> 4)];
    if (reste > 1) sortie += ALPHABET[((b & 0x0f) << 2) | (c >> 6)];
    else sortie += '=';
    if (reste > 2) sortie += ALPHABET[c & 0x3f];
    else sortie += '=';
  }
  return sortie;
}
