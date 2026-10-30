// Extrait la carte depuis le SVG du répertoire parent (../img2.svg) :
// - enregistre chaque <image> embarquée (base64) en PNG dans assets/carte/<nom>.png ;
// - régénère src/data/carte.ts (viewBox + géométrie + sources require).
//
// Le SVG source est presque uniquement composé de <image> positionnées : reproduire
// leur géométrie en composants React Native <Image> est visuellement identique et bien
// plus performant (décodage natif) que parser un SVG de plusieurs Mo à chaque lancement.
//
// Utilisation : node scripts/extraire-carte-svg.mjs
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHEMIN_SVG = resolve(RACINE, '..', 'img2.svg');
const DOSSIER_PNG = join(RACINE, 'assets', 'carte');
const CHEMIN_DATA = join(RACINE, 'src', 'data', 'carte.ts');

const sanitize = (valeur) =>
  valeur.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/-+/g, '-') || 'image';

// Dimensions intrinsèques d'un PNG : largeur/hauteur big-endian dans l'IHDR.
const dimensionsPng = (octets) => ({
  largeur: octets.readUInt32BE(16),
  hauteur: octets.readUInt32BE(20),
});

const xml = await readFile(CHEMIN_SVG, 'utf8');

const viewBoxBrut = xml.match(/<svg\b[^>]*\bviewBox\s*=\s*"([^"]*)"/)?.[1];
if (!viewBoxBrut) throw new Error(`viewBox introuvable dans ${CHEMIN_SVG}`);
const [vbX, vbY, vbL, vbH] = viewBoxBrut.trim().split(/\s+/).map(Number);
if ([vbX, vbY, vbL, vbH].some((n) => !Number.isFinite(n))) {
  throw new Error(`viewBox illisible : "${viewBoxBrut}"`);
}

const balises = [...xml.matchAll(/<image\b([^>]*)>/g)];
if (balises.length === 0) throw new Error('aucune balise <image> dans le SVG');

if (!existsSync(DOSSIER_PNG)) await mkdir(DOSSIER_PNG, { recursive: true });

const zones = [];
for (const index of balises.keys()) {
  const attributs = Object.fromEntries(
    [...balises[index][1].matchAll(/([a-zA-Z:.-]+)\s*=\s*"([^"]*)"/g)].map(([, cle, valeur]) => [cle, valeur]),
  );
  const href = attributs['xlink:href'] || attributs.href || '';
  if (!href.startsWith('data:image/png;base64,')) {
    throw new Error(`image n°${index + 1} : href non géré (${href.slice(0, 40)}…)`);
  }
  const octets = Buffer.from(href.slice('data:image/png;base64,'.length), 'base64');
  const nom = sanitize(attributs['data-action'] || attributs.id || `image-${index + 1}`);
  const chemin = join(DOSSIER_PNG, `${nom}.png`);
  await writeFile(chemin, octets);

  const { largeur, hauteur } = dimensionsPng(octets);
  zones.push({
    id: attributs.id ?? nom,
    action: attributs['data-action'] ?? null,
    x: attributs.x ? parseFloat(attributs.x) : 0,
    y: attributs.y ? parseFloat(attributs.y) : 0,
    // Balise <image> sans width/height : le moteur SVG rend l'image à sa taille intrinsèque.
    largeur: attributs.width ? parseFloat(attributs.width) : largeur,
    hauteur: attributs.height ? parseFloat(attributs.height) : hauteur,
    png: `${nom}.png`,
  });
  console.log(`✓ ${nom}.png (${largeur}×${hauteur} px, zone ${zones.at(-1).largeur}×${zones.at(-1).hauteur} u)`);
}

const ligne = (zone) =>
  `  { id: '${zone.id}', action: ${zone.action === null ? 'null' : `'${zone.action}'`}, x: ${zone.x}, y: ${zone.y}, largeur: ${zone.largeur}, hauteur: ${zone.hauteur}, image: require('../../assets/carte/${zone.png}') },`;

const dataTs = `// GÉNÉRÉ par scripts/extraire-carte-svg.mjs — ne pas modifier à la main.
// Source : ../img2.svg (répertoire parent du projet) ; relancer le script pour régénérer.
import type { ImageSourcePropType } from 'react-native';

export type ZoneCarte = {
  /** id de la balise <image> d'origine */
  id: string;
  /** data-action de la balise d'origine (zone interactive) ; null pour une image décorative */
  action: string | null;
  /** Géométrie en unités du viewBox : position du coin haut-gauche puis dimensions */
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  image: ImageSourcePropType;
};

export const CARTE_VIEWBOX = { x: ${vbX}, y: ${vbY}, largeur: ${vbL}, hauteur: ${vbH} } as const;

// L'ordre du tableau correspond à l'ordre z du SVG (le dernier dessiné est au-dessus).
export const CARTE_ZONES: ZoneCarte[] = [
${zones.map(ligne).join('\n')}
];
`;

// Passe le dossier des PNG avant d'écrire le module de données.
await rm(join(RACINE, 'src', 'data'), { force: true, recursive: true });
await mkdir(dirname(CHEMIN_DATA), { recursive: true });
await writeFile(CHEMIN_DATA, dataTs);
console.log(`✓ ${CHEMIN_DATA} — ${zones.length} zones, viewBox ${vbX} ${vbY} ${vbL} ${vbH}`);
