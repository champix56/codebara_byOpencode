import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { getLocales } from 'expo-localization';
import JSZip from 'jszip';
import {
  telechargerSaison,
  verifierSaison,
} from './api';
import { estZipValide, hacherOctets } from '../utils/cdz';
import { encoderBase64 } from '../utils/base64';
import { CARTE_VIEWBOX, CARTE_ZONES, type ZoneCarte } from '../data/carte';

// Saison d'affichage de l'app (paquet `.cds`, cf. docs/cds-format.md et contrat
// §5.11 — intégration client exigée 2026-11-17) :
//
//  - MOBILE : le .cds est stocké localement (<documentDirectory>/saison.cds,
//    sandbox privé) — à chaque connexion : sha256 du fichier local vérifié par
//    GET /season/check (hash bon → saison locale ; mauvais/absent → GET
//    /season, stockage immédiat puis affichage) ;
//  - WEB : PAS de stockage local — GET /season à chaque fois ;
//  - AUCUNE saison retournée (appseason vide, archive illisible, panne
//    réseau…) → SAISON EMBARQUÉE dans la build (assets/carte, même rendu que
//    le SVG source img2.svg).
//
// Le pays de la demande est la locale du téléphone (expo-localization, ex.
// "fr-FR") envoyée dans le champ `country` du header `datas`.
//
// L'affichage courant vit dans une variable de module (comme la pile de
// navigateur) : le splash la charge juste avant la fenêtre principale — les
// fenêtres suivantes lisent `saisonAffichageCourante()`.

// ─── Types ───────────────────────────────────────────────────────────────────

// season.json — parsing tolérant (esprit §6.4 du contrat : tout champ peut
// manquer ou changer de type).
export type SaisonDatas = {
  id: number | null;
  nom: string | null;
  pays: string | null;
  debut: string | null;
  fin: string | null;
  fond: { fichier: string; largeur: number; hauteur: number } | null;
  batiments: Record<
    string,
    {
      fichier: string;
      x: number;
      y: number;
      largeur: number;
      hauteur: number;
      fenetre: string | null;
    }
  >;
};

// Saison prête à afficher : géométrie + sources d'images résolues (require()
// pour la saison embarquée, fichier cache natif ou data URI web pour les .cds).
export type AffichageSaison = {
  id: number | null;
  nom: string | null;
  viewbox: { largeur: number; hauteur: number };
  zones: ZoneCarte[];
  source: 'embarquee' | 'locale' | 'serveur';
};

// Origine de la saison chargée (retourné par chargerSaisonAffichage).
export type OrigineSaison = 'embarquee' | 'locale' | 'serveur';

// ─── Saison embarquée (repli de la build) ────────────────────────────────────

// L'ordre CARTE_ZONES (fond d'abord, puis bâtiments) est l'ordre de
// superposition du SVG source — conservé tel quel.
function saisonEmbarquee(): AffichageSaison {
  return {
    id: null,
    nom: null,
    viewbox: { largeur: CARTE_VIEWBOX.largeur, hauteur: CARTE_VIEWBOX.hauteur },
    zones: [...CARTE_ZONES],
    source: 'embarquee',
  };
}

// ─── Pays de la demande ──────────────────────────────────────────────────────

export function paysDemande(): string | null {
  try {
    // Première locale du téléphone, ex. « fr-FR » (languageTag).
    const [locale] = getLocales();
    const tag = locale?.languageTag;
    return typeof tag === 'string' && tag ? tag : null;
  } catch {
    return null; // locale indisponible → le serveur retombera sur intl
  }
}

// ─── Stockage local du .cds (mobile uniquement, sandbox privé) ───────────────

function fichierSaison(): File {
  return new File(Paths.document, 'saison.cds');
}

async function lireSaisonLocale(): Promise<Uint8Array | null> {
  const fichier = fichierSaison();
  return fichier.exists ? await fichier.bytes() : null;
}

async function stockerSaisonLocale(octets: Uint8Array): Promise<void> {
  new Directory(Paths.document).create({ idempotent: true });
  await fichierSaison().write(octets);
}

// ─── Parsing du .cds (même mécanique ZIP que le .cdz, cf. utils/cdz.ts) ─────

function nombreOuNull(source: Record<string, unknown>, cle: string): number | null {
  return typeof source[cle] === 'number' ? (source[cle] as number) : null;
}

function texteOuNull(source: Record<string, unknown>, cle: string): string | null {
  return typeof source[cle] === 'string' ? (source[cle] as string) : null;
}

function lireSeasonJson(json: unknown): SaisonDatas {
  const source = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
  const fondBrut =
    typeof source.fond === 'object' && source.fond !== null
      ? (source.fond as Record<string, unknown>)
      : {};
  const batimentsBrut =
    typeof source.batiments === 'object' && source.batiments !== null
      ? (source.batiments as Record<string, unknown>)
      : {};
  const batiments: SaisonDatas['batiments'] = {};
  for (const [nom, brut] of Object.entries(batimentsBrut)) {
    if (typeof brut !== 'object' || brut === null) continue;
    const batiment = brut as Record<string, unknown>;
    if (typeof batiment.fichier !== 'string') continue;
    batiments[nom] = {
      fichier: batiment.fichier,
      x: nombreOuNull(batiment, 'x') ?? 0,
      y: nombreOuNull(batiment, 'y') ?? 0,
      largeur: nombreOuNull(batiment, 'largeur') ?? 0,
      hauteur: nombreOuNull(batiment, 'hauteur') ?? 0,
      fenetre: texteOuNull(batiment, 'fenetre'),
    };
  }
  return {
    id: nombreOuNull(source, 'id'),
    nom: texteOuNull(source, 'nom'),
    pays: texteOuNull(source, 'pays'),
    debut: texteOuNull(source, 'debut'),
    fin: texteOuNull(source, 'fin'),
    fond:
      typeof fondBrut.fichier === 'string'
        ? {
            fichier: fondBrut.fichier,
            largeur: nombreOuNull(fondBrut, 'largeur') ?? 0,
            hauteur: nombreOuNull(fondBrut, 'hauteur') ?? 0,
          }
        : null,
    batiments,
  };
}

// Extrait season.json + les PNG référencés (fond + chaque bâtiment). Archive
// illisible ou season.json sans fond exploitable → null (l'appelant retombera
// sur la saison embarquée).
async function ouvrirCds(
  octets: Uint8Array,
): Promise<(SaisonDatas & { images: Map<string, Uint8Array> }) | null> {
  if (!estZipValide(octets)) return null;
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(octets);
  } catch {
    return null;
  }
  const entreeSeason = zip.file('season.json');
  if (!entreeSeason) return null;
  let donnees: SaisonDatas;
  try {
    donnees = lireSeasonJson(JSON.parse(await entreeSeason.async('string')));
  } catch {
    return null;
  }
  if (!donnees.fond || donnees.fond.largeur <= 0 || donnees.fond.hauteur <= 0) return null;
  // Uniquement les fichiers RÉFÉRENCÉS par season.json (fond + bâtiments).
  const references = new Set<string>([donnees.fond.fichier]);
  for (const batiment of Object.values(donnees.batiments)) {
    references.add(batiment.fichier);
  }
  const images = new Map<string, Uint8Array>();
  for (const nom of references) {
    const entree = zip.file(nom);
    if (!entree) return null; // ressource manquante → archive incomplète
    images.set(nom, await entree.async('uint8array'));
  }
  return { ...donnees, images };
}

// ─── Sources d'images selon la plateforme ───────────────────────────────────

// Natif : les PNG extraits sont écrits dans le cache (<cache>/saisons/<fichier>)
// et référencés par URI fichier — Image consomme le fichier sans le recoder.
async function sourceNatif(nom: string, octets: Uint8Array): Promise<ZoneCarte['image']> {
  const dossier = new Directory(Paths.cache, 'saisons');
  dossier.create({ idempotent: true });
  const fichier = new File(dossier, nom);
  await fichier.write(octets);
  return { uri: fichier.uri };
}

// Web : data URI PNG (aucun fichier à servir, tout vit en mémoire).
function sourceWeb(octets: Uint8Array): ZoneCarte['image'] {
  return { uri: `data:image/png;base64,${encoderBase64(octets)}` };
}

// ─── Construction de l'affichage depuis une archive ─────────────────────────

async function affichageDepuisArchive(
  octets: Uint8Array,
  source: 'locale' | 'serveur',
): Promise<AffichageSaison | null> {
  const cds = await ouvrirCds(octets);
  if (!cds || !cds.fond) return null;
  const zones: ZoneCarte[] = [];
  // Le fond d'abord (pas d'action), puis les bâtiments (chaque clic ouvre la
  // fenêtre `fenetre` — les garde-fous de navigation restent dans principal).
  zones.push({
    id: 'fond',
    action: null,
    x: 0,
    y: 0,
    largeur: cds.fond.largeur,
    hauteur: cds.fond.hauteur,
    image: Platform.OS === 'web'
      ? sourceWeb(cds.images.get(cds.fond.fichier) as Uint8Array)
      : await sourceNatif(cds.fond.fichier, cds.images.get(cds.fond.fichier) as Uint8Array),
  });
  for (const [nom, batiment] of Object.entries(cds.batiments)) {
    const octetsImage = cds.images.get(batiment.fichier);
    if (!octetsImage) continue; // bâtiment sans ressource : ignoré
    zones.push({
      id: nom,
      action: batiment.fenetre,
      x: batiment.x,
      y: batiment.y,
      largeur: batiment.largeur,
      hauteur: batiment.hauteur,
      image: Platform.OS === 'web'
        ? sourceWeb(octetsImage)
        : await sourceNatif(batiment.fichier, octetsImage),
    });
  }
  return {
    id: cds.id,
    nom: cds.nom,
    viewbox: { largeur: cds.fond.largeur, hauteur: cds.fond.hauteur },
    zones,
    source,
  };
}

// ─── Affichage courant (variable de module, cf. en-tête) ────────────────────

let affichageCourant: AffichageSaison = saisonEmbarquee();

export function saisonAffichageCourante(): AffichageSaison {
  return affichageCourant;
}

// ─── Chargement complet (appelé par le splash, étape « saison ») ────────────

// Charge et vérifie la saison (flux §5.11) puis remplace l'affichage courant.
// NE LÈVE JAMAIS : tout incident (réseau, réponse vide, archive illisible)
// retombe sur la saison embarquée — l'habillage ne doit pas bloquer la
// connexion. Retourne l'origine retenue (pour le debug/doc).
export async function chargerSaisonAffichage(): Promise<OrigineSaison> {
  const pays = paysDemande();
  try {
    if (Platform.OS !== 'web') {
      // Mobile : saison locale d'abord, vérifiée par son sha256 (§5.11).
      const locale = await lireSaisonLocale();
      if (locale) {
        const empreinte = await hacherOctets(locale);
        const verifiee = await verifierSaison(empreinte, pays);
        if (verifiee.appseason !== null && verifiee.hash === empreinte) {
          const affichage = await affichageDepuisArchive(locale, 'locale');
          if (affichage) {
            affichageCourant = affichage;
            return 'locale';
          }
        }
      }
    }
    // Web : toujours GET /season. Mobile : hash en écart ou pas de saison
    // locale → téléchargement + stockage local immédiat.
    const distante = await telechargerSaison(pays);
    if (distante) {
      const affichage = await affichageDepuisArchive(distante.octets, 'serveur');
      if (affichage) {
        if (Platform.OS !== 'web') await stockerSaisonLocale(distante.octets);
        affichageCourant = affichage;
        return 'serveur';
      }
    }
  } catch {
    // Panne réseau / réponse non conforme : repli (voir ci-dessous).
  }
  affichageCourant = saisonEmbarquee();
  return 'embarquee';
}
