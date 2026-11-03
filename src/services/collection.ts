import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

// Cache collection d'un utilisateur (contrat §6.6) : les archives .cdz de
// ses cartes, stockées LOCALEMENT :
//  - natif : <documentDirectory>/<idUser>/<carteId>.cdz — le répertoire
//    documents de l'app est privatisé par le sandbox OS : accessible
//    uniquement par l'application (exigence produit) ;
//  - web : IndexedDB custom (expo-file-system est natif-only, cf. son module
//    web : « not supported on web ») — base `codebara-cdz`, origin-privée.
//
// Index léger (id → nom) à côté des archives : la liste GET /card (§5.4) ne
// porte PAS le nom des cartes, il vit dans datas.json du .cdz — lire chaque
// archive zippée pour l'affichage de la liste serait trop lourd.

export type EntreeIndex = { nom: string };

export async function lireIndex(idUser: number): Promise<Record<string, EntreeIndex>> {
  if (Platform.OS === 'web') {
    const memo = await lireIndexWeb(idUser);
    return memo ?? {};
  }
  const fichier = fichierIndexNatif(idUser);
  if (!fichier.exists) return {};
  try {
    const brut = JSON.parse(fichier.textSync()) as Record<string, EntreeIndex>;
    return typeof brut === 'object' && brut !== null ? brut : {};
  } catch {
    return {};
  }
}

// Fusionne (ou met à jour) une entrée du nom d'une carte — appelée après un
// renommage §5.7 réussi, ou quand datas.json révèle un nom au détail.
export async function majIndex(
  idUser: number,
  carteId: number,
  nom: string,
): Promise<void> {
  const entier = { [String(carteId)]: { nom } };
  const actuel = await lireIndex(idUser);
  const fusion = { ...actuel, ...entier };
  if (Platform.OS === 'web') {
    await ecrireIndexWeb(idUser, fusion);
    return;
  }
  fichierIndexNatif(idUser).writeSync(JSON.stringify(fusion));
}

// Écrit (ou remplace) l'archive anonymisée d'une carte : <idUser>/<carteId>.cdz.
export async function enregistrerCarte(
  idUser: number,
  carteId: number,
  octets: Uint8Array,
): Promise<void> {
  if (Platform.OS === 'web') {
    await enregistrerCarteWeb(idUser, carteId, octets);
    return;
  }
  const dossier = new Directory(Paths.document, String(idUser));
  dossier.create({ idempotent: true });
  await new File(dossier, `${carteId}.cdz`).write(octets);
}

// Lit l'archive locale d'une carte — null si absente (le détail la
// re-téléchargera alors via GET /card/{id}, §5.5).
export async function lireCarteLocale(
  idUser: number,
  carteId: number,
): Promise<Uint8Array | null> {
  if (Platform.OS === 'web') {
    return lireCarteWeb(idUser, carteId);
  }
  const fichier = new File(Paths.document, String(idUser), `${carteId}.cdz`);
  return fichier.exists ? fichier.bytes() : null;
}

// ─── Natif (expo-file-system API nouvelle) ──────────────────────────────────

function fichierIndexNatif(idUser: number): File {
  return new File(Paths.document, String(idUser), 'index.json');
}

// ─── Web : IndexedDB custom (aucune dépendance) ─────────────────────────────

const NOM_BDD = 'codebara-cdz';
const VERSION_BDD = 1;
const PLACES = ['cartes', 'index'] as const;

let baseConnexion: IDBDatabase | null = null;

// OUVERT de la base (IndexedDB de l'origine — données privées au navigateur).
function ouvrirBase(): Promise<IDBDatabase> {
  if (baseConnexion) return Promise.resolve(baseConnexion);
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB indisponible sur ce navigateur'));
  }
  return new Promise((filtre, remettre) => {
    const demande = indexedDB.open(NOM_BDD, VERSION_BDD);
    demande.onupgradeneeded = () => {
      for (const place of PLACES) {
        if (!demande.result.objectStoreNames.contains(place)) {
          demande.result.createObjectStore(place);
        }
      }
    };
    demande.onsuccess = () => {
      baseConnexion = demande.result;
      filtre(demande.result);
    };
    demande.onerror = () => remettre(new Error('IndexedDB ouverture impossible'));
  });
}

function operationPlace(placeName: string, cle: string, valeur?: unknown): Promise<unknown> {
  return ouvrirBase().then(
    (base) =>
      new Promise((filtre, remettre) => {
        const transaction = base.transaction(placeName, valeur === undefined ? 'readonly' : 'readwrite');
        const place = transaction.objectStore(placeName);
        const demande = valeur === undefined ? place.get(cle) : place.put(valeur, cle);
        demande.onsuccess = () => filtre(demande.result);
        demande.onerror = () => remettre(new Error(`IndexedDB ${placeName} échec`));
      }),
  );
}

function cleCarte(idUser: number, carteId: number): string {
  return `u${idUser}/${carteId}`;
}

async function lireIndexWeb(idUser: number): Promise<Record<string, EntreeIndex> | null> {
  try {
    const valeur = (await operationPlace('index', `u${idUser}`)) as Record<string, EntreeIndex> | undefined;
    return valeur && typeof valeur === 'object' ? valeur : null;
  } catch {
    return null; // dégradation : index vide, archives toujours lisibles
  }
}

async function ecrireIndexWeb(
  idUser: number,
  valeur: Record<string, EntreeIndex>,
): Promise<void> {
  await operationPlace('index', `u${idUser}`, valeur);
}

async function enregistrerCarteWeb(
  idUser: number,
  carteId: number,
  octets: Uint8Array,
): Promise<void> {
  await operationPlace('cartes', cleCarte(idUser, carteId), octets);
}

async function lireCarteWeb(idUser: number, carteId: number): Promise<Uint8Array | null> {
  try {
    const valeur = await operationPlace('cartes', cleCarte(idUser, carteId));
    if (valeur instanceof ArrayBuffer) return new Uint8Array(valeur);
    if (valeur instanceof Uint8Array) return new Uint8Array(valeur);
    return null;
  } catch {
    return null;
  }
}
