// Génère src/data/notes-version.ts à partir de NOTES-VERSION.md (racine).
//
// Le fichier md est LA SOURCE maintenue à la main : une section `## vX.Y.Z`
// par version, la plus récente EN PREMIER. La première section définit la
// version courante embarquée dans l'app (VERSION_APPLI) — `x` de « CodEbara
// v0.0.x » s'incrémente à chaque changement dans l'app, cf. en-tête du md.
//
// Usage : npm run maj:notes   (à relancer après chaque édition du md)

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(racine, 'NOTES-VERSION.md');
const cible = join(racine, 'src', 'data', 'notes-version.ts');

const brut = readFileSync(source, 'utf8');

// Découpe les sections « ## vX.Y.Z » (la plus récente en premier dans le md).
const sections = [...brut.matchAll(/^## (v[\d.]+)\s*$/gm)].map((entete, index, tous) => {
  const debut = entete.index + entete[0].length;
  const fin = index + 1 < tous.length ? tous[index + 1].index : brut.length;
  const lignes = brut
    .slice(debut, fin)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- ') || l.length > 0)
    .map((l) => (l.startsWith('- ') ? l.slice(2) : l))
    .filter((l) => l.length > 0);
  return { version: entete[1], lignes };
});

if (sections.length === 0) {
  console.error('✖ NOTES-VERSION.md ne contient aucune section « ## vX.Y.Z ».');
  process.exit(1);
}

const version = sections[0].version.replace(/^v/, '');

const ts = `// GÉNÉRÉ par scripts/maj-notes-version.mjs — NE PAS ÉDITER À LA MAIN.
// Source maintenue : NOTES-VERSION.md (racine) — npm run maj:notes après édition.
// VERSION_APPLI = première section du md (la plus récente) ; affichée en jeu
// sous le bandeau publicitaire (« CodEbara ${sections[0].version} ») et
// consommée par la fenêtre notes de version.

export const VERSION_APPLI = '${version}';

export type NoteVersion = { version: string; lignes: string[] };

export const NOTES_VERSION: NoteVersion[] = ${JSON.stringify(sections, null, 2)};
`;

writeFileSync(cible, ts);
console.log(`✔ notes-version.ts généré — version courante : ${sections[0].version} (${sections.length} version(s))`);
