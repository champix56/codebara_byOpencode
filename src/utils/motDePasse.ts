// Règle de mot de passe appliquée CÔTÉ CLIENT (contrat §5.10 : le serveur
// reçoit le hash SHA256(mail+clair) et ne peut pas vérifier la complexité du
// clair — c'est donc au client de refuser une saisie non conforme avant de
// hacher). La règle de l'app est strictement plus exigeante que la référence
// serveur (« ≥ 7 car., majuscule + minuscule + spécial ») : elle ajoute le
// chiffre et une longueur > 7, ce qui reste compatible car le serveur ne
// contrôle que la forme du hash ([0-9a-f]{64}).

export type RegleMotDePasse = {
  id: string;
  libelle: string;
  passe: boolean;
};

export type EvaluationMotDePasse = {
  regles: RegleMotDePasse[];
  nbRespectees: number;
  toutesRespectees: boolean;
  // null tant que le champ est vide (pas de niveau affiché) ; sinon la
  // force déduite du nombre de règles respectées.
  niveau: 'faible' | 'moyen' | 'fort' | null;
};

const aMinuscule = /[a-z]/;
const aMajuscule = /[A-Z]/;
const aChiffre = /[0-9]/;

// « Caractère spécial » : ni lettre ASCII ni chiffre ASCII (!, ?, @, accent,
// espace… — la lettre accentuée compte ici comme spéciale, cas négligeable
// car le serveur ne vérifie pas la complexité, cf. en-tête).
function estSpecial(c: string): boolean {
  return !aMinuscule.test(c) && !aMajuscule.test(c) && !aChiffre.test(c);
}

export function evaluerMotDePasse(motDePasseClair: string): EvaluationMotDePasse {
  const caracteres = Array.from(motDePasseClair);
  const asMinuscule = caracteres.some((c) => aMinuscule.test(c));
  const asMajuscule = caracteres.some((c) => aMajuscule.test(c));
  const asChiffre = caracteres.some((c) => aChiffre.test(c));
  const asSpecial = caracteres.some((c) => estSpecial(c));
  const asLongueur = caracteres.length > 7;

  const regles: RegleMotDePasse[] = [
    { id: 'special', libelle: 'Un caractère spécial (!, ?, @…)', passe: asSpecial },
    { id: 'minuscule', libelle: 'Une minuscule', passe: asMinuscule },
    { id: 'majuscule', libelle: 'Une majuscule', passe: asMajuscule },
    { id: 'chiffre', libelle: 'Un chiffre', passe: asChiffre },
    { id: 'longueur', libelle: 'Plus de 7 caractères', passe: asLongueur },
  ];

  const nbRespectees = regles.filter((regle) => regle.passe).length;
  const vide = motDePasseClair.length === 0;

  return {
    regles,
    nbRespectees,
    toutesRespectees: nbRespectees === regles.length,
    niveau: vide
      ? null
      : nbRespectees >= 5
        ? 'fort'
        : nbRespectees >= 3
          ? 'moyen'
          : 'faible',
  };
}
