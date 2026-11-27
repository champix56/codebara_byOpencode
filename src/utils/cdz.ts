import JSZip from 'jszip';
import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decoderBase64, encoderBase64 } from './base64';

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
  // Saison : `seasonid` = univers (entier, absent des archives actuelles) ;
  // `saison` = nom lisible si le serveur l'écrit dans datas.json — parsing
  // opportuniste (clés tolérées : « season », « seasonName », « seasonname »),
  // le client doit accepter les champs additionnels futurs (contrat §6.4).
  saison: string | null;
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
    saison:
      texteOuNull(source, 'season') ??
      texteOuNull(source, 'seasonName') ??
      texteOuNull(source, 'seasonname'),
    specials: specials.map((special) => ({
      name: texteOuNull(special, 'name'),
      attack: nombreOuNull(special, 'attack'),
      health: nombreOuNull(special, 'health'),
      turn: nombreOuNull(special, 'turn'),
    })),
  };
}

// deck.json — positions des textes incrustés sur la carte (exigence produit
// 2026-11-16). Le repère est celui de front.png (deck.json porte `width` /
// `height`, 600×1037 dans les archives actuelles) ; parsing tolérant (§6.4) :
// deck.json peut manquer (archives futures/anciennes) et toute position aussi.
export type PositionTexte = {
  x: number;
  y: number;
  /** Taille de police dans le repère deck (`height`). */
  taille: number;
  /** Couleur principale d'écriture (`color`, ex. #0F0FAB ou #RRGGBBAA). */
  couleur: string | null;
};

export type DeckCarte = {
  /** Largeur du repère deck (= largeur de front.png). */
  repere: number;
  /** Hauteur du repère deck (= hauteur de front.png). */
  hauteurRepere: number;
  /** Position du nom (`positions.name`) — null si absente. */
  nom: PositionTexte | null;
};

function lireDeck(json: unknown): DeckCarte | null {
  const source = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : null;
  if (!source) return null;
  const positions =
    typeof source.positions === 'object' && source.positions !== null
      ? (source.positions as Record<string, unknown>)
      : null;
  const name =
    positions && typeof positions.name === 'object' && positions.name !== null
      ? (positions.name as Record<string, unknown>)
      : null;
  return {
    repere: nombreOuNull(source, 'width') ?? 600,
    hauteurRepere: nombreOuNull(source, 'height') ?? 1037,
    nom:
      name && typeof name.x === 'number' && typeof name.y === 'number' && typeof name.height === 'number'
        ? {
            x: name.x,
            y: name.y,
            taille: name.height,
            couleur: typeof name.color === 'string' ? name.color : null,
          }
        : null,
  };
}

// Une carte extraite : les trois PNG consommés par l'app + les données métier.
export type Cdz = {
  front: Uint8Array;
  back: Uint8Array;
  perso: Uint8Array;
  datas: DonneesCarte;
  deck: DeckCarte | null;
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

  const [front, back, perso, octetsDatas, texteDatas, texteDeck, texteHashs] = await Promise.all([
    lireBinaire('front.png'),
    lireBinaire('back.png'),
    lireBinaire('perso.png'),
    lireBinaire('datas.json'),
    lireTexte('datas.json'),
    lireTexte('deck.json'),
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

  let deck: DeckCarte | null = null;
  if (texteDeck !== null) {
    try {
      deck = lireDeck(JSON.parse(texteDeck));
    } catch {
      // deck.json illisible : toléré (§6.4) — la carte s'affiche sans incrustation.
    }
  }

  return { front, back, perso, datas: donnees, deck };
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
export type ApercuCarte = { front: Uint8Array; datas: DonneesCarte; deck: DeckCarte | null };

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
  const [front, texteDatas, texteDeck] = await Promise.all([
    entreeFront.async('uint8array'),
    entreeDatas.async('string'),
    (async () => {
      const entreeDeck = zip.file('deck.json');
      return entreeDeck ? entreeDeck.async('string') : null;
    })(),
  ]);
  let donnees: DonneesCarte;
  try {
    donnees = lireDatas(JSON.parse(texteDatas));
  } catch {
    throw new ErreurCdz('datas.json illisible dans l\'archive .cdz');
  }
  let deck: DeckCarte | null = null;
  if (texteDeck !== null) {
    try {
      deck = lireDeck(JSON.parse(texteDeck));
    } catch {
      // Toléré (§6.4) — aperçu sans incrustation.
    }
  }
  return { front, datas: donnees, deck };
}

// ─── Aperçu léger à 20 % (listes de la maison) ───────────────────────────────

// Décision produit (v0.0.22) : l'aperçu mis en cache est 20 % de la dimension
// d'origine du front.png (480×830 → 96×166), sur le client COMME sur le
// serveur. Le .cdz complet reste réservé à la vue détaillée.
export const TAUX_APERCU = 0.2;

// Dimensions lues dans l'en-tête IHDR d'un PNG (octets 16 à 23, big-endian).
export function dimensionsPng(octets: Uint8Array): { largeur: number; hauteur: number } | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (octets.length < 24 || signature.some((octet, index) => octets[index] !== octet)) {
    return null;
  }
  const largeur =
    (octets[16] << 24) | (octets[17] << 16) | (octets[18] << 8) | octets[19];
  const hauteur =
    (octets[20] << 24) | (octets[21] << 16) | (octets[22] << 8) | octets[23];
  return largeur > 0 && hauteur > 0 ? { largeur, hauteur } : null;
}

// Redimensionne un front.png extrait d'un .cdz sans toucher à l'archive ni à
// ses hashs.json (vérifiés seulement au détail). Le PNG réduit est réencodé,
// avec transparence préservée.
export async function reduireApercu(front: Uint8Array): Promise<Uint8Array> {
  const dimensions = dimensionsPng(front);
  if (!dimensions) throw new ErreurCdz('front.png illisible dans l’archive .cdz');
  const cible = {
    width: Math.max(1, Math.round(dimensions.largeur * TAUX_APERCU)),
    height: Math.max(1, Math.round(dimensions.hauteur * TAUX_APERCU)),
  };
  const source = `data:image/png;base64,${encoderBase64(front)}`;
  const rendu = await ImageManipulator.manipulate(source).resize(cible).renderAsync();
  const resultat = await rendu.saveAsync({ format: SaveFormat.PNG, base64: true });
  if (!resultat.base64) throw new ErreurCdz('Réduction de l’aperçu impossible');
  return decoderBase64(resultat.base64);
}
