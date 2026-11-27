import { Image, StyleSheet, Text, View } from 'react-native';

// Rendu commun d'un avatar de compte (en-tête, École, mairie). Une data URI
// PNG circulaire 150×150 est fournie par le serveur ; sans avatar, on affiche
// les initiales dans un cercle gris (décision produit v0.0.22).
type Props = {
  uri: string | null | undefined;
  nom: string;
  taille: number;
  /** Nombre d'initiales affichées (2 dans l'en-tête, 1 dans les listes). */
  initiales?: number;
};

export default function Avatar({ uri, nom, taille, initiales = 1 }: Props) {
  const cercle = {
    width: taille,
    height: taille,
    borderRadius: Math.round(taille / 2),
  };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.base, cercle]}
        resizeMode="cover"
        accessibilityLabel={`Avatar de ${nom}`}
      />
    );
  }
  const texte = nom.trim().slice(0, initiales).toUpperCase() || '?';
  return (
    <View style={[styles.base, styles.vide, cercle]} accessibilityLabel={`Avatar de ${nom}`}>
      <Text style={[styles.texte, { fontSize: Math.max(10, Math.round(taille * 0.4)) }]}>
        {texte}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vide: {
    backgroundColor: '#9ca3af',
  },
  texte: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
