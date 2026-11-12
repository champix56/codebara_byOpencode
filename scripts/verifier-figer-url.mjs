// Contrôle hors navigateur de `src/utils/figerUrl.ts` (URL figée à la racine, web).
// Exécution : node --experimental-strip-types scripts/verifier-figer-url.mjs
// (Node ≥ 22.6 ; aucun navigateur requis — `verrouillerUrlRacine` est testée
// sur un `window` factice : ramène d'un deep link, réécriture pushState /
// replaceState, idempotence, cas racine, silence hors web).
// La preuve navigateur (Chrome headless + DevTools) est décrite dans
// docs/architecture.md § Web — exécutée le 2026-11-03.
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
    get state() {
      return this.pile[this.position].etat;
    },
  };
  return {
    location: { pathname: chemin, search: '', hash: '' },
    history: historique,
  };
}

// ── 1–4 : deep link …/maison tapé à la main ───────────────────────────────────
globalThis.window = simulerFenetre('/maison');
const moduleU = await import(new URL('../src/utils/figerUrl.ts', import.meta.url));

moduleU.verrouillerUrlRacine();
assert.equal(globalThis.window.history.pile[0].chemin, '/', 'l adresse /maison doit être ramenée à « / »');
assert.equal(globalThis.window.history.pile[0].etat.idx, 7, 'le state existant est conservé');
console.log('OK   verrouillerUrlRacine() sur /maison -> écrit « / », state conservé');

globalThis.window.history.pushState({ idx: 11 }, '', '/principal');
assert.equal(globalThis.window.history.pile.at(-1).chemin, '/', 'pushState doit écrire « / »');
assert.equal(globalThis.window.history.pile.at(-1).etat.idx, 11, 'pushState conserve le state');
console.log('OK   pushState(/principal) -> écrit « / », state conservé');

moduleU.verrouillerUrlRacine();
globalThis.window.history.pushState({ idx: 12 }, '', '/login');
assert.equal(globalThis.window.history.pile.at(-1).chemin, '/', 'pushState reste réécrit après un second verrouillerUrlRacine');
assert.equal(globalThis.window.history.pile.at(-1).etat.idx, 12, 'la pile reste cohérente après double appel');
console.log('OK   double verrouillerUrlRacine() idempotent');

globalThis.window.history.replaceState({ idx: 11 }, '', '/carte/4');
assert.equal(globalThis.window.history.pile.at(-1).chemin, '/', 'replaceState doit écrire « / »');
assert.equal(globalThis.window.history.pile.at(-1).etat.idx, 11, 'replaceState conserve le state');
console.log('OK   replaceState(/carte/4) -> écrit « / », state conservé');

// ── 5 : cas racine — aucune écriture supplémentaire ───────────────────────────
globalThis.window = simulerFenetre('/');
const moduleU2 = await import(new URL('../src/utils/figerUrl.ts', import.meta.url) + '?racine');
moduleU2.verrouillerUrlRacine();
assert.equal(globalThis.window.history.pile.length, 1, 'à la racine, aucune écriture d historique');
console.log('OK   URL initiale « / » : verrou posé sans écriture');

// ── 6 : silence hors navigateur (natif / SSR) ────────────────────────────────
delete globalThis.window;
moduleU2.verrouillerUrlRacine(); // garde `typeof window` — doit rester sans effet
console.log('OK   module silencieux hors navigateur');

console.log('RÉSULTAT : TOUS CONTRÔLES OK');
