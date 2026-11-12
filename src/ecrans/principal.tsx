import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BandeauPub from '../components/bandeau-pub';
import CarteInteractive from '../components/carte-interactive';
import EnteteEcran from '../components/entete-ecran';
import MenuLateral from '../components/menu-lateral';
import { naviguer, type Fenetre } from '../navigation/navigateur';

// Les fenêtres existant derrière les data-action du SVG — sert aussi de
// garde-fou : une data-action encore sans fenêtre est ignorée au lieu de
// faire planter la navigation.
const ZONES: Record<string, Fenetre> = {
  usine: { nom: 'usine' },
  maison: { nom: 'maison' },
  boutique: { nom: 'boutique' },
  arene: { nom: 'arene' },
};

// Fenêtre principale : la carte SVG (../img2.svg) occupe l'écran et les images
// portant un data-action sont taponables — chacune ouvre sa fenêtre dédiée. La
// barre d'en-tête porte le titre « CodEbara » et le bouton du menu latéral
// (usine, maison, boutique, arène + déconnexion). Un bandeau publicitaire est
// réservé en bas. Aucun retour en arrière : hub du jeu, entrée par remplacement.
export default function Principal() {
  const [menuOuvert, setMenuOuvert] = useState(false);

  return (
    <View style={styles.plein}>
      <EnteteEcran
        titre="CodEbara"
        gauche={
          <Pressable
            hitSlop={12}
            onPress={() => setMenuOuvert(true)}
            accessibilityLabel="Ouvrir le menu"
          >
            <Text style={styles.burger}>☰</Text>
          </Pressable>
        }
      />
      <CarteInteractive
        onPressZone={(action) => {
          const fenetre = ZONES[action];
          if (fenetre) naviguer(fenetre);
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
    paddingHorizontal: 12,
  },
});
