import { StyleSheet, Text, Pressable, View } from 'react-native';
import { router } from 'expo-router';

// Fenêtre « vierge » temporaire : le contenu réel arrivera plus tard (branchement serveur).
// Seul élément : le bouton discret de retour dans le coin haut-gauche, pour que la
// navigation reste possible (notamment sur le web, où il n'y a pas de geste retour).
export default function FenetreVierge() {
  return (
    <View style={styles.plein}>
      <Pressable style={styles.retour} hitSlop={12} onPress={() => router.back()}>
        <Text style={styles.chevron}>←</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  plein: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  retour: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    fontSize: 22,
    fontWeight: '600',
    color: '#43a047',
  },
});
