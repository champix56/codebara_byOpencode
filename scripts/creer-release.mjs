#!/usr/bin/env node
// Crée une release GitHub pour la version courante de NOTES-VERSION.md.
// Deux artefacts sont publiés, avec des noms stables :
//   codebara.<version>.apk      -> l'APK de build le plus récent (racine du dépôt)
//   codebara.<version>.web.zip  -> le contenu de dist/ (export web)
//
// Le tag reprend la version (ex. 0.0.20, comme le tag historique 0.0.15).
// --tag-prefix v permet d'obtenir v0.0.20 si besoin. Aucun build n'est lancé :
// l'utilisateur build avant d'appeler ce script.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const NOTES = join(RACINE, 'NOTES-VERSION.md');
const DIST = join(RACINE, 'dist');
const REGEX_VERSION = /^\d+\.\d+\.\d+$/;

function afficherAide() {
  console.log(`Usage : npm run release -- [options]

Options :
  --dry-run            Affiche le plan sans créer de tag, push ni release.
  --apk <chemin>       APK à publier (défaut : le plus récent à la racine).
  --version <0.0.x>    Version à publier (défaut : 1re section de NOTES-VERSION.md).
  --tag-prefix <p>     Préfixe du tag (défaut : aucun, ex. --tag-prefix v).
  -h, --help           Affiche cette aide.`);
}

function lireOptions(argv) {
  const options = { dryRun: false, apk: null, version: null, prefixe: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const argument = argv[i];
    if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '-h' || argument === '--help') {
      afficherAide();
      process.exit(0);
    } else if (argument === '--apk' || argument === '--version' || argument === '--tag-prefix') {
      const valeur = argv[++i];
      if (!valeur || valeur.startsWith('--')) throw new Error(`${argument} attend une valeur`);
      if (argument === '--apk') options.apk = valeur;
      else if (argument === '--version') options.version = valeur;
      else options.prefixe = valeur;
    } else {
      throw new Error(`option inconnue : ${argument} (voir --help)`);
    }
  }
  if (options.version && !REGEX_VERSION.test(options.version)) {
    throw new Error(`version invalide : ${options.version} (attendu 0.0.x)`);
  }
  return options;
}

function executer(command, argumentsList) {
  try {
    return execFileSync(command, argumentsList, {
      cwd: RACINE,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    const detail = String(e.stderr || e.stdout || e.message || '').trim();
    const erreur = new Error(`${command} ${argumentsList.join(' ')} a échoué : ${detail}`);
    erreur.status = e.status;
    throw erreur;
  }
}

function estFichier(chemin) {
  try {
    return statSync(chemin).isFile();
  } catch {
    return false;
  }
}

function estDossier(chemin) {
  try {
    return statSync(chemin).isDirectory();
  } catch {
    return false;
  }
}

function lireVersionEtNotes() {
  if (!estFichier(NOTES)) throw new Error(`introuvable : ${NOTES}`);
  const texte = readFileSync(NOTES, 'utf8');
  const entete = /^## v(\d+\.\d+\.\d+)[^\n]*\r?\n/m.exec(texte);
  if (!entete) throw new Error('aucune section ## v0.0.x trouvée dans NOTES-VERSION.md');
  const debut = entete.index + entete[0].length;
  const reste = texte.slice(debut);
  const fin = reste.search(/^## v\d+\.\d+\.\d+/m);
  const corps = (fin === -1 ? reste : reste.slice(0, fin)).trim();
  return { version: entete[1], notes: corps || `Release v${entete[1]}` };
}

function trouverApk(cheminDemande) {
  if (cheminDemande) {
    const chemin = resolve(RACINE, cheminDemande);
    if (!estFichier(chemin) || !chemin.toLowerCase().endsWith('.apk')) {
      throw new Error(`APK introuvable : ${chemin}`);
    }
    return chemin;
  }
  const candidats = readdirSync(RACINE)
    .filter((nom) => nom.toLowerCase().endsWith('.apk'))
    .map((nom) => ({ chemin: join(RACINE, nom), date: statSync(join(RACINE, nom)).mtimeMs }))
    .filter((candidat) => estFichier(candidat.chemin))
    .sort((a, b) => b.date - a.date);
  if (!candidats.length) {
    throw new Error('aucun APK à la racine : lance le build Android avant la release');
  }
  return candidats[0].chemin;
}

function fichiersDist() {
  if (!estDossier(DIST)) {
    throw new Error('dist/ absent : lance npm run build:web avant la release');
  }
  const fichiers = [];
  const parcourir = (dossier, prefixe) => {
    const entrees = readdirSync(dossier, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    for (const entree of entrees) {
      const chemin = join(dossier, entree.name);
      const relatif = prefixe ? `${prefixe}/${entree.name}` : entree.name;
      if (entree.isDirectory()) parcourir(chemin, relatif);
      else if (entree.isFile()) fichiers.push({ chemin, relatif, taille: statSync(chemin).size });
    }
  };
  parcourir(DIST, '');
  if (!fichiers.length) throw new Error('dist/ est vide : lance npm run build:web avant la release');
  return fichiers;
}

async function creerZipWeb(fichiers, sortie) {
  const zip = new JSZip();
  for (const fichier of fichiers) zip.file(fichier.relatif, readFileSync(fichier.chemin));
  const tampon = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  writeFileSync(sortie, tampon);
  return tampon.length;
}

function octetsLegers(nombre) {
  return nombre >= 1_000_000 ? `${(nombre / 1_000_000).toFixed(1)} Mo` : `${Math.round(nombre / 1024)} Ko`;
}

function verifierOutils() {
  try {
    executer('git', ['--version']);
  } catch {
    throw new Error('git est requis pour créer le tag');
  }
  try {
    executer('gh', ['--version']);
    executer('gh', ['auth', 'status']);
  } catch {
    throw new Error('GitHub CLI (gh) non authentifié : lance gh auth login (droits repo)');
  }
}

function verifierArbrePropre() {
  const changements = executer('git', ['status', '--porcelain']).trim();
  if (changements) {
    const apercu = changements.split('\n').slice(0, 8).join('\n');
    throw new Error(`arbre Git non propre — commite tes changements avant la release :\n${apercu}`);
  }
}

function tagLocal(tag) {
  try {
    return executer('git', ['rev-parse', '--verify', `refs/tags/${tag}^{commit}`]).trim();
  } catch {
    return null;
  }
}

function tagDistant(tag) {
  try {
    executer('git', ['ls-remote', '--exit-code', '--tags', 'origin', `refs/tags/${tag}`]);
    return true;
  } catch (e) {
    if (e.status === 2) return false;
    throw new Error(`impossible de vérifier le tag distant ${tag} : ${e.message}`);
  }
}

function releaseExistante(tag) {
  try {
    executer('gh', ['release', 'view', tag, '--json', 'tagName']);
    return true;
  } catch {
    return false;
  }
}

function preparerTag(tag, version) {
  const tete = executer('git', ['rev-parse', 'HEAD']).trim();
  const local = tagLocal(tag);
  const distant = tagDistant(tag);
  if (local && local !== tete) {
    throw new Error(`le tag local ${tag} pointe sur ${local.slice(0, 8)}, pas sur HEAD (${tete.slice(0, 8)})`);
  }
  if (distant && !local) {
    throw new Error(`le tag ${tag} existe sur origin mais pas en local : récupère-le avant de relancer`);
  }
  if (releaseExistante(tag)) {
    throw new Error(`la release ${tag} existe déjà sur GitHub`);
  }
  if (!local) {
    executer('git', ['tag', '-a', tag, '-m', `Release v${version}`]);
    console.log(`✔ tag annoté ${tag} créé`);
  } else {
    console.log(`· tag ${tag} déjà présent localement, réutilisé`);
  }
  if (!distant) {
    executer('git', ['push', 'origin', tag]);
    console.log(`✔ tag ${tag} poussé sur origin`);
  } else {
    console.log(`· tag ${tag} déjà présent sur origin`);
  }
}

async function main() {
  const options = lireOptions(process.argv.slice(2));
  const { version: versionNotes, notes } = lireVersionEtNotes();
  const version = options.version ?? versionNotes;
  const tag = `${options.prefixe}${version}`;
  const titre = `v${version}`;
  const apk = trouverApk(options.apk);
  const fichiers = fichiersDist();
  const tailleDist = fichiers.reduce((total, fichier) => total + fichier.taille, 0);

  console.log(`Version : ${version} (NOTES-VERSION.md)`);
  console.log(`Tag     : ${tag} — titre ${titre}`);
  console.log(`APK     : ${basename(apk)} (${octetsLegers(statSync(apk).size)}) → codebara.${version}.apk`);
  console.log(`Web     : dist/ (${fichiers.length} fichiers, ${octetsLegers(tailleDist)}) → codebara.${version}.web.zip`);
  console.log(`Notes   : premier paragraphe de NOTES-VERSION.md (${notes.split('\n')[0]})`);
  const notesDate = statSync(NOTES).mtimeMs;
  if (statSync(apk).mtimeMs < notesDate || Math.max(...fichiers.map((f) => statSync(f.chemin).mtimeMs)) < notesDate) {
    console.log('⚠ un artefact est plus ancien que NOTES-VERSION.md : vérifie que la build contient bien cette version');
  }

  if (options.dryRun) {
    console.log('\nMode dry-run : aucun tag, push ni release effectué.');
    return;
  }

  verifierOutils();
  verifierArbrePropre();
  preparerTag(tag, version);

  const dossierTemp = mkdtempSync(join(tmpdir(), 'codebara-release-'));
  try {
    const zip = join(dossierTemp, `codebara.${version}.web.zip`);
    const tailleZip = await creerZipWeb(fichiers, zip);
    console.log(`✔ zip web créé (${octetsLegers(tailleZip)})`);

    const sortie = executer('gh', [
      'release', 'create', tag,
      `${apk}#codebara.${version}.apk`,
      `${zip}#codebara.${version}.web.zip`,
      '--verify-tag',
      '--title', titre,
      '--notes', notes,
    ]);
    console.log(`✔ release ${titre} publiée`);
    if (sortie.trim()) console.log(sortie.trim());
  } finally {
    rmSync(dossierTemp, { recursive: true, force: true });
  }
}

try {
  await main();
} catch (e) {
  console.error(`\nErreur : ${e.message}`);
  process.exitCode = 1;
}
