import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  ErreurSession,
  listerCartesAmi,
  type CarteAmi,
} from '../services/api';
import { encoderBase64 } from '../utils/base64';
import {
  cdzDepuisBase64,
  extraireApercu,
  ouvrirCdz,
  type ApercuCarte,
  type Cdz,
} from '../utils/cdz';
import IncrustationNomCarte from './incrustation-nom-carte';
import VisuelCarte from './visuel-carte';

// Maison d'un AMI visitée — LECTURE SEULE (décision owner 2026-11-19).
//
// Les archives .cdz viennent de `GET /friend/{id}/cards` (contrat §5.12) et
// sont décodées EN MÉMOIRE : `extraireApercu` pour la grille, `ouvrirCdz`
// (checksum cardHash) pour le détail 3D. Aucune écriture, jamais :
//   - PAS de `lireCarteLocale` / `enregistrerCarte` (services/collection.ts) ;
//   - PAS de `majIndex` (index local des noms) ;
//   - PAS de `telechargerCarte` (GET /card/{id}, réservé au propriétaire) ;
//   - PAS de `renommerCarte` (PUT /card/name) ni d'aucune autre action d'écriture.
// À la fermeture de la fenêtre, le composant est démonté et le GC libère les
// octets : rien ne survit à la visite.
//
// La maison de la recherche générale n'ouvre PAS cette fenêtre : seul l'onglet
// « Amis » (amis validés) appelle `naviguer({ nom: 'maison-visite', … })`.

type Apercu = {
  image: string;
  datas: ApercuCarte['datas'];
  deck: ApercuCarte['deck'];
};

type EtatListe =
  | { phase: 'chargement' }
  | { phase: 'pret' }
  | { phase: 'vide' }
  | { phase: 'erreur'; message: string };

type Detail = { carte: CarteAmi; cdz: Cdz } | null;

const COLONNES = Platform.OS === 'web' ? 4 : 3;

export default function MaisonVisiteEcran({
  amiId,
  nickname,
}: {
  amiId: number;
  nickname: string;
}) {
  const [etat, definirEtat] = useState<EtatListe>({ phase: 'chargement' });
  const [cartes, definirCartes] = useState<CarteAmi[]>([]);
  const [apercus, definirApercus] = useState<Record<number, Apercu>>({});
  // Archives décodées conservées en mémoire le temps de la visite : le détail
  // réutilise les octets déjà reçus (aucun second appel réseau, aucun fichier).
  const octetsRef = useRef<Map<number, Uint8Array>>(new Map());
  const [detail, definirDetail] = useState<Detail>(null);
  const [detailErreur, definirDetailErreur] = useState<string | null>(null);
  const [largeurGrille, definirLargeurGrille] = useState(0);
  const dimensions = useWindowDimensions();

  // Taille du visuel 3D : même budget que le détail propriétaire — tient dans
  // l'écran sur mobile (perso/infos en haut, vitrine ~2,5× sa largeur).
  const largeurVisuel = Math.max(
    120,
    Math.min(
      200,
      Math.round(dimensions.width * 0.42),
      Math.round((dimensions.height * 0.45) / 2.5),
    ),
  );

  const charger = useCallback(async () => {
    definirEtat({ phase: 'chargement' });
    definirDetail(null);
    definirDetailErreur(null);
    definirApercus({});
    try {
      const liste = await listerCartesAmi(amiId);
      definirCartes(liste);
      definirEtat(liste.length === 0 ? { phase: 'vide' } : { phase: 'pret' });
    } catch (erreur) {
      if (erreur instanceof ErreurSession) {
        // Session morte : le service a déjà redirigé vers la connexion.
        return;
      }
      definirEtat({ phase: 'erreur', message: (erreur as Error).message });
    }
  }, [amiId]);

  useEffect(() => {
    // Un seul chargement à l'ouverture (appels protégés sérialisés par api.ts).
    (async () => charger())();
  }, [charger]);

  // Aperçus : décodage séquentiel des archives reçues, une à une pour ne pas
  // bloquer le thread UI. Annulé au démontage ou au rechargement de la liste.
  useEffect(() => {
    let annule = false;
    (async () => {
      for (const carte of cartes) {
        if (annule) return;
        try {
          const octets = cdzDepuisBase64(carte.cardBase64);
          const apercu = await extraireApercu(octets);
          if (annule) return;
          octetsRef.current.set(carte.id, octets);
          definirApercus((actuels) => ({
            ...actuels,
            [carte.id]: {
              image: `data:image/png;base64,${encoderBase64(apercu.front)}`,
              datas: apercu.datas,
              deck: apercu.deck,
            },
          }));
        } catch {
          // Archive illisible : la carte reste affichée par son numéro.
        }
      }
    })();
    return () => {
      annule = true;
    };
  }, [cartes]);

  const ouvrirDetail = async (carte: CarteAmi) => {
    definirDetailErreur(null);
    const octets = octetsRef.current.get(carte.id);
    if (!octets) {
      definirDetailErreur('Archive indisponible en mémoire — rouvre la maison.');
      return;
    }
    try {
      // Validation complète (sha256 == cardHash §6.3) SUR LES OCTETS DÉJÀ EN
      // MÉMOIRE : aucun téléchargement, aucune écriture locale.
      const cdz = await ouvrirCdz(octets, carte.cardHash ?? undefined);
      definirDetail({ carte, cdz });
    } catch (erreur) {
      definirDetailErreur((erreur as Error).message);
    }
  };

  // ── Détail d'une carte visitée (aperçu 3D, strictement en lecture seule) ──
  if (detail) {
    const { carte, cdz } = detail;
    const nom = cdz.datas.name && cdz.datas.name.length > 0 ? cdz.datas.name : `Carte #${carte.id}`;
    const perso = `data:image/png;base64,${encoderBase64(cdz.perso)}`;
    return (
      <ScrollView style={styles.plein} contentContainerStyle={styles.contenuDetail}>
        <Pressable style={styles.retour} onPress={() => definirDetail(null)}>
          <Text style={styles.retourTexte}>‹ Retour à la maison de {nickname}</Text>
        </Pressable>
        <Text style={styles.badgeLectureSeule}>Visite en lecture seule</Text>

        <Image source={{ uri: perso }} style={styles.perso} resizeMode="contain" />
        <Text style={styles.nomDetail} numberOfLines={1}>{nom}</Text>
        <Text style={styles.numeroDetail}>#{carte.id}</Text>

        <VisuelCarte cdz={cdz} largeur={largeurVisuel} />

        <View style={styles.stats}>
          <Text style={styles.statLigne}>
            Puissance : {cdz.datas.power ?? carte.cardpower ?? '—'}
          </Text>
          <Text style={styles.statLigne}>
            Santé : {cdz.datas.health ?? carte.health ?? '—'}
          </Text>
          <Text style={styles.statLigne}>
            Attaque : {cdz.datas.attack ?? carte.attack ?? '—'}
          </Text>
          <Text style={styles.statLigne}>Rareté : {cdz.datas.rarity ?? '—'}</Text>
          <Text style={styles.statLigne}>
            Saison : {cdz.datas.saison ?? cdz.datas.seasonid ?? '—'}
          </Text>
        </View>

        {cdz.datas.specials.length > 0 && (
          <View style={styles.specials}>
            <Text style={styles.titreSpecials}>Capacités spéciales</Text>
            {cdz.datas.specials.map((special, index) => (
              <Text key={index} style={styles.special}>
                {`• ${special.name ?? '—'} — attaque ${special.attack ?? '—'}, santé ${special.health ?? '—'}, ${special.turn ?? '—'} tour(s)`}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  // ── Grille de la maison visitée ──────────────────────────────────────────
  return (
    <ScrollView style={styles.plein} contentContainerStyle={styles.contenu}>
      <View style={styles.banderole}>
        <Text style={styles.titre}>Maison de {nickname}</Text>
        <Text style={styles.lectureSeule}>
          Visite en lecture seule — aucune carte ne peut être modifiée.
        </Text>
      </View>

      {etat.phase === 'chargement' && (
        <Text style={styles.texteState}>Chargement des cartes de {nickname}…</Text>
      )}
      {etat.phase === 'vide' && (
        <Text style={styles.texteState}>{nickname} n&apos;a pas encore de carte.</Text>
      )}
      {etat.phase === 'erreur' && (
        <View style={styles.blocErreur}>
          <Text style={styles.erreur}>{etat.message}</Text>
          <Pressable style={styles.bouton} onPress={charger}>
            <Text style={styles.boutonTexte}>Réessayer</Text>
          </Pressable>
        </View>
      )}
      {detailErreur && <Text style={styles.erreur}>{detailErreur}</Text>}

      {etat.phase === 'pret' && (
        <View
          style={styles.grille}
          onLayout={(evenement) => definirLargeurGrille(evenement.nativeEvent.layout.width)}
        >
          {cartes.map((carte) => {
            const apercu = apercus[carte.id];
            const nom = apercu?.datas.name ?? '';
            const libelle = nom !== '' ? nom : `Carte #${carte.id}`;
            const puissance = apercu?.datas.power ?? carte.cardpower ?? '—';
            const sante = apercu?.datas.health ?? carte.health ?? '—';
            const attaque = apercu?.datas.attack ?? carte.attack ?? '—';
            const largeurCarte = largeurGrille / COLONNES - 8;
            return (
              <View key={carte.id} style={[styles.cellule, { width: `${100 / COLONNES}%` }]}>
                <Pressable
                  style={({ pressed }) => [styles.carteCell, pressed && styles.carteCellAppuyee]}
                  onPress={() => ouvrirDetail(carte)}
                  accessibilityLabel={`Voir ${libelle} sans le modifier`}
                >
                  <View style={styles.cadre}>
                    {apercu ? (
                      <>
                        <Image source={{ uri: apercu.image }} style={styles.front} resizeMode="contain" />
                        <IncrustationNomCarte
                          position={apercu.deck?.nom ?? null}
                          repere={apercu.deck?.repere ?? 600}
                          hauteurRepere={apercu.deck?.hauteurRepere ?? 1037}
                          nom={libelle}
                          largeurCarte={largeurCarte}
                        />
                      </>
                    ) : (
                      <Text style={styles.sansApercu}>#{carte.id}</Text>
                    )}
                  </View>
                  <Text style={styles.cellNom} numberOfLines={1}>{libelle}</Text>
                  <Text style={styles.cellStats} numberOfLines={1}>
                    P {puissance} · S {sante} · A {attaque}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  plein: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contenu: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 40,
  },
  contenuDetail: {
    alignItems: 'center',
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  banderole: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 560,
    marginBottom: 18,
  },
  titre: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  lectureSeule: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 6,
  },
  badgeLectureSeule: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9a6700',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  texteState: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 12,
  },
  erreur: {
    fontSize: 14,
    color: '#c62828',
    textAlign: 'center',
    marginTop: 12,
  },
  blocErreur: {
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  bouton: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#43a047',
    paddingHorizontal: 32,
  },
  boutonTexte: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  grille: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  cellule: {
    paddingHorizontal: 4,
  },
  carteCell: {
    borderRadius: 12,
    padding: 4,
    backgroundColor: 'transparent',
  },
  carteCellAppuyee: {
    backgroundColor: '#e8f5e9',
  },
  cadre: {
    width: '100%',
    aspectRatio: 600 / 1037,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  front: {
    width: '100%',
    height: '100%',
  },
  sansApercu: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
  },
  cellNom: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 6,
  },
  cellStats: {
    fontSize: 12,
    color: '#374151',
    marginTop: 2,
  },
  retour: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  retourTexte: {
    fontSize: 15,
    color: '#2563eb',
  },
  perso: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
  },
  nomDetail: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  numeroDetail: {
    fontSize: 12,
    color: '#9ca3af',
  },
  stats: {
    width: '100%',
    maxWidth: 420,
    gap: 4,
  },
  statLigne: {
    fontSize: 14,
    color: '#374151',
  },
  specials: {
    width: '100%',
    maxWidth: 420,
    gap: 4,
  },
  titreSpecials: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  special: {
    fontSize: 13,
    color: '#374151',
  },
});
