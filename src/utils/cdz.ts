import JSZip from 'jszip';
import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import { decoderBase64 } from './base64';

// Pipeline « .cdz » du contrat pyCodebara2 (§5.3, §6.2, §6.3) :
//  - archive .cdz = ZIP (compression DEFLATED) servie en base64 par le serveur ;
//  - 6 fichiers dedans : front.png, back.png, perso.png, datas.json,
//    deck.json (non consommé ici) et hashs.json ;
//  - contrôle global : sha256(archive) == checksum == cardHash (§6.3) ;
//  - contrôles internes : hashs.json = {front, back, perso, datas} (64 hex).
//
// Décision produit (2026-11-03) : ZIP uniquement — le bug serveur tar.xz du
// renommage (§5.7) n'est PAS géré : une archive non-ZIP est refusée avec un
// message clair (aucun décompresseur tar/xz embarqué).

export class ErreurCdz extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurCdz';
  }
}

// Signature littérale d'une archive ZIP : « PK\x03\x04 » (en-tête du premier
// fichier) — produite par tous les zip writers conformes.
const SIGNATURE_ZIP = [0x50, 0x4b, 0x03, 0x04];

export function estZipValide(octets: Uint8Array): boolean {
  return (
    octets.length >= 4 &&
    octets[0] === SIGNATURE_ZIP[0] &&
    octets[1] === SIGNATURE_ZIP[1] &&
    octets[2] === SIGNATURE_ZIP[2] &&
    octets[3] === SIGNATURE_ZIP[3]
  );
}

// sha256 d'octets bruts (expo-crypto.digest prend un BufferSource) — retourne
// l'hexadécimal minuscule, comparable aux checksums/cardHash du contrat.
export async function hacherOctets(octets: Uint8Array): Promise<string> {
  // Cast interne : les types TS 6 lib génériques (`Uint8Array<ArrayBufferLike>`)
  // refusent la vue pour BufferSource, alors que l'implémentation native lit
  // bien la vue complète (offsets inclus) — aucun risque au runtime.
  const empreinte = await digest(CryptoDigestAlgorithm.SHA256, octets as unknown as BufferSource);
  return Array.from(new Uint8Array(empreinte), (octet) =>
    octet.toString(16).padStart(2, '0'),
  ).join('');
}

// datas.json — parsing tolérant (§6.4 : « aucun cast strict ») : tout champ
// peut manquer, prendre un autre type ou attendre des clés futures.
export type DonneesCarte = {
  id: number | null;
  creatorid: number | null;
  ownerid: number | null;
  seasonid: number | null;
  name: string | null;
  attack: number | null;
  health: number | null;
  rarity: number | null;
  power: number | null;
  specials: { name: string | null; attack: number | null; health: number | null; turn: number | null }[];
};

function nombreOuNull(source: Record<string, unknown>, cle: string): number | null {
  return typeof source[cle] === 'number' ? (source[cle] as number) : null;
}

function texteOuNull(source: Record<string, unknown>, cle: string): string | null {
  return typeof source[cle] === 'string' ? (source[cle] as string) : null;
}

function lireDatas(json: unknown): DonneesCarte {
  const source = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
  const specials = Array.isArray(source.specials)
    ? source.specials.filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    : [];
  return {
    id: nombreOuNull(source, 'id'),
    creatorid: nombreOuNull(source, 'creatorid'),
    ownerid: nombreOuNull(source, 'ownerid'),
    seasonid: nombreOuNull(source, 'seasonid'),
    name: texteOuNull(source, 'name'),
    attack: nombreOuNull(source, 'attack'),
    health: nombreOuNull(source, 'health'),
    rarity: nombreOuNull(source, 'rarity'),
    power: nombreOuNull(source, 'power'),
    specials: specials.map((special) => ({
      name: texteOuNull(special, 'name'),
      attack: nombreOuNull(special, 'attack'),
      health: nombreOuNull(special, 'health'),
      turn: nombreOuNull(special, 'turn'),
    })),
  };
}

// Une carte extraite : les trois PNG consommés par l'app + les données métier.
export type Cdz = {
  front: Uint8Array;
  back: Uint8Array;
  perso: Uint8Array;
  datas: DonneesCarte;
};

// Extrait et vérifie une archive .cdz complète :
//  - signature ZIP (garde-fou anti tar.xz — refus explicite, cf. §5.7) ;
//  - sha256(archive) == checksum attendu (facultatif : absent de la réponse du
//    renommage §5.7) ;
//  - hashs.json interne (front / back / perso / datas) si présent.
export async function ouvrirCdz(octets: Uint8Array, checksumAttendu?: string): Promise<Cdz> {
  if (!estZipValide(octets)) {
    throw new ErreurCdz('Archive .cdz invalide : ZIP attendu (réponse serveur non conforme)');
  }
  if (checksumAttendu) {
    const empreinte = await hacherOctets(octets);
    if (empreinte !== checksumAttendu.toLowerCase()) {
      throw new ErreurCdz('Archive corrompue au transport (sha256 ≠ checksum serveur)');
    }
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(octets);
  } catch {
    throw new ErreurCdz('Archive .cdz illisible (ZIP non décompressable)');
  }

  // async('uint8array') pour les binaires ; async('string') lit le texte en
  // UTF-8 (TextDecoder absent d'Hermes).
  const lireBinaire = async (nom: string): Promise<Uint8Array | null> => {
    const entree = zip.file(nom);
    return entree ? entree.async('uint8array') : null;
  };
  const lireTexte = async (nom: string): Promise<string | null> => {
    const entree = zip.file(nom);
    return entree ? entree.async('string') : null;
  };

  const [front, back, perso, octetsDatas, texteDatas, texteHashs] = await Promise.all([
    lireBinaire('front.png'),
    lireBinaire('back.png'),
    lireBinaire('perso.png'),
    lireBinaire('datas.json'),
    lireTexte('datas.json'),
    lireTexte('hashs.json'),
  ]);

  if (!front || !back || !perso || texteDatas === null) {
    throw new ErreurCdz('Archive .cdz incomplète (front/back/perso/datas.json attendus)');
  }
  let donnees: DonneesCarte;
  try {
    donnees = lireDatas(JSON.parse(texteDatas));
  } catch {
    throw new ErreurCdz('datas.json illisible dans l\'archive .cdz');
  }

  // Contrôles internes (§6.3) — après tout téléchargement. hashs.json peut
  // manquer (toléré) ; un écart = fichier corrompu → re-télécharger la carte.
  if (texteHashs !== null) {
    let attendus: Record<string, unknown>;
    try {
      attendus = JSON.parse(texteHashs) as Record<string, unknown>;
    } catch {
      throw new ErreurCdz('hashs.json illisible dans l\'archive .cdz');
    }
    const morceaux: [string, Uint8Array][] = [
      ['front', front],
      ['back', back],
      ['perso', perso],
      ['datas', octetsDatas ?? new Uint8Array()],
    ];
    for (const [cle, morceau] of morceaux) {
      const attendu = typeof attendus[cle] === 'string' ? (attendus[cle] as string).toLowerCase() : null;
      if (!attendu) continue;
      const possede = await hacherOctets(morceau);
      if (possede !== attendu) {
        throw new ErreurCdz(`Fichier ${cle} corrompu (hash interne en écart) — re-télécharger la carte`);
      }
    }
  }

  return { front, back, perso, datas: donnees };
}

// Décode le base64 d'un .cdz servi dans un corps JSON {"card": "..."} (§5.3/§5.5).
export function cdzDepuisBase64(base64: string): Uint8Array {
  return decoderBase64(base64);
}

// ─── Aperçu léger (grille de la maison) ─────────────────────────────────────

// Un aperçu de carte : image front + données métier, extraits SANS les
// contrôles d'intégrité §6.3 (sha256 archive + hashs.json) — réservés à la
// fenêtre détail : l'affichage de la liste ne doit pas payer ce coût pour
// chaque carte de la collection.
export type ApercuCarte = { front: Uint8Array; datas: DonneesCarte };

export async function extraireApercu(octets: Uint8Array): Promise<ApercuCarte> {
  if (!estZipValide(octets)) {
    throw new ErreurCdz('Archive .cdz invalide : ZIP attendu');
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(octets);
  } catch {
    throw new ErreurCdz('Archive .cdz illisible (ZIP non décompressable)');
  }
  const entreeFront = zip.file('front.png');
  const entreeDatas = zip.file('datas.json');
  if (!entreeFront || !entreeDatas) {
    throw new ErreurCdz('Archive .cdz incomplète (front.png/datas.json attendus)');
  }
  const [front, texteDatas] = await Promise.all([
    entreeFront.async('uint8array'),
    entreeDatas.async('string'),
  ]);
  let donnees: DonneesCarte;
  try {
    donnees = lireDatas(JSON.parse(texteDatas));
  } catch {
    throw new ErreurCdz('datas.json illisible dans l\'archive .cdz');
  }
  return { front, datas: donnees };
}
