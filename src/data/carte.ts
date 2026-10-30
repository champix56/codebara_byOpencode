// GÉNÉRÉ par scripts/extraire-carte-svg.mjs — ne pas modifier à la main.
// Source : ../img2.svg (répertoire parent du projet) ; relancer le script pour régénérer.
import type { ImageSourcePropType } from 'react-native';

export type ZoneCarte = {
  /** id de la balise <image> d'origine */
  id: string;
  /** data-action de la balise d'origine (zone interactive) ; null pour une image décorative */
  action: string | null;
  /** Géométrie en unités du viewBox : position du coin haut-gauche puis dimensions */
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  image: ImageSourcePropType;
};

export const CARTE_VIEWBOX = { x: 0, y: 0, largeur: 992, hauteur: 1586 } as const;

// L'ordre du tableau correspond à l'ordre z du SVG (le dernier dessiné est au-dessus).
export const CARTE_ZONES: ZoneCarte[] = [
  { id: 'background', action: null, x: 0, y: 0, largeur: 992, hauteur: 1586, image: require('../../assets/carte/background.png') },
  { id: 'usine', action: 'usine', x: 132.31542, y: 6.8262261, largeur: 794, hauteur: 580, image: require('../../assets/carte/usine.png') },
  { id: 'maison', action: 'maison', x: 4.2538008, y: 552.9937, largeur: 453, hauteur: 378, image: require('../../assets/carte/maison.png') },
  { id: 'boutique', action: 'boutique', x: 271.01132, y: 996.76222, largeur: 525, hauteur: 350, image: require('../../assets/carte/boutique.png') },
  { id: 'arene', action: 'arene', x: 441.15388, y: 658.88353, largeur: 537, hauteur: 449, image: require('../../assets/carte/arene.png') },
];
