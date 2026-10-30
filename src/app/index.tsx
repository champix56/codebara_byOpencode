import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { authentifierParTokens } from '../services/api';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { seConnecter, seDeconnecter } from '../store/utilisateur';

// Tâches affichées pendant le chargement (barre visuelle) ; la première est
// réelle : reprise de session par tokens (contrat §5.2b).
const TASKS = ['auto-connexion', 'recuperation de la collection'] as const;
const TASK_DURATION_MS = 2000;
const TICK_MS = 50;
const TOTAL_MS = TASKS.length * TASK_DURATION_MS;

export default function ChargementScreen() {
  const [progress, setProgress] = useState(0);
  const navigated = useRef(false);
  const dispatcher = useAppDispatch();
  const utilisateurCourant = useAppSelector((etat) => etat.utilisateur);

  useEffect(() => {
    const startedAt = Date.now();    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setProgress(Math.min(1, elapsed / TOTAL_MS));
      if (elapsed >= TOTAL_MS && !navigated.current) {
        navigated.current = true;
        clearInterval(interval);

        // Reprise de session : si des tokens serveur sont persistés, on tente
        // la validation (GET /user/auth par tokens) avant d'ouvrir l'app ;
        // sinon, ou session refusée, redirection vers la connexion.
        const { apiToken, requestToken } = utilisateurCourant;
        if (apiToken && requestToken) {
          authentifierParTokens(apiToken, requestToken)
            .then((donnees) => {
              if (donnees) {
                // Données fraîches + tokens conservés (aucune rotation ici).
                dispatcher(
                  seConnecter({
                    idUser: donnees.id,
                    nickname: donnees.nickname,
                    mail: donnees.mail,
                    amount: donnees.amount,
                    hash: donnees.hash,
                    apiToken,
                    requestToken,
                  }),
                );
                router.replace('/principal');
              } else {
                // Couple refusé (session morte) : purge des tokens périmés
                // puis connexion.
                dispatcher(seDeconnecter());
                router.replace('/login');
              }
            })
            .catch(() => {
              // Panne réseau : direction la connexion en attendant le serveur.
              router.replace('/login');
            });
        } else {
          router.replace('/login');
        }
      }
    }, TICK_MS);
    return () => clearInterval(interval);
    // Dépendances volontairement réduites : l'écran est monté une fois à froid,
    // après réhydratation de la persistance (PersistGate).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const percent = Math.round(progress * 100);
  const task = TASKS[Math.min(TASKS.length - 1, Math.floor(progress * TASKS.length))];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
      <View style={styles.logoWrap}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <View style={styles.loader}>
        <Text style={styles.taskLabel}>{task}…</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>
      </View>
      </View>
    </>
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
    marginBottom: 12,
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
});
