import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

// Tâches de chargement factices : 2 s chacune, dans l'ordre.
const TASKS = ['auto-connexion', 'recuperation de la collection'] as const;
const TASK_DURATION_MS = 2000;
const TICK_MS = 50;
const TOTAL_MS = TASKS.length * TASK_DURATION_MS;

export default function ChargementScreen() {
  const [progress, setProgress] = useState(0);
  const navigated = useRef(false);

  useEffect(() => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setProgress(Math.min(1, elapsed / TOTAL_MS));
      if (elapsed >= TOTAL_MS && !navigated.current) {
        navigated.current = true;
        clearInterval(interval);
        router.replace('/login');
      }
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const percent = Math.round(progress * 100);
  const task = TASKS[Math.min(TASKS.length - 1, Math.floor(progress * TASKS.length))];

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
        <Text style={styles.taskLabel}>{task}…</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>
      </View>
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
