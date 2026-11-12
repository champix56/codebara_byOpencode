import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { remplacer } from '../navigation/navigateur';
import { authentifierParTokens, ErreurSession } from '../services/api';
import { supprimerCarte } from '../services/collection';
import {
  verifierEtRecuperer,
  type PhaseVerification,
} from '../services/verification';
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
//    cartes ».
//
// Après la connexion : vérification de la collection (§5.4 + cache local,
// cf. services/verification.ts) sous le libellé « récupération des cartes » —
// les cartes dont le hash local diffère du serveur ouvrent une MODAL
// (carte par défaut + raison + unique bouton Détruire) ; la destruction
// supprime l'archive locale et la carte est re-téléchargée avec les absentes.
// Succès complet → fenêtre principale.
type Mode = 'auto' | 'post-connexion';

type Props = { mode?: Mode };

// Écart de hash en attente de décision : carte + raison + action unique.
type Ecart = { carteId: number; raison: string; surDetruire: () => void };

// Temps minimal d'affichage d'un libellé (lisibilité des étapes du splash).
const PAUSE_ETAPE_MS = 900;

export default function Chargement({ mode = 'auto' }: Props) {
  const dispatcher = useAppDispatch();
  const [libelle, definirLibelle] = useState(
    mode === 'post-connexion' ? 'connexion' : 'tentative de connexion auto',
  );
  const [progression, definirProgression] = useState<{
    phase: PhaseVerification;
    faites: number;
    total: number;
  } | null>(null);
  const [fraction, definirFraction] = useState(0.1);
  const [ecart, definirEcart] = useState<Ecart | null>(null);
  const [erreur, definirErreur] = useState<string | null>(null);

  // Un seul lancement automatique ; « Réessayer » relance le même parcours.
  const lancementRef = useRef(false);

  const lancer = useCallback(async () => {
    definirErreur(null);
    definirProgression(null);
    definirFraction(0.1);

    // ── Étape 1 : connexion ────────────────────────────────────────────────
    definirLibelle(mode === 'post-connexion' ? 'connexion' : 'tentative de connexion auto');
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
    } else if (!utilisateur.apiToken || !utilisateur.requestToken) {
      // Garde-fou : le mode post-connexion suppose une session toute fraîche.
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
    definirLibelle('récupération des cartes');
    const deplacement = (phase: PhaseVerification, faites: number, total: number) => {
      definirProgression({ phase, faites, total });
      const part = total > 0 ? faites / total : 1;
      definirFraction(phase === 'verification' ? 0.35 + part * 0.3 : 0.7 + part * 0.27);
    };
    try {
      await verifierEtRecuperer(idUser, {
        // Parcours suspendu jusqu'à la destruction confirmée dans la modal.
        surEcartHash: (carteId, raison) =>
          new Promise<void>((resoudre) => {
            definirEcart({
              carteId,
              raison,
              surDetruire: async () => {
                definirEcart(null);
                try {
                  await supprimerCarte(idUser, carteId);
                } finally {
                  resoudre();
                }
              },
            });
          }),
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
    definirFraction(1);
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

      {/* Modal d'écart de hash — carte par défaut + raison + UNIQUE bouton
          destruction (décision produit 2026-11-12) : l'archive locale est
          corrompue/modifiée, rien d'autre n'est possible. */}
      <Modal visible={ecart !== null} animationType="fade" transparent>
        <View style={styles.voile}>
          <View style={styles.cadre}>
            <View style={styles.carteDefaut}>
              <Text style={styles.carteDefautSymbole}>⚠</Text>
              <Text style={styles.carteDefautId}>
                {ecart ? `Carte #${ecart.carteId}` : ''}
              </Text>
            </View>
            <Text style={styles.cadreTitre}>Carte corrompue</Text>
            <Text style={styles.cadreRaison}>{ecart?.raison}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.boutonDetruire,
                pressed && styles.boutonDetruireAppuye,
              ]}
              onPress={() => ecart?.surDetruire()}
            >
              <Text style={styles.boutonTexte}>Détruire</Text>
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
