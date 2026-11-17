import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import type { ZoneCarte } from '../data/carte';

type Props = {
  // Repère de la saison (fond.largeur/hauteur du season.json — le viewBox
  // 992×1586 de la saison embarquée, cf. data/carte.ts).
  viewbox: { largeur: number; hauteur: number };
  // Zones de la saison : le fond (action null) puis les bâtiments cliquables
  // — construites par le service saison (embarquée ou .cds).
  zones: ZoneCarte[];
  onPressZone?: (action: string) => void;
};

// Reproduit le rendu du SVG source (../img2.svg) — désormais piloté par la
// saison d'affichage (`.cds` ou saison embarquée, cf. services/saison.ts) :
// chaque zone est dessinée dans le repère du viewBox avec le
// « preserveAspectRatio » par défaut (xMidYMid meet) — la carte est mise à
// l'échelle en entier, centrée, avec des marges égales. Les zones portant une
// action deviennent tatonables.
export default function CarteInteractive({ viewbox, zones, onPressZone }: Props) {
  const [taille, setTaille] = useState<{ largeur: number; hauteur: number } | null>(null);

  const definirTaille = ({ nativeEvent }: LayoutChangeEvent) =>
    setTaille({ largeur: nativeEvent.layout.width, hauteur: nativeEvent.layout.height });

  // Premier rendu : la surface n'est pas encore mesurée, rien à positionner.
  if (taille === null) {
    return <View style={styles.plein} onLayout={definirTaille} />;
  }

  // Mise à l'échelle « xMidYMid meet » du viewBox dans la surface disponible.
  const echelle = Math.min(
    taille.largeur / viewbox.largeur,
    taille.hauteur / viewbox.hauteur,
  );
  const decalX = (taille.largeur - viewbox.largeur * echelle) / 2;
  const decalY = (taille.hauteur - viewbox.hauteur * echelle) / 2;

  const geometrie = (zone: ZoneCarte) => ({
    left: decalX + zone.x * echelle,
    top: decalY + zone.y * echelle,
    width: zone.largeur * echelle,
    height: zone.hauteur * echelle,
  });

  return (
    <View style={styles.plein} onLayout={definirTaille}>
      {/* L'ordre des zones (fond puis bâtiments) est l'ordre de superposition :
          chaque zone est au-dessus de la précédente, comme dans le SVG d'origine. */}
      {zones.map((zone) =>
        zone.action ? (
          <Pressable
            key={zone.id}
            style={({ pressed }) => [
              styles.zone,
              geometrie(zone),
              pressed && styles.appuyee,
            ]}
            onPress={() => {
              if (zone.action) onPressZone?.(zone.action);
            }}
          >
            <Image source={zone.image} style={styles.remplir} resizeMode="stretch" />
          </Pressable>
        ) : (
          <Image
            key={zone.id}
            source={zone.image}
            style={[styles.zone, geometrie(zone)]}
            resizeMode="stretch"
          />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  plein: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  zone: {
    position: 'absolute',
  },
  appuyee: {
    opacity: 0.85,
  },
  remplir: {
    width: '100%',
    height: '100%',
  },
});
