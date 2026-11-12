import {
  listerCartes,
  telechargerCarte,
  type CarteListee,
} from './api';
import {
  enregistrerCarte,
  lireCarteLocale,
  majIndex,
  supprimerCarte,
} from './collection';
import { cdzDepuisBase64, hacherOctets, ouvrirCdz } from '../utils/cdz';

// Vérification de la collection locale contre le serveur (décision produit
// 2026-11-12), exécutée après une authentification réussie — auto-connexion
// du splash ou bouton « Connexion » (les deux passent par la fenêtre
// chargement) :
//
//  1) GET /card (§5.4) : liste des cartes de l'utilisateur (ids + cardHash) ;
//  2) pour chaque carte PRÉSENTE en cache local : sha256(archive) comparé au
//     cardHash du serveur. Égalité → l'archive est saine, elle reste en cache ;
//     écart → archive corrompue ou modifiée : l'appelant affiche la modal de
//     destruction (unique action possible), puis l'archive locale est
//     supprimée ;
//  3) en fin de course, seules les cartes ABSENTES (ou détruites) sont
//     re-téléchargées — GET /card/{id} (§5.5), validation complète §6.3
//     (sha256 == cardHash) avant stockage + maj de l'index du nom.
//
// La progression est poussée à l'appelant (barre du splash) : phase de
// vérification puis phase de téléchargement.

export type PhaseVerification = 'verification' | 'telechargement';

export type RetoursVerification = {
  // Écart de hash sur une carte locale : la promesse est résolue par l'appelant
  // APRÈS la destruction (modal, décision utilisateur obligatoire) — le parcours
  // est suspendu jusque-là.
  surEcartHash: (carteId: number, raison: string) => Promise<void>;
  // Progression d'une phase (faites / total) — pour l'affichage du splash.
  surProgression?: (phase: PhaseVerification, faites: number, total: number) => void;
};

export async function verifierEtRecuperer(
  idUser: number,
  retours: RetoursVerification,
): Promise<void> {
  const liste = await listerCartes();
  const aRecuperer: CarteListee[] = [];

  // Vérification du cache local (présence + hash).
  for (const [faites, carte] of liste.entries()) {
    retours.surProgression?.('verification', faites, liste.length);
    const locale = await lireCarteLocale(idUser, carte.id);
    if (!locale) {
      aRecuperer.push(carte); // jamais présente localement
      continue;
    }
    if (carte.cardHash) {
      const empreinte = await hacherOctets(locale);
      if (empreinte !== carte.cardHash) {
        // Archive corrompue/modifiée : la modal de l'appelant exige la
        // destruction (unique action) ; la carte repart du serveur ensuite.
        await retours.surEcartHash(
          carte.id,
          `Hash de l'archive locale (${empreinte.slice(0, 10)}…) différent du hash serveur (${carte.cardHash.slice(0, 10)}…) — archive corrompue ou modifiée.`,
        );
        await supprimerCarte(idUser, carte.id);
        aRecuperer.push(carte);
        continue;
      }
    }
    // Hash conforme (ou hash serveur absent, non comparable) : archive gardée.
  }
  retours.surProgression?.('verification', liste.length, liste.length);

  // Re-téléchargement des absentes/détruites uniquement — validation §6.3
  // avant stockage, puis maj de l'index du nom (datas.json, §6.6).
  for (const [faites, carte] of aRecuperer.entries()) {
    retours.surProgression?.('telechargement', faites, aRecuperer.length);
    const telechargee = await telechargerCarte(carte.id);
    const octets = cdzDepuisBase64(telechargee.cardBase64);
    const cdz = await ouvrirCdz(octets, telechargee.cardHash ?? carte.cardHash ?? undefined);
    await enregistrerCarte(idUser, carte.id, octets);
    if (cdz.datas.name) await majIndex(idUser, carte.id, cdz.datas.name);
  }
  retours.surProgression?.('telechargement', aRecuperer.length, aRecuperer.length);
}
