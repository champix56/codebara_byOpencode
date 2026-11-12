import { useMemo, useState } from 'react';
import { Image, PanResponder, StyleSheet, View } from 'react-native';
import { encoderBase64 } from '../utils/base64';
import { type Cdz } from '../utils/cdz';

// Visuel 3D d'une carte extraite d'une archive .cdz (contrat §6.2) : les faces
// front.png / back.png pivotent sur un même plan à perspective. Sert à la
// réception d'une carte fabriquée (popup éclosion de l'usine) et à l'affichage
// détaillé de la fenêtre « carte ».
//
// Interaction (pointeur sur le navigateur, doigt en natif — même système
// répondeur React Native, cf. PanResponder) :
//  - glisser HORIZONTALEMENT fait tourner la carte, rotation complète illimitée
//    (360° et plus) — le dos apparaît passé 90° (backfaceVisibility) ;
//  - glisser VERTICALEMENT incline la carte, bornée ±30°, pour faire apparaître
//    les reflets de lumière.
//
// Les reflets (projection de lumière) sont des bandes translucides blanches
// dont la position suit la rotation (sin) et l'intensité l'inclinaison :
// pur React Native, aucune dépendance native — web, iOS et Android.

type Props = {
  /** Archive extraite (front.png + back.png consommés ici). */
  cdz: Cdz;
  /** Largeur d'affichage (px) — la hauteur suit le ratio de la carte. */
  largeur: number;
};

const RAPPORT_CARTE = 1037 / 600;
const INCLINAISON_MAX = 30;
const PERSPECTIVE = 1400;
// Sensibilité du geste : degrés par pixel de déplacement.
const SENSIBILITE_HORIZONTALE = 0.55;
const SENSIBILITE_VERTICALE = 0.35;

// Pose de la carte : angles courants + pose figée à la capture du geste
// (les deltas de PanResponder sont cumulatifs depuis la capture).
type Pose = {
  rotationY: number;
  inclinaison: number;
  depart: { rotationY: number; inclinaison: number };
};

const POSE_INITIALE: Pose = {
  rotationY: 0,
  inclinaison: 0,
  depart: { rotationY: 0, inclinaison: 0 },
};

const borne = (valeur: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, valeur));

export default function VisuelCarte({ cdz, largeur }: Props) {
  // Rotation horizontale cumulée (non bornée : plusieurs tours possibles) et
  // inclinaison verticale bornée. Poses conservées au relâchement : la carte
  // reste dans la pose laissée par le joueur. Tout l'état du geste est porté
  // par un unique state (aucune ref : les rappels du PanResponder n'y lisent
  // que l'état courant via les mises à jour fonctionnelles).
  const [pose, definirPose] = useState(POSE_INITIALE);

  const panoramique = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // Capture dès un vrai déplacement (évite de bloquer les taps) ; dans
        // une ScrollView, un geste nettement vertical reste à la liste.
        onMoveShouldSetPanResponder: (_evt, geste) =>
          Math.abs(geste.dx) > 6 || Math.abs(geste.dy) > 6,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          // Pose de référence du geste : dx/dy de PanResponder sont cumulatifs
          // DEPUIS la capture, les rotations s'y ajoutent.
          definirPose((actuelle) => ({
            ...actuelle,
            depart: { rotationY: actuelle.rotationY, inclinaison: actuelle.inclinaison },
          }));
        },
        onPanResponderMove: (_evt, geste) => {
          definirPose((actuelle) => ({
            ...actuelle,
            rotationY: actuelle.depart.rotationY + geste.dx * SENSIBILITE_HORIZONTALE,
            inclinaison: borne(
              actuelle.depart.inclinaison - geste.dy * SENSIBILITE_VERTICALE,
              -INCLINAISON_MAX,
              INCLINAISON_MAX,
            ),
          }));
        },
      }),
    [],
  );

  const faceFront = useMemo(
    () => `data:image/png;base64,${encoderBase64(cdz.front)}`,
    [cdz.front],
  );
  const faceDos = useMemo(
    () => `data:image/png;base64,${encoderBase64(cdz.back)}`,
    [cdz.back],
  );

  return (
    <View style={[styles.scene, { width: largeur, height: largeur * RAPPORT_CARTE }]}>
      {/* Plan pivotant : la perspective est en tête de la même chaîne de
          transformations (le rendu 3D s'applique aux rotations de CET élément ;
          la face arrière, plane, bascule par rotateY(180) + backfaceVisibility). */}
      <View
        style={[
          styles.pivot,
          {
            transform: [
              { perspective: PERSPECTIVE },
              { rotateX: `${pose.inclinaison}deg` },
              { rotateY: `${pose.rotationY}deg` },
            ],
          },
        ]}
        {...panoramique.panHandlers}
      >
        <View style={styles.face}>
          <Image source={{ uri: faceFront }} style={styles.image} resizeMode="contain" />
          <Reflet rotationY={pose.rotationY} inclinaison={pose.inclinaison} />
        </View>
        <View style={[styles.face, styles.faceDos, { transform: [{ rotateY: '180deg' }] }]}>
          <Image source={{ uri: faceDos }} style={styles.image} resizeMode="contain" />
          <Reflet rotationY={pose.rotationY} inclinaison={pose.inclinaison} />
        </View>
      </View>
    </View>
  );
}

// Projection de lumière sur une face : bande principale + cœur plus étroit,
// glissant avec la rotation, intensifiées par l'inclinaison ; voile diffus
// global par-dessus. Chaque face porte sa copie (celle visible s'affiche).
function Reflet({ rotationY, inclinaison }: { rotationY: number; inclinaison: number }) {
  const phase = Math.sin((rotationY * Math.PI) / 180); // -1..1, glisse continue
  const force = Math.abs(inclinaison) / INCLINAISON_MAX; // 0..1
  return (
    <View pointerEvents="none" style={styles.refletPlein}>
      <View style={[styles.refletVoile, { opacity: 0.04 + force * 0.1 }]} />
      <View
        style={[
          styles.refletBande,
          { opacity: 0.08 + force * 0.28, transform: [{ translateX: phase * 150 }, { rotate: '18deg' }] },
        ]}
      />
      <View
        style={[
          styles.refletCoeur,
          {
            opacity: (0.08 + force * 0.28) * 0.8,
            transform: [{ translateX: phase * 150 + 14 }, { rotate: '18deg' }],
          },
        ]}
      />
    </View>
  );
}

// Pose absolue (StyleSheet.absoluteFill n'est pas étendable avec des props
// supplémentaires ; RN 0.88 n'a plus absoluteFillObject). Littéral sans
// annotation : s'insère aussi bien dans un style View qu'Image.
const PLEIN = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const styles = StyleSheet.create({
  scene: {
    alignSelf: 'center',
    borderRadius: 12,
    // Ombre portée sur la scène (non transformée : sûre en natif comme en web).
    shadowColor: '#1f2937',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
    backgroundColor: '#ffffff',
  },
  pivot: {
    flex: 1,
    borderRadius: 12,
  },
  face: {
    ...PLEIN,
    borderRadius: 12,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  faceDos: {},
  image: {
    ...PLEIN,
  },
  refletPlein: {
    ...PLEIN,
  },
  refletVoile: {
    ...PLEIN,
    backgroundColor: '#ffffff',
  },
  refletBande: {
    position: 'absolute',
    width: '26%',
    height: '160%',
    top: '-30%',
    left: '37%',
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  refletCoeur: {
    position: 'absolute',
    width: '9%',
    height: '160%',
    top: '-30%',
    left: '37%',
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
});
