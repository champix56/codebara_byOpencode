import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BandeauPub from '../components/bandeau-pub';
import CarteInteractive from '../components/carte-interactive';
import EnteteEcran from '../components/entete-ecran';
import MenuLateral from '../components/menu-lateral';
import { naviguer, type Fenetre } from '../navigation/navigateur';
import { saisonAffichageCourante } from '../services/saison';

// Correspondance entre la valeur `fenetre` du season.json (batiments.*.fenetre)
// et une Fenetre. Les clés sont des identifiants de CODE : ASCII, sans accent
// (`ecole`, jamais `école`) — les accents restent réservés aux libellés affichés
// (« École » dans le menu, titre de l'en-tête). Seules les fenêtres sans
// paramètre peuvent être ciblées par une ressource graphique de saison ; une
// valeur inconnue est ignorée (garde-fou) au lieu de faire planter la navigation.
const ZONES: Record<string, Fenetre> = {
  usine: { nom: 'usine' },
  maison: { nom: 'maison' },
  mairie: { nom: 'mairie' },
  boutique: { nom: 'boutique' },
  arene: { nom: 'arene' },
  notes: { nom: 'notes' },
  ecole: { nom: 'ecole' },
  // Bâtiment « poste » d'une saison (`batiments.*.fenetre = poste`) — absent
  // du .cds, la fenêtre reste accessible depuis le menu latéral.
  poste: { nom: 'poste' },
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
      {saison.nom ? (
        <Text style={styles.nomSaison} accessibilityLabel={`Saison en cours : ${saison.nom}`}>
          {`Saison en cours : ${saison.nom}`}
        </Text>
      ) : null}
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
  nomSaison: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    paddingVertical: 4,
  },
});
