import {
  ErreurSession,
  listerCartes,
  telechargerCarte,
  verifierChecksumCarte,
  type CarteListee,
} from './api';
import {
  enregistrerCarte,
  lireCarteLocale,
  majIndex,
  supprimerCarte,
} from './collection';
import { cdzDepuisBase64, hacherOctets, ouvrirCdz } from '../utils/cdz';

// Vérification + remplissage du stockage local des .cdz (exigence produit
// 2026-11-17 — remplace la comparaison offline cardHash par l'endpoint dédié
// GET /card/check §5.6), exécutée après une authentification réussie —
// auto-connexion du splash ou bouton « Connexion » (les deux passent par la
// fenêtre chargement) :
//
//  1) GET /card (§5.4) : liste des cartes de l'utilisateur (ids + cardHash) ;
//  2) pour chaque carte PRÉSENTE en stockage local : sha256 de l'archive
//     COMPLÈTE vérifié contre le serveur via /card/check. Bon → l'archive
//     reste ; Mauvais → l'archive locale est SUPPRIMÉE, l'utilisateur est
//     averti d'une carte corrompue et le parcours passe à la suivante (sans
//     pause ni décision utilisateur) ;
//  3) pour chaque carte ABSENTE du stockage : GET /card/{id} (§5.5),
//     stockage local immédiat, puis vérification du checksum du fichier
//     stocké via /card/check (bon téléchargement garanti) — mauvais →
//     suppression + avertissement, comme ci-dessus.
//
// La validation interne (signature ZIP + hashs.json §6.3) reste en place :
// gratuite et hors ligne, elle détecte une archive non conforme avant stockage.
// La progression est poussée à l'appelant (barre du splash) ; les cartes
// corrompues sont signalées en une fois à la fin (modal du splash).

export type PhaseVerification = 'verification' | 'telechargement';

export type CarteCorrompue = { carteId: number; raison: string };

export type RetoursVerification = {
  // Appelé UNE fois à la fin de la phase de vérification/téléchargement avec
  // la liste des cartes dont l'archive locale a été supprimée (checksum en
  // écart) — l'appelant avertit l'utilisateur (modal du splash).
  surCorrompues: (corrompues: CarteCorrompue[]) => void;
  // Progression d'une phase (faites / total) — pour l'affichage du splash.
  surProgression?: (phase: PhaseVerification, faites: number, total: number) => void;
};

export async function verifierEtRecuperer(
  idUser: number,
  retours: RetoursVerification,
): Promise<void> {
  const liste = await listerCartes();
  const aRecuperer: CarteListee[] = [];
  const corrompues: CarteCorrompue[] = [];

  // Vérification du stockage local : présence + sha256 complet contre le
  // serveur (/card/check). Écart = archive corrompue/modifiée → suppression
  // + avertissement, et la carte repart du serveur (sans pause, § produit).
  for (const [faites, carte] of liste.entries()) {
    retours.surProgression?.('verification', faites, liste.length);
    const locale = await lireCarteLocale(idUser, carte.id);
    if (!locale) {
      aRecuperer.push(carte); // jamais présente localement
      continue;
    }
    const empreinte = await hacherOctets(locale);
    let bonne = false;
    try {
      bonne = await verifierChecksumCarte(carte.id, empreinte);
    } catch (erreur) {
      // L'appel a échoué (panne réseau, session morte…) : on NE détruit PAS
      // sur un doute — l'erreur remonte à l'appelant (splash : Réessayer).
      throw erreur;
    }
    if (!bonne) {
      await supprimerCarte(idUser, carte.id);
      corrompues.push({
        carteId: carte.id,
        raison: `checksum local (${empreinte.slice(0, 10)}…) refusé par le serveur`,
      });
      aRecuperer.push(carte);
      continue;
    }
    // Checksum conforme : archive gardée en stockage local.
  }
  retours.surProgression?.('verification', liste.length, liste.length);

  // Remplissage des absentes/détruites : GET /card/{id} (§5.5), stockage
  // local immédiat, PUIS vérification serveur du checksum du fichier stocké
  // (/card/check) pour garantir le bon téléchargement. Mauvais → suppression
  // + avertissement (même traitement que le stockage existant).
  for (const [faites, carte] of aRecuperer.entries()) {
    retours.surProgression?.('telechargement', faites, aRecuperer.length);
    try {
      const telechargee = await telechargerCarte(carte.id);
      const octets = cdzDepuisBase64(telechargee.cardBase64);
      // Validation interne §6.3 (signature ZIP + hashs.json + checksum
      // global si cardHash) — une archive non conforme n'est PAS stockée.
      const cdz = await ouvrirCdz(octets, telechargee.cardHash ?? carte.cardHash ?? undefined);
      await enregistrerCarte(idUser, carte.id, octets);
      if (cdz.datas.name) {
        await majIndex(idUser, carte.id, cdz.datas.name, {
          id: cdz.datas.seasonid,
          nom: cdz.datas.saison,
        });
      }
      const bonneTelechargement = await verifierChecksumCarte(
        carte.id,
        await hacherOctets(octets),
      );
      if (!bonneTelechargement) {
        await supprimerCarte(idUser, carte.id);
        corrompues.push({
          carteId: carte.id,
          raison: 'téléchargement refusé par le serveur (checksum en écart)',
        });
      }
    } catch (erreur) {
      if (erreur instanceof ErreurSession) throw erreur;
      // Archive servie illisible/non conforme : stockage évité, avertissement
      // et poursuite (une carte ne doit pas bloquer la collection).
      await supprimerCarte(idUser, carte.id).catch(() => {});
      corrompues.push({
        carteId: carte.id,
        raison: (erreur as Error).message,
      });
    }
  }
  retours.surProgression?.('telechargement', aRecuperer.length, aRecuperer.length);
  retours.surCorrompues(corrompues);
}
