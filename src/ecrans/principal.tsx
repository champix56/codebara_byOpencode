import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BandeauPub from '../components/bandeau-pub';
import CarteInteractive from '../components/carte-interactive';
import EnteteEcran from '../components/entete-ecran';
import MenuLateral from '../components/menu-lateral';
import { naviguer, type Fenetre } from '../navigation/navigateur';
import { saisonAffichageCourante } from '../services/saison';

// Les fenêtres existant derrière les fenêtres nommées par le season.json —
// sert aussi de garde-fou : une fenêtre de saison encore sans correspondance
// est ignorée au lieu de faire planter la navigation.
const ZONES: Record<string, Fenetre> = {
  usine: { nom: 'usine' },
  maison: { nom: 'maison' },
  boutique: { nom: 'boutique' },
  arene: { nom: 'arene' },
};

// Fenêtre principale : la carte de la saison d'affichage (`.cds` chargé par le
// splash ou saison embarquée — cf. services/saison.ts) occupe l'écran et les
// bâtiments du season.json sont taponables — chacun ouvre sa fenêtre dédiée.
// La barre d'en-tête porte le titre « CodEbara » et le bouton du menu latéral
// (usine, maison, boutique, arène + déconnexion). Un bandeau publicitaire est
// réservé en bas. Aucun retour en arrière : hub du jeu, entrée par remplacement.
export default function Principal() {
  const [menuOuvert, setMenuOuvert] = useState(false);
  // Lecture à chaque montée : le splash a déjà chargé la saison (locale,
  // serveur ou embarquée) juste avant cette fenêtre.
  const saison = saisonAffichageCourante();

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
        viewbox={saison.viewbox}
        zones={saison.zones}
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
