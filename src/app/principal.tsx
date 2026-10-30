import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import BandeauPub from '../components/bandeau-pub';
import CarteInteractive from '../components/carte-interactive';
import MenuLateral from '../components/menu-lateral';

// Les routes existant derrière les data-action du SVG — sert aussi de garde-fou :
// une data-action encore sans fenêtre est ignorée au lieu de faire planter la navigation.
const ROUTES_ZONES: Record<string, '/usine' | '/maison' | '/boutique' | '/arene'> = {
  usine: '/usine',
  maison: '/maison',
  boutique: '/boutique',
  arene: '/arene',
};

// Fenêtre principale : la carte SVG (../img2.svg) occupe l'écran et les images
// portant un data-action sont taponables — chacune ouvre sa fenêtre dédiée. La barre
// de navigation porte le titre « CodEbara » et le bouton du menu latéral (usine,
// maison, boutique, arène + déconnexion). Un bandeau publicitaire est réservé en bas.
export default function PrincipalScreen() {
  const [menuOuvert, setMenuOuvert] = useState(false);

  return (
    <View style={styles.plein}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'CodEbara',
          // Entrée par router.replace depuis la connexion : pas de retour arrière
          // vers la connexion (ni chevron, ni geste de balayage iOS).
          headerBackVisible: false,
          gestureEnabled: false,
          headerLeft: () => (
            <Pressable hitSlop={12} onPress={() => setMenuOuvert(true)} accessibilityLabel="Ouvrir le menu">
              <Text style={styles.burger}>☰</Text>
            </Pressable>
          ),
        }}
      />
      <CarteInteractive
        onPressZone={(action) => {
          const route = ROUTES_ZONES[action];
          if (route) router.push(route);
        }}
      />
      <BandeauPub />
      <MenuLateral ouvert={menuOuvert} onFermer={() => setMenuOuvert(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  plein: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  burger: {
    fontSize: 22,
    color: '#1f2937',
    paddingHorizontal: 4,
  },
});
