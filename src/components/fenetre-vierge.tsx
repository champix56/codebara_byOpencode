import { StyleSheet, View } from 'react-native';

// Fenêtre « vierge » temporaire : le contenu réel arrivera plus tard (branchement
// serveur). La barre de navigation native (titre + bouton retour) gère la
// navigation, y compris sur le web.
export default function FenetreVierge() {
  return <View style={styles.plein} />;
}

const styles = StyleSheet.create({
  plein: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
