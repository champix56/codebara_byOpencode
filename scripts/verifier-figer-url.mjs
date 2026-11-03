// Contrôle hors navigateur de `src/utils/figerUrl.ts` (URL figée à la racine, web).
// Exécution : node --experimental-strip-types scripts/verifier-figer-url.mjs
// (Node ≥ 22.6 ; aucun navigateur requis — les fonctions du module sont toutes
// testées sur un `window` factice : capture de l'URL initiale, réécriture
// pushState / replaceState, idempotence, remise à la racine, silence hors web).
// La preuve navigateur (Chrome headless + DevTools, deep link + navigation réelle)
// est décrite dans docs/architecture.md § Web — exécutée le 2026-11-03.
import assert from 'node:assert/strict';

function simulerFenetre(chemin) {
  const historique = {
    pile: [{ chemin, etat: { idx: 7 } }],
    position: 0,
    pushState(etat, _titre, cible) {
      this.pile.push({ chemin: String(cible), etat });
      this.position += 1;
    },
    replaceState(etat, _titre, cible) {
      this.pile[this.position] = { chemin: String(cible), etat };
    },
  };
  return {
    location: { pathname: chemin, search: '', hash: '' },
    history: historique,
  };
}

// ── 1–5 : deep link …/maison tapé à la main ───────────────────────────────────
globalThis.window = simulerFenetre('/maison');
const moduleU = await import(new URL('../src/utils/figerUrl.ts', import.meta.url));

assert.equal(moduleU.urlInitialeHorsRacine(), true, 'l URL initiale /maison est hors racine');
console.log('OK   urlInitialeHorsRacine() -> true sur /maison');

moduleU.figerHistorique();
globalThis.window.history.pushState({ idx: 11 }, '', '/principal');
assert.equal(globalThis.window.history.pile.at(-1).chemin, '/', 'pushState doit écrire « / »');
assert.equal(globalThis.window.history.pile.at(-1).etat.idx, 11, 'pushState conserve le state');
console.log('OK   pushState(/principal) -> écrit « / », state conservé');

moduleU.figerHistorique();
globalThis.window.history.pushState({ idx: 12 }, '', '/login');
assert.equal(globalThis.window.history.pile.at(-1).chemin, '/', 'pushState reste réécrit après un second figerHistorique');
assert.equal(globalThis.window.history.pile.at(-1).etat.idx, 12, 'la pile reste cohérente après double appel');
console.log('OK   double figerHistorique() idempotent');

globalThis.window.history.replaceState({ idx: 11 }, '', '/carte/4');
assert.equal(globalThis.window.history.pile.at(-1).chemin, '/', 'replaceState doit écrire « / »');
assert.equal(globalThis.window.history.pile.at(-1).etat.idx, 11, 'replaceState conserve le state');
console.log('OK   replaceState(/carte/4) -> écrit « / », state conservé');

moduleU.razHistoriqueVersRacine();
assert.equal(globalThis.window.history.pile.at(-1).chemin, '/', 'razHistoriqueVersRacine doit écrire « / »');
console.log('OK   razHistoriqueVersRacine() -> « / »');

// ── 6 : cas racine + silence hors navigateur (natif / SSR) ────────────────────
globalThis.window = simulerFenetre('/');
const moduleU2 = await import(new URL('../src/utils/figerUrl.ts', import.meta.url) + '?racine');
assert.equal(moduleU2.urlInitialeHorsRacine(), false, 'l URL initiale « / » est la racine');
console.log('OK   URL initiale « / » reconnue comme racine');

delete globalThis.window;
moduleU2.figerHistorique(); // garde `typeof window` — doit rester sans effet
console.log('OK   module silencieux hors navigateur');

console.log('RÉSULTAT : TOUS CONTRÔLES OK');
