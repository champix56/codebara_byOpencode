import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Bande publicitaire de la fenêtre principale : un emplacement à hauteur stable
// est réservé dans la partie basse de l'écran — la carte se reformate au-dessus.
// En attendant le serveur (future source des visuels publicitaires), le bandeau
// affiche un simple emplacement discret ; son contenu sera branché plus tard.
export default function BandeauPub() {
  const insets = useSafeAreaInsets();
  const hauteur = 52 + insets.bottom;

  return (
    <View style={[styles.bandeau, { height: hauteur }]}>
      <Text style={styles.libelle}>Espace publicitaire</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bandeau: {
    backgroundColor: '#f7f8fa',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e3e6ea',
    alignItems: 'center',
  },
  libelle: {
    marginTop: 17,
    fontSize: 12,
    letterSpacing: 0.5,
    color: '#9aa3ab',
  },
});
