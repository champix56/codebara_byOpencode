import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  titre: string;
  // Bouton retour (chevron ‹) : dépile la pile de navigation quand fourni.
  onRetour?: () => void;
  // Emplacement gauche libre (ex. bouton ☰ du menu latéral, fenêtre principale) ;
  // présent, il remplace le chevron de retour.
  gauche?: ReactNode;
};

// Barre d'en-tête maison des fenêtres — remplace les en-têtes natifs du Stack
// (disparus avec le router). Titre centré, slot gauche (retour ou burger),
// slot droite symétrique pour garder le titre centré. La marge haute respecte
// la zone sûre (encoche natif ; 0 sur le web).
export default function EnteteEcran({ titre, onRetour, gauche }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.barre, { paddingTop: insets.top }]}>
      <View style={styles.rang}>
        <View style={styles.cote}>
          {gauche ?? (onRetour && (
            <Pressable hitSlop={12} onPress={onRetour} accessibilityLabel="Retour">
              <Text style={styles.chevron}>‹</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.titre} numberOfLines={1}>
          {titre}
        </Text>
        <View style={styles.cote} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: {
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  rang: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cote: {
    width: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  chevron: {
    fontSize: 28,
    color: '#1f2937',
    paddingHorizontal: 12,
  },
  titre: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
});
