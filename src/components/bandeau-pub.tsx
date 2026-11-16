import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VERSION_APPLI } from '../data/notes-version';
import { naviguer } from '../navigation/navigateur';

// Bande publicitaire de la fenêtre principale : un emplacement à hauteur stable
// est réservé dans la partie basse de l'écran — la carte se reformate au-dessus.
// En attendant le serveur (future source des visuels publicitaires), le bandeau
// affiche un simple emplacement discret ; son contenu sera branché plus tard.
// Sous le bandeau (exigence produit 2026-11-16) : le champ de version
// « CodEbara v0.0.x » (VERSION_APPLI, généré depuis NOTES-VERSION.md) —
// pressable, il ouvre la fenêtre notes de version.
export default function BandeauPub() {
  const insets = useSafeAreaInsets();
  const hauteur = 68 + insets.bottom;

  return (
    <View style={[styles.bandeau, { height: hauteur }]}>
      <Text style={styles.libelle}>Espace publicitaire</Text>
      <Pressable
        hitSlop={6}
        onPress={() => naviguer({ nom: 'notes' })}
        accessibilityLabel={`Version ${VERSION_APPLI} — notes de version`}
      >
        <Text style={styles.version}>CodEbara v{VERSION_APPLI}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bandeau: {
    backgroundColor: '#f7f8fa',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e3e6ea',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  libelle: {
    fontSize: 12,
    letterSpacing: 0.5,
    color: '#9aa3ab',
  },
  version: {
    fontSize: 11,
    fontWeight: '600',
    color: '#43a047',
  },
});
