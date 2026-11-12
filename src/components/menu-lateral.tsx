import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { naviguer, remplacer, type Fenetre } from '../navigation/navigateur';
import { persistor } from '../store/store';
import { useAppDispatch } from '../store/hooks';
import { seDeconnecter } from '../store/utilisateur';

// Fenêtres accessibles depuis le menu latéral de la fenêtre principale.
const DESTINATIONS: { fenetre: Fenetre; libelle: string }[] = [
  { fenetre: { nom: 'usine' }, libelle: 'Usine' },
  { fenetre: { nom: 'maison' }, libelle: 'Maison' },
  { fenetre: { nom: 'mairie' }, libelle: 'Mairie' },
  { fenetre: { nom: 'boutique' }, libelle: 'Boutique' },
  { fenetre: { nom: 'arene' }, libelle: 'Arène' },
];

const LARGEUR_MENU = 280;

type Props = { ouvert: boolean; onFermer: () => void };

// Menu latéral (drawer « maison ») de la fenêtre principale uniquement :
// liste des fenêtres accessibles + bouton de déconnexion en bas.
export default function MenuLateral({ ouvert, onFermer }: Props) {
  const dispatcher = useAppDispatch();
  // Valeur d'animation stable sur toute la vie du composant (l'initialiseur
  // useState ne s'exécute qu'une fois) — idiome classique pour un Animated.Value.
  const [progression] = useState(() => new Animated.Value(0));
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.timing(progression, {
      toValue: ouvert ? 1 : 0,
      duration: 200,
      // Web : le module animé natif est absent (react-native-web) — piloter
      // l'animation en JS évite le message « useNativeDriver is not supported
      // … Falling back to JS-based animation » dans la console du navigateur.
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [ouvert, progression]);

  // Déconnexion : réinitialise la tranche utilisateur, efface sa persistance
  // (stockage local) puis retour à la fenêtre de connexion (remplacement :
  // pas de retour arrière vers la fenêtre principale).
  const deconnecter = () => {
    dispatcher(seDeconnecter());
    persistor.purge();
    onFermer();
    remplacer({ nom: 'connexion' });
  };

  const ouvrirFenetre = (fenetre: Fenetre) => {
    onFermer();
    naviguer(fenetre);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={ouvert ? 'auto' : 'none'}>
      <Animated.View style={[styles.assombri, { opacity: progression }]}>
        <Pressable style={styles.remplir} onPress={onFermer} accessibilityLabel="Fermer le menu" />
      </Animated.View>
      <Animated.View
        style={[
          styles.menu,
          {
            paddingBottom: insets.bottom + 16,
            transform: [
              {
                translateX: progression.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-LARGEUR_MENU, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.pousserHaut} />
        <Text style={styles.titreMenu}>Fenêtres</Text>
        {DESTINATIONS.map((destination) => (
          <Pressable
            key={destination.libelle}
            style={({ pressed }) => [styles.item, pressed && styles.itemAppuye]}
            onPress={() => ouvrirFenetre(destination.fenetre)}
          >
            <Text style={styles.itemTexte}>{destination.libelle}</Text>
          </Pressable>
        ))}
        <View style={styles.pousserBas} />
        <Pressable
          style={({ pressed }) => [styles.deconnexion, pressed && styles.itemAppuye]}
          onPress={deconnecter}
        >
          <Text style={styles.deconnexionTexte}>Se déconnecter</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  assombri: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  remplir: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: LARGEUR_MENU,
    backgroundColor: '#ffffff',
    paddingTop: 28,
    paddingHorizontal: 10,
    gap: 2,
  },
  pousserHaut: {
    height: 26,
  },
  titreMenu: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9aa3ab',
    letterSpacing: 0.5,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  itemAppuye: {
    backgroundColor: '#f3f4f6',
  },
  itemTexte: {
    fontSize: 16,
    color: '#1f2937',
  },
  pousserBas: {
    flex: 1,
  },
  deconnexion: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  deconnexionTexte: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c62828',
  },
});
