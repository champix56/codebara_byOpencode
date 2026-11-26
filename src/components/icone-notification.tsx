import { View, StyleSheet } from 'react-native';

// Icônes de la Poste (v0.0.19) : œuf pour une carte générée, croix rouge pour
// un échec. Dessinées en vues natives : aucune image ni dépendance supplémentaire.
export default function IconeNotification({ echec }: { echec: boolean }) {
  if (echec) {
    return (
      <View style={[styles.cercle, styles.cercleEchec]} accessibilityLabel="Échec de génération">
        <View style={[styles.barre, styles.barreUn]} />
        <View style={[styles.barre, styles.barreDeux]} />
      </View>
    );
  }
  return (
    <View style={styles.oeuf} accessibilityLabel="Carte générée">
      <View style={styles.oeufHaut} />
      <View style={styles.tache} />
    </View>
  );
}

const TAILLE = 26;
const styles = StyleSheet.create({
  cercle: {
    width: TAILLE,
    height: TAILLE,
    borderRadius: TAILLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cercleEchec: { backgroundColor: '#ffebee', borderWidth: 1, borderColor: '#c62828' },
  barre: { position: 'absolute', width: 14, height: 3, borderRadius: 2, backgroundColor: '#c62828' },
  barreUn: { transform: [{ rotate: '45deg' }] },
  barreDeux: { transform: [{ rotate: '-45deg' }] },
  oeuf: {
    width: 20,
    height: TAILLE,
    borderRadius: 10,
    backgroundColor: '#fff8e1',
    borderWidth: 1,
    borderColor: '#f9a825',
    overflow: 'hidden',
  },
  oeufHaut: {
    position: 'absolute',
    top: -8,
    left: -3,
    width: 26,
    height: 22,
    borderRadius: 13,
    backgroundColor: '#ffffff',
  },
  tache: {
    position: 'absolute',
    top: 13,
    left: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f9a825',
  },
});
