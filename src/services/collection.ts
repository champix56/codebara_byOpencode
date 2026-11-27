import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { encoderBase64 } from '../utils/base64';
import {
  extraireApercu,
  reduireApercu,
  type DeckCarte,
  type DonneesCarte,
} from '../utils/cdz';

// Cache collection d'un utilisateur (contrat §6.6) : les archives .cdz de
// ses cartes, stockées LOCALEMENT :
//  - natif : <documentDirectory>/<idUser>/<carteId>.cdz — le répertoire
//    documents de l'app est privatisé par le sandbox OS : accessible
//    uniquement par l'application (exigence produit) ;
//  - web : IndexedDB custom (expo-file-system est natif-only, cf. son module
//    web : « not supported on web ») — base `codebara-cdz`, origin-privée.
//
// Index léger (id → nom + saison) à côté des archives : la liste GET /card
// (§5.4) ne porte PAS le nom des cartes, il vit dans datas.json du .cdz — lire
// chaque archive zippée pour l'affichage de la liste serait trop lourd. La
// saison (id + nom opportun, cf. cdz.ts) y est aussi portée : la maison
// construit sa liste locale de saisons disponible pour l'utilisateur à partir
// de cet index (mis à jour à chaque génération / renommage / détail chargé).
//
// Depuis v0.0.22, chaque carte reçoit aussi un aperçu `previews/<carteId>.json`
// (front.png réduit à 20 % + datas/deck) : la maison lit cet aperçu au lieu
// de décompresser l'archive complète, et le supprime avec la carte.

export type EntreeIndex = {
  nom: string;
  /** Identifiant d'univers (datas.seasonid), null si l'archive n'en porte pas. */
  saisonId?: number | null;
  /** Nom de saison lu dans datas.json (clé opportuniste), null si absent. */
  saison?: string | null;
};

// Aperçu léger stocké à côté de l'archive : front.png réduit à 20 % en data
// URI + données métier (nom, saison, valeurs) et positions des incrustations.
// La grille de la maison le lit sans jamais dézipper le .cdz complet.
export type ApercuLocal = {
  image: string;
  datas: DonneesCarte;
  deck: DeckCarte | null;
};

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

// Fusionne (ou met à jour) une entrée d'une carte — appelée après un
// renommage §5.7 réussi, une génération (§6.1), ou quand datas.json révèle
// un nom au détail. La saison connue (id + nom lu dans datas.json) accompagne
// le nom pour alimenter la liste locale des saisons de la maison.
export async function majIndex(
  idUser: number,
  carteId: number,
  nom: string,
  saison?: { id: number | null; nom: string | null },
): Promise<void> {
  const entier: Record<string, EntreeIndex> = saison
    ? { [String(carteId)]: { nom, saisonId: saison.id, saison: saison.nom } }
    : { [String(carteId)]: { nom } };
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
  } else {
    const dossier = new Directory(Paths.document, String(idUser));
    dossier.create({ idempotent: true });
    await new File(dossier, `${carteId}.cdz`).write(octets);
  }
  // L'aperçu 20 % est généré au même moment que l'archive, sur web comme en
  // natif : la maison n'a plus besoin de décompresser chaque .cdz pour sa grille.
  await enregistrerApercuDepuisCdz(idUser, carteId, octets);
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

// Détruit l'archive locale d'une carte — parcours de la vérification au retour
// de connexion : hash local ≠ cardHash serveur → destruction (décision
// produit 2026-11-12), la carte sera re-téléchargée juste après (§5.5).
export async function supprimerCarte(idUser: number, carteId: number): Promise<void> {
  if (Platform.OS === 'web') {
    await supprimerCarteWeb(idUser, carteId);
  } else {
    const fichier = new File(Paths.document, String(idUser), `${carteId}.cdz`);
    if (fichier.exists) await fichier.delete();
  }
  await supprimerApercu(idUser, carteId);
}

// ─── Aperçus 20 % (v0.0.22) ─────────────────────────────────────────────────

// Échec de génération toléré : l'archive complète reste valide et la maison
// sait retomber dessus (extraireApercu) pour les cartes plus anciennes.
export async function enregistrerApercuDepuisCdz(
  idUser: number,
  carteId: number,
  octets: Uint8Array,
): Promise<void> {
  try {
    const apercu = await extraireApercu(octets);
    const front = await reduireApercu(apercu.front);
    await ecrireApercu(idUser, carteId, {
      image: `data:image/png;base64,${encoderBase64(front)}`,
      datas: apercu.datas,
      deck: apercu.deck,
    });
  } catch {
    // Aperçu facultatif : jamais de blocage de la génération/récupération.
  }
}

export async function lireApercu(idUser: number, carteId: number): Promise<ApercuLocal | null> {
  if (Platform.OS === 'web') {
    try {
      const valeur = (await operationPlace('apercus', cleCarte(idUser, carteId))) as
        | ApercuLocal
        | undefined;
      return valeur && typeof valeur.image === 'string' ? valeur : null;
    } catch {
      return null;
    }
  }
  const fichier = new File(Paths.document, String(idUser), 'previews', `${carteId}.json`);
  if (!fichier.exists) return null;
  try {
    const valeur = JSON.parse(fichier.textSync()) as ApercuLocal;
    return typeof valeur.image === 'string' ? valeur : null;
  } catch {
    return null;
  }
}

async function ecrireApercu(idUser: number, carteId: number, apercu: ApercuLocal): Promise<void> {
  if (Platform.OS === 'web') {
    await operationPlace('apercus', cleCarte(idUser, carteId), apercu);
    return;
  }
  const dossier = new Directory(Paths.document, String(idUser), 'previews');
  dossier.create({ idempotent: true });
  await new File(dossier, `${carteId}.json`).write(JSON.stringify(apercu));
}

async function supprimerApercu(idUser: number, carteId: number): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      const base = await ouvrirBase();
      await new Promise((filtre, remettre) => {
        const transaction = base.transaction('apercus', 'readwrite');
        transaction.objectStore('apercus').delete(cleCarte(idUser, carteId));
        transaction.oncomplete = () => filtre(null);
        transaction.onerror = () => remettre(new Error('IndexedDB suppression aperçu impossible'));
      });
    } catch {
      // Dégradation : une entrée orpheline reste sans impact fonctionnel.
    }
    return;
  }
  const fichier = new File(Paths.document, String(idUser), 'previews', `${carteId}.json`);
  if (fichier.exists) {
    try {
      await fichier.delete();
    } catch {
      // Dégradation : un aperçu orphelin reste sans impact fonctionnel.
    }
  }
}

// ─── Natif (expo-file-system API nouvelle) ──────────────────────────────────

function fichierIndexNatif(idUser: number): File {
  return new File(Paths.document, String(idUser), 'index.json');
}

// ─── Web : IndexedDB custom (aucune dépendance) ─────────────────────────────

const NOM_BDD = 'codebara-cdz';
const VERSION_BDD = 2;
const PLACES = ['cartes', 'index', 'apercus'] as const;

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

async function supprimerCarteWeb(idUser: number, carteId: number): Promise<void> {
  const base = await ouvrirBase();
  await new Promise((filtre, remettre) => {
    const transaction = base.transaction('cartes', 'readwrite');
    transaction.objectStore('cartes').delete(cleCarte(idUser, carteId));
    transaction.oncomplete = () => filtre(null);
    transaction.onerror = () => remettre(new Error('IndexedDB suppression impossible'));
  });
}
