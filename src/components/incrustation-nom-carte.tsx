import { StyleSheet, Text } from 'react-native';
import { type PositionTexte } from '../utils/cdz';

// Incrustation du nom de la carte sur son image front (exigence produit
// 2026-11-16) : positionnée selon deck.json (`positions.name` — x, y, height
// = taille de police, color = couleur d'écriture) dans le repère du deck
// (= front.png, 600×1037). Le nom est affiché sur TOUTES les vues d'une
// carte : visuel 3D (usine + détail) et grille de la maison.
//
// Point d'ancrage : coin haut-gauche du texte (x/y), la largeur s'étend
// jusqu'au bord droit de la carte (le nom passe à la ligne si trop long).
// La taille de police suit le rapport carte affichée / repère deck — la
// police se met à l'échelle avec la carte (thumbnails compris). N'affiche
// rien sans position ni nom (archives sans deck.json).
type Props = {
  position: PositionTexte | null;
  repere: number;
  hauteurRepere: number;
  nom: string | null;
  largeurCarte: number;
};

export default function IncrustationNomCarte({
  position,
  repere,
  hauteurRepere,
  nom,
  largeurCarte,
}: Props) {
  if (!position || !nom || nom.length === 0) return null;
  // Garde-fou : largeurCarte peut être 0 ou négative avant le premier
  // onLayout (grille pas encore mesurée) → fontSize négatif faisait planter
  // le moteur de texte Android (« FontSize should be a positive value »).
  const largeurSure = Math.max(1, largeurCarte);
  const rapport = largeurSure / repere;
  const tailleSure = Math.max(1, position.taille * rapport);
  return (
    <Text
      numberOfLines={2}
      allowFontScaling={false}
      style={[
        styles.texte,
        {
          left: `${(position.x / repere) * 100}%`,
          top: `${(position.y / hauteurRepere) * 100}%`,
          width: `${((repere - position.x) / repere) * 100}%`,
          fontSize: tailleSure,
          color: position.couleur ?? '#1f2937',
        },
      ]}
    >
      {nom}
    </Text>
  );
}

const styles = StyleSheet.create({
  texte: {
    position: 'absolute',
    fontWeight: '700',
    textAlign: 'left',
  },
});
