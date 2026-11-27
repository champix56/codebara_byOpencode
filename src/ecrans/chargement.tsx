import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { remplacer } from '../navigation/navigateur';
import { authentifierParTokens, ErreurSession } from '../services/api';
import {
  verifierEtRecuperer,
  type CarteCorrompue,
  type PhaseVerification,
} from '../services/verification';
import { chargerSaisonAffichage, type OrigineSaison } from '../services/saison';
import { useAppDispatch } from '../store/hooks';
import { store } from '../store/store';
import { seConnecter, seDeconnecter } from '../store/utilisateur';

// Fenêtre de chargement — l'ENTRÉE de l'application : toujours la première
// fenêtre de la pile (aucune URL ne peut sélectionner autre chose). Après
// l'hydratation du store (PersistGate : montée seulement une fois rehydrated),
// deux modes :
//
//  - 'auto' (démarrage) : tentative de connexion automatique par tokens
//    persistés — libellé « tentative de connexion auto » dans le splash ;
//    échec ou refus → fenêtre connexion.
//  - 'post-connexion' (bouton Connexion de la fenêtre connexion) : le splash
//    est remis, étape « connexion » (déjà validée) puis « récupération des
//    cartes » ;
//  - 'debug' (bouton GOD) : session locale sans tokens, on saute la connexion
//    et la récupération des cartes, mais PAS l'étape saison (surtout sur web).
//
// Après la connexion : vérification + remplissage du stockage local des .cdz
// (exigence produit 2026-11-17, cf. services/verification.ts) sous le libellé
// « récupération des cartes » — chaque archive locale est vérifiée contre le
// serveur (GET /card/check) ; les archives corrompues sont supprimées
// automatiquement et re-téléchargées. À la fin, la modal du splash liste les
// cartes corrompues (unique bouton OK — l'utilisateur est averti, aucune
// action n'est requise de sa part). Puis étape « saison d'affichage »
// (.cds local vérifié via /season/check ou GET /season — repli saison
// embarquée, cf. services/saison.ts). Succès complet → fenêtre principale.
type Mode = 'auto' | 'post-connexion' | 'debug';

type Props = { mode?: Mode };

// Cartes corrompues à annoncer dans la modal finale (id + raison).
type AnnonceCorrompues = CarteCorrompue[];

// Temps minimal d'affichage d'un libellé (lisibilité des étapes du splash).
const PAUSE_ETAPE_MS = 900;

// Web : la saison du serveur doit être complètement arrivée avant d'ouvrir la
// principale. On attend par petites passes (≈30 s au total) avant de proposer
// un bouton « Réessayer » — jamais de repli sur la saison embarquée ici.
const DELAI_ATTENTE_SAISON_MS = 3_000;
const TENTATIVES_SAISON_WEB = 10;

export default function Chargement({ mode = 'auto' }: Props) {
  const dispatcher = useAppDispatch();
  const [libelle, definirLibelle] = useState(
    mode === 'auto' ? 'tentative de connexion auto' : 'connexion',
  );
  const [progression, definirProgression] = useState<{
    phase: PhaseVerification;
    faites: number;
    total: number;
  } | null>(null);
  const [fraction, definirFraction] = useState(0.1);
  // Cartes corrompues annoncées en fin de parcours (modal unique, OK seul).
  const [corrompues, definirCorrompues] = useState<AnnonceCorrompues | null>(null);
  const [erreur, definirErreur] = useState<string | null>(null);

  // Un seul lancement automatique ; « Réessayer » relance le même parcours.
  const lancementRef = useRef(false);

  const lancer = useCallback(async () => {
    definirErreur(null);
    definirProgression(null);
    definirFraction(0.1);

    // ── Étape 1 : connexion ────────────────────────────────────────────────
    definirLibelle(mode === 'auto' ? 'tentative de connexion auto' : 'connexion');
    definirFraction(0.1);
    const debutEtape = Date.now();
    const utilisateur = store.getState().utilisateur;

    if (mode === 'auto') {
      if (!utilisateur.apiToken || !utilisateur.requestToken) {
        // Aucune session persistée : direction la connexion.
        remplacer({ nom: 'connexion' });
        return;
      }
      try {
        const donnees = await authentifierParTokens(
          utilisateur.apiToken,
          utilisateur.requestToken,
        );
        if (!donnees) {
          // Couple refusé (session morte) : purge des tokens périmés.
          dispatcher(seDeconnecter());
          remplacer({ nom: 'connexion' });
          return;
        }
        // Données fraîches + tokens conservés (aucune rotation sur cette route).
        dispatcher(
          seConnecter({
            idUser: donnees.id,
            nickname: donnees.nickname,
            mail: donnees.mail,
            amount: donnees.amount,
            avatar: donnees.avatar,
            hash: donnees.hash,
            apiToken: utilisateur.apiToken,
            requestToken: utilisateur.requestToken,
          }),
        );
      } catch {
        // Panne réseau : direction la connexion en attendant le serveur.
        remplacer({ nom: 'connexion' });
        return;
      }
    } else if (
      mode !== 'debug' &&
      (!utilisateur.apiToken || !utilisateur.requestToken)
    ) {
      // Garde-fou : le mode post-connexion suppose une session toute fraîche.
      // Le mode debug (GOD) n'a volontairement aucun token serveur.
      remplacer({ nom: 'connexion' });
      return;
    }

    const idUser = store.getState().utilisateur.idUser;
    if (idUser === null) {
      remplacer({ nom: 'connexion' });
      return;
    }
    // Lisibilité de l'étape de connexion avant la suite.
    const reste = PAUSE_ETAPE_MS - (Date.now() - debutEtape);
    if (reste > 0) await new Promise((r) => setTimeout(r, reste));

    // ── Étape 2 : récupération des cartes ─────────────────────────────────
    // Compte debug (GOD, sans tokens) : aucune carte serveur à récupérer.
    let corrompues: CarteCorrompue[] = [];
    if (mode !== 'debug') {
      definirLibelle('récupération des cartes');
      const deplacement = (phase: PhaseVerification, faites: number, total: number) => {
        definirProgression({ phase, faites, total });
        const part = total > 0 ? faites / total : 1;
        definirFraction(phase === 'verification' ? 0.35 + part * 0.3 : 0.7 + part * 0.27);
      };
      try {
        await verifierEtRecuperer(idUser, {
          // Les corrompues (supprimées + re-téléchargées par le service) sont
          // annoncées à la fin — le parcours ne s'arrête plus par carte.
          surCorrompues: (cartes) => {
            // On garde la liste mais on n'affiche la modal qu'APRÈS l'étape
            // saison : son bouton OK navigue vers la principale, qui doit rester
            // inaccessible sur le web tant que la saison serveur n'est pas là.
            corrompues = cartes;
          },
          surProgression: deplacement,
        });
      } catch (l_erreur) {
        if (l_erreur instanceof ErreurSession) {
          // Session morte pendant la vérification : le service a déjà réinitialisé
          // le store et déclenché la connexion — rien à afficher.
          return;
        }
        definirErreur((l_erreur as Error).message);
        return;
      }
    }
    // ── Étape 3 : saison d'affichage ──────────────────────────────────────
    // Lancée AVANT la modal des corrompues : celle-ci navigue directement vers
    // la fenêtre principale. Mobile : .cds local vérifié par /season/check,
    // avec repli embarqué sur incident (ne bloque JAMAIS la connexion).
    // Web : GET /season jusqu'à ce que la saison serveur soit complète —
    // `chargerSaisonAffichage` lève sinon, et on attend sans jamais ouvrir la
    // principale avec le décor de secours.
    definirLibelle('saison d\'affichage');
    definirFraction(0.98);
    if (Platform.OS === 'web') {
      let origine: OrigineSaison | null = null;
      for (let tentative = 0; tentative < TENTATIVES_SAISON_WEB; tentative++) {
        try {
          origine = await chargerSaisonAffichage();
          if (origine === 'serveur') break;
        } catch {
          origine = null;
        }
        if (tentative < TENTATIVES_SAISON_WEB - 1) {
          definirLibelle('attente de la saison');
          await new Promise((r) => setTimeout(r, DELAI_ATTENTE_SAISON_MS));
        }
      }
      if (origine !== 'serveur') {
        definirErreur('La saison n’est pas encore arrivée — réessaie dans un instant.');
        return;
      }
    } else {
      await chargerSaisonAffichage();
    }

    // Modal d'avertissement d'abord (OK = unique action), puis fenêtre
    // principale — sinon navigation directe.
    if (corrompues.length > 0) {
      definirCorrompues(corrompues);
      return;
    }
    remplacer({ nom: 'principal' });
  }, [dispatcher, mode]);

  useEffect(() => {
    if (lancementRef.current) return;
    lancementRef.current = true;
    (async () => lancer())();
  }, [lancer]);

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <View style={styles.loader}>
        <Text style={styles.taskLabel}>{libelle}…</Text>
        {progression && (
          <Text style={styles.progression}>
            {progression.faites}/{progression.total}
          </Text>
        )}
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(98, Math.round(fraction * 100))}%` }]} />
        </View>
        {erreur ? (
          <View style={styles.blocErreur}>
            <Text style={styles.erreur}>{erreur}</Text>
            <Pressable
              style={({ pressed }) => [styles.bouton, pressed && styles.boutonAppuye]}
              onPress={() => {
                lancementRef.current = false;
                (async () => lancer())();
              }}
            >
              <Text style={styles.boutonTexte}>Réessayer</Text>
            </Pressable>
          </View>
        ) : (
          <ActivityIndicator
            style={styles.tourneur}
            color="#43a047"
          />
        )}
      </View>

      {/* Modal d'avertissement des cartes corrompues (exigence produit
          2026-11-17) : les archives ont DÉJA été supprimées du stockage et
          re-téléchargées par le service — l'utilisateur n'est que prévenu
          (unique bouton OK), le splash ne navigue qu'après. */}
      <Modal visible={corrompues !== null} animationType="fade" transparent>
        <View style={styles.voile}>
          <View style={styles.cadre}>
            <View style={styles.carteDefaut}>
              <Text style={styles.carteDefautSymbole}>⚠</Text>
              <Text style={styles.carteDefautId}>
                {corrompues && corrompues.length === 1
                  ? `Carte #${corrompues[0].carteId}`
                  : `${corrompues?.length ?? 0} cartes`}
              </Text>
            </View>
            <Text style={styles.cadreTitre}>Carte(s) corrompue(s)</Text>
            <Text style={styles.cadreRaison}>
              {corrompues
                ?.map((c) => `#${c.carteId} — ${c.raison}`)
                .join('\n')}
              {'\n\n'}Elles ont été supprimées du stockage et re-téléchargées.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.boutonDetruire,
                pressed && styles.boutonDetruireAppuye,
              ]}
              onPress={() => {
                definirCorrompues(null);
                remplacer({ nom: 'principal' });
              }}
            >
              <Text style={styles.boutonTexte}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  logoWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 220,
    height: 220,
  },
  loader: {
    paddingBottom: 72,
    alignItems: 'center',
  },
  taskLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 6,
  },
  progression: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
  },
  track: {
    width: 240,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#43a047',
  },
  tourneur: {
    marginTop: 14,
  },
  blocErreur: {
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  erreur: {
    fontSize: 13,
    color: '#c62828',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  bouton: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#43a047',
    paddingHorizontal: 28,
  },
  boutonAppuye: {
    backgroundColor: '#3b8b40',
  },
  boutonTexte: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  voile: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cadre: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  carteDefaut: {
    width: 120,
    height: 120 * 1037 / 600,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  carteDefautSymbole: {
    fontSize: 28,
    color: '#c62828',
  },
  carteDefautId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  cadreTitre: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  cadreRaison: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  boutonDetruire: {
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c62828',
    alignSelf: 'stretch',
    marginTop: 6,
  },
  boutonDetruireAppuye: {
    backgroundColor: '#a51f1f',
  },
});
