import { StyleSheet, Text, View } from 'react-native';

// Fenêtre « vierge » temporaire : le contenu réel arrivera plus tard (branchement
// serveur). La barre de navigation native (titre + bouton retour) gère la
// navigation, y compris sur le web.
export default function FenetreVierge() {
  return <View style={styles.plein} >
     <Text style={styles.titre}>En construction ...</Text>
  </View>;
}

const styles = StyleSheet.create({
  plein: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  titre: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 18,
    marginBottom: 18,
    textAlign:'center'
  }
});
