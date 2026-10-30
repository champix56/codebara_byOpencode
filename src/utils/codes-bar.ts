// Utilitaires « purs » de validation des codes-barres produits attendus par la
// fenêtre usine : EAN-13, EAN-8, UPC-A, UPC-E (variante compressée de l'UPC-A,
// renvoyée telle quelle par le scanneur) et UPC-B (11 chiffres sans clé de
// contrôle, non scannable côté caméra — accepté uniquement dans la saisie web).
// Aucune dépendance React : réutilisable côté natif comme côté web.
// Règles vérifiées le 2026-10-30 contre
// https://en.wikipedia.org/wiki/Universal_Product_Code (clef, expansion UPC-E).

export type FormatCode = 'ean8' | 'ean13' | 'upc_a' | 'upc_e' | 'upc_b';

export const LIBELLE_FORMAT: Record<FormatCode, string> = {
  ean8: 'EAN-8',
  ean13: 'EAN-13',
  upc_a: 'UPC-A',
  upc_e: 'UPC-E',
  upc_b: 'UPC-B',
};

// Ne conserve que les chiffres : les saisies manuelles peuvent contenir
// espaces, tirets ou autres séparateurs.
export function neRetenirQueChiffres(valeur: string): string {
  return valeur.replace(/\D/g, '');
}

// Clé de contrôle universelle EAN/UPC : le chiffre des données le plus à droite
// reçoit le poids 3, puis les poids alternent 3 puis 1 en remontant vers la
// gauche ; la clé vaut (10 − somme % 10) % 10. Exemple vérifié :
// 03600029145 → clé 2 ; 01234500006 (UPC-A équivalent de l'UPC-E 01234565) → 5.
export function cleControle(donnees: string): number {
  let somme = 0;
  for (let index = 0; index < donnees.length; index += 1) {
    const chiffre = Number(donnees[donnees.length - 1 - index]);
    somme += chiffre * (index % 2 === 0 ? 3 : 1);
  }
  return (10 - (somme % 10)) % 10;
}

// Un UPC-E affiché (8 chiffres) se réexplose en son UPC-A équivalent selon la
// valeur du 6e chiffre, pour en vérifier la clé — qui est celle de l'UPC-A :
//   d6 = 0, 1 ou 2 → système + d1 d2 d6 + 0000 + d3 d4 d5
//   d6 = 3         → système + d1 d2 d3 + 00000 + d4 d5
//   d6 = 4         → système + d1 d2 d3 d4 + 00000 + d5
//   d6 = 5…9       → système + d1 d2 d3 d4 d5 + 0000 + d6
function donneesEquivalentsUpcE(code: string): string | null {
  const [systeme, d1, d2, d3, d4, d5, d6] = code;
  if (systeme !== '0' && systeme !== '1') return null;
  if (d6 === '0' || d6 === '1' || d6 === '2') {
    return systeme + d1 + d2 + d6 + '0000' + d3 + d4 + d5;
  }
  if (d6 === '3') return systeme + d1 + d2 + d3 + '00000' + d4 + d5;
  if (d6 === '4') return systeme + d1 + d2 + d3 + d4 + '00000' + d5;
  return systeme + d1 + d2 + d3 + d4 + d5 + '0000' + d6;
}

// Vérifie un code déchiffré pour un format donné (le type renvoyé par la caméra
// fait foi ; sur web c'est la longueur qui l'a déterminé).
export function verifierCode(chiffres: string, format: FormatCode): boolean {
  if (format === 'ean13') {
    return chiffres.length === 13 && cleControle(chiffres.slice(0, 12)) === Number(chiffres[12]);
  }
  if (format === 'upc_a') {
    return chiffres.length === 12 && cleControle(chiffres.slice(0, 11)) === Number(chiffres[11]);
  }
  if (format === 'ean8') {
    return chiffres.length === 8 && cleControle(chiffres.slice(0, 7)) === Number(chiffres[7]);
  }
  if (format === 'upc_e') {
    if (chiffres.length !== 8) return false;
    const donnees = donneesEquivalentsUpcE(chiffres);
    return donnees !== null && cleControle(donnees) === Number(chiffres[7]);
  }
  // upc_b : 11 chiffres, sans clé de contrôle (validation structurelle).
  return chiffres.length === 11;
}

export type Detection = {
  format: FormatCode | null;
  valide: boolean;
  libelle: string;
};

function assumerFormat(format: FormatCode, chiffres: string): Detection {
  const valide = verifierCode(chiffres, format);
  const suite =
    format === 'upc_b'
      ? valide
        ? ' — 11 chiffres, structure valide (sans clé de contrôle)'
        : ' — structure invalide'
      : valide
        ? ' — code valide'
        : ' — clé de contrôle invalide';
  return { format, valide, libelle: LIBELLE_FORMAT[format] + suite };
}

// Détection par longueur, pour la saisie manuelle du web : 13 → EAN-13,
// 12 → UPC-A, 11 → UPC-B, 8 → EAN-8 puis UPC-E (ambiguïté que lève le type
// renvoyé par la caméra quand on est côté natif).
export function detecterFormat(chiffres: string): Detection {
  if (chiffres.length === 13) return assumerFormat('ean13', chiffres);
  if (chiffres.length === 12) return assumerFormat('upc_a', chiffres);
  if (chiffres.length === 11) return assumerFormat('upc_b', chiffres);
  if (chiffres.length === 8) {
    // 8 chiffres peuvent être un EAN-8 ou un UPC-E affiché (ambiguïté que lève
    // le type renvoyé par le scanneur caméra côté natif). Quand les DEUX clés
    // passent, les chiffres eux-mêmes sont identiques : on signale la confusion.
    const ean8 = verifierCode(chiffres, 'ean8');
    const upcE = verifierCode(chiffres, 'upc_e');
    if (ean8 && upcE) {
      return {
        format: 'ean8',
        valide: true,
        libelle: 'EAN-8 ou UPC-E — code valide (formats confondus)',
      };
    }
    if (ean8) return assumerFormat('ean8', chiffres);
    if (upcE) return assumerFormat('upc_e', chiffres);
    return {
      format: null,
      valide: false,
      libelle: 'EAN-8 ou UPC-E — clé de contrôle invalide',
    };
  }
  return {
    format: null,
    valide: false,
    libelle: `${chiffres.length} chiffres — format non géré`,
  };
}
