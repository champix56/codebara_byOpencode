import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import CarteInteractive from '../components/carte-interactive';

// Les routes existant derrière les data-action du SVG — sert aussi de garde-fou :
// une data-action encore sans fenêtre est ignorée au lieu de faire planter la navigation.
const ROUTES_ZONES: Record<string, '/usine' | '/maison' | '/boutique' | '/arene'> = {
  usine: '/usine',
  maison: '/maison',
  boutique: '/boutique',
  arene: '/arene',
};

// Fenêtre principale : affiche la carte SVG (../img2.svg) en plein écran et rend les
// images portant un data-action taponables — chacune ouvre sa fenêtre dédiée.
export default function PrincipalScreen() {
  return (
    <View style={styles.plein}>
      <CarteInteractive
        onPressZone={(action) => {
          const route = ROUTES_ZONES[action];
          if (route) router.push(route);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  plein: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
