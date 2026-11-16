import { useMemo, useState } from 'react';
import {
  Image,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';
import { encoderBase64 } from '../utils/base64';
import { type Cdz } from '../utils/cdz';
import IncrustationNomCarte from './incrustation-nom-carte';

// Visuel 3D d'une carte extraite d'une archive .cdz (contrat §6.2) — mise en
// scène « vitrine de musée » : la vitrine occupe TOUTE la largeur du parent,
// la carte est posée sur un pupitre (dalle, fût, socle) dans une ambiance
// sombre éclairée par un spot plafonnier (faisceau triangulaire + halo chaud),
// son ombre glisse sur la dalle avec la rotation, et le fond lointain bouge en
// parallaxe (moins que l'ombre) sous une vignette — il paraît plus loin que la
// carte. Sert à la réception d'une carte fabriquée (popup éclosion de l'usine)
// et à l'affichage détaillé de la fenêtre « carte ».
//
// Deux faces : front.png (recto, présenté par défaut) et back.png (verso, du
// même fichier .cdz) — glisser HORIZONTALEMENT tourne la carte (360° libres),
// passé 90° le dos apparaît ; glisser VERTICALEMENT incline la carte (±30°)
// pour faire apparaître les reflets de lumière ; pincer à DEUX DOIGTS
// (écarter/resserrer) zoome la carte (×0,5 à ×3). Pointeur (web) ou doigt
// (natif) — même système répondeur React Native, posé sur toute la vitrine.
//
// Le dos n'utilise NI backfaceVisibility NI rotation imbriquée (correctif
// 2026-11-16, cf. culling plus bas) : une seule face, l'image bascule.
//
// Tout est du pur React Native (triangle du faisceau par bordures, bandes
// translucides) : aucune dépendance native — web, iOS et Android.

type Props = {
  /** Archive extraite (front.png + back.png consommés ici). */
  cdz: Cdz;
  /** Largeur d'affichage de la CARTE (px) — la vitrine s'étend autour. */
  largeur: number;
};

const RAPPORT_CARTE = 1037 / 600;
const INCLINAISON_MAX = 30;
const PERSPECTIVE = 1400;
// Sensibilité du geste : degrés par pixel de déplacement.
const SENSIBILITE_HORIZONTALE = 0.55;
const SENSIBILITE_VERTICALE = 0.35;

// Pose de la carte : angles courants + pose figée à la capture du geste
// (les deltas de PanResponder sont cumulatifs depuis la capture). Le zoom est
// piloté à DEUX doigts (écartement/resserrement, exigence produit 2026-11-15)
// : `depart.ecart` fige la distance entre les deux doigts à l'entrée du geste
// pincé — le zoom suit le rapport écart courant / écart de référence.
type Pose = {
  rotationY: number;
  inclinaison: number;
  zoom: number;
  depart: {
    rotationY: number;
    inclinaison: number;
    zoom: number;
    /** Distance (px) entre les deux doigts à l'entrée du mode pincé. */
    ecart: number | null;
  };
};

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

const POSE_INITIALE: Pose = {
  rotationY: 0,
  inclinaison: 0,
  zoom: 1,
  depart: { rotationY: 0, inclinaison: 0, zoom: 1, ecart: null },
};

const borne = (valeur: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, valeur));

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

// Profondeur 3D réelle — PLUS UTILISÉE : l'approche face unique (culling par
// l'angle effectif, correctif 2026-11-16) ne compose plus de rotations
// imbriquées, donc le navigateur ne peut plus aplatir/miroiter. Historique :
// le modèle flip-card (deux faces empilées, dos en rotateY 180 +
// backfaceVisibility) ne s'affichait PAS sur Android/iOS — Android cesse de
// rendre les enfants d'un pivot 3D composé au-delà de 90°, et
// backfaceVisibility échoue dans cette composition (perspective + scale +
// inclinaison + overflow hidden).

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
          // DEPUIS la capture, les rotations s'y ajoutent ; l'écart pincé est
          // réarmé (un doigt = rotation, deux doigts = zoom).
          definirPose((actuelle) => ({
            ...actuelle,
            depart: {
              rotationY: actuelle.rotationY,
              inclinaison: actuelle.inclinaison,
              zoom: actuelle.zoom,
              ecart: null,
            },
          }));
        },
        onPanResponderMove: (evenement, geste) => {
          // Deux doigts posés = mode zoom : la distance entre les deux
          // touches (nativeEvent.touches) pilote l'échelle, la rotation est
          // figée.
          const touches = evenement.nativeEvent.touches;
          if (geste.numberActiveTouches >= 2 && touches.length >= 2) {
            const [un, deux] = touches;
            const ecart = Math.hypot(un.pageX - deux.pageX, un.pageY - deux.pageY);
            definirPose((actuelle) => {
              // Premier mouvement à deux doigts : pose de référence (écart +
              // zoom du moment) ; les suivants appliquent le rapport.
              const ecartRef = actuelle.depart.ecart ?? ecart;
              const zoomRef = actuelle.depart.ecart === null ? actuelle.zoom : actuelle.depart.zoom;
              return {
                ...actuelle,
                depart: { ...actuelle.depart, zoom: zoomRef, ecart: ecartRef },
                zoom: borne((zoomRef * ecart) / ecartRef, ZOOM_MIN, ZOOM_MAX),
              };
            });
            return;
          }
          // Un seul doigt : rotation (horizontale) + inclinaison (verticale).
          // Sortie du mode zoom : la référence de rotation est re-figée sur la
          // pose courante (le dx cumulatif du pincement ne doit pas faire
          // tourner la carte d'un coup).
          definirPose((actuelle) => {
            if (actuelle.depart.ecart !== null) {
              return {
                ...actuelle,
                depart: {
                  rotationY: actuelle.rotationY,
                  inclinaison: actuelle.inclinaison,
                  zoom: actuelle.zoom,
                  ecart: null,
                },
              };
            }
            return {
              ...actuelle,
              rotationY: actuelle.depart.rotationY + geste.dx * SENSIBILITE_HORIZONTALE,
              inclinaison: borne(
                actuelle.depart.inclinaison - geste.dy * SENSIBILITE_VERTICALE,
                -INCLINAISON_MAX,
                INCLINAISON_MAX,
              ),
            };
          });
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

  // ── Face affichée + angle effectif (correctif 2026-11-16) ───────────────────
  // `backfaceVisibility` natif n'est pas fiable dans cette composition
  // (Android cesse de rendre les ENFANTS d'un pivot 3D composé au-delà de
  // 90° — le dos ne s'affichait jamais ; l'élimination par opacité des faces
  // n'a pas suffi). Approche sans aucune rotation imbriquée :
  //   - UNE seule face ; passé 90° (cos < 0) l'image bascule sur back.png ;
  //   - le pivot tourne sur l'ANGLE EFFECTIF θ' = θ ou θ+180 : ramené dans la
  //     bande (-90°, +90°), la carte est toujours face au spectateur — aucune
  //     face arrière à rendre. Le basculement est invisible : à 90° la carte
  //     est de profil (largeur projetée |cos θ| continue de part et d'autre).
  //   - back.png apparaît NON MIROIR (il est vu de face, comme front.png).
  const rectoVisible = Math.cos((pose.rotationY * Math.PI) / 180) > 0;
  const rotationEffective = pose.rotationY + (rectoVisible ? 0 : 180);

  // Nom incrusté sur le recto (datas.json + position deck.json) — même
  // repli que le détail : « Carte #id » si le nom est vide.
  const nomAffiche =
    (cdz.datas.name && cdz.datas.name.length > 0 ? cdz.datas.name : null) ??
    (cdz.datas.id !== null ? `Carte #${cdz.datas.id}` : null);

  // ── Géométrie de la vitrine (tout dérive de la largeur de la carte) ──────
  // La vitrine occupe toute la largeur du parent ; les éléments centrés sont
  // posés à left: '50%' puis ramenés d'une demi-largeur (marge négative).
  const hauteur = largeur * RAPPORT_CARTE;
  const margeHaut = hauteur * 0.2; // respiration sous le spot
  const faisceauH = margeHaut + hauteur * 0.55; // le spot descend sur la carte
  const demiFaisceau = largeur * 0.75;
  const dalleH = Math.max(12, hauteur * 0.05);
  const dalleW = largeur * 1.5;
  const dalleTop = margeHaut + hauteur - 6; // la carte se pose sur la dalle
  const futH = hauteur * 0.12;
  const futW = largeur * 0.72;
  const socleH = Math.max(8, hauteur * 0.032);
  const socleW = largeur * 1.28;
  const sceneH = dalleTop + dalleH + futH + socleH + hauteur * 0.05;
  // Ombre de la carte sur la dalle : glisse à l'opposé de la rotation.
  const decalageOmbre = -Math.sin((pose.rotationY * Math.PI) / 180) * largeur * 0.12;
  // Fond lointain : il suit la rotation en sens inverse, beaucoup moins que
  // l'ombre de la carte — le décalage de vitesse le pousse visuellement
  // derrière la carte (parallaxe).
  const parallaxe = -Math.sin((pose.rotationY * Math.PI) / 180) * largeur * 0.035;

  return (
    <View style={[styles.scene, { height: sceneH }]} {...panoramique.panHandlers}>
      {/* Fond lointain : nappe ambiante, faisceau du spot plafonnier (triangle
          par bordures — pointe en haut), halos chauds. Le calque entier est
          légèrement agrandi et TranslateX en parallaxe : plus lent que la
          carte, il paraît plus loin (profondeur). Décoratif. */}
      <View
        pointerEvents="none"
        style={[styles.couche, { transform: [{ translateX: parallaxe }, { scale: 1.05 }] }]}
      >
        <View style={[styles.nappe, { height: sceneH * 0.8, top: sceneH * 0.1 }]} />
        <View
          style={[
            styles.faisceau,
            {
              top: 0,
              left: '50%',
              marginLeft: -demiFaisceau,
              borderLeftWidth: demiFaisceau,
              borderRightWidth: demiFaisceau,
              borderBottomWidth: faisceauH,
            },
          ]}
        />
        <View
          style={[
            styles.faisceauCoeur,
            {
              top: 0,
              left: '50%',
              marginLeft: -demiFaisceau * 0.5,
              borderLeftWidth: demiFaisceau * 0.5,
              borderRightWidth: demiFaisceau * 0.5,
              borderBottomWidth: faisceauH * 0.85,
            },
          ]}
        />
        <View
          style={[
            styles.halo,
            {
              width: largeur * 1.7,
              height: largeur * 1.7,
              left: '50%',
              marginLeft: -(largeur * 1.7) / 2,
              top: margeHaut - hauteur * 0.12,
            },
          ]}
        />
        <View
          style={[
            styles.haloCoeur,
            {
              width: largeur * 1.05,
              height: largeur * 1.05,
              left: '50%',
              marginLeft: -(largeur * 1.05) / 2,
              top: margeHaut + hauteur * 0.1,
            },
          ]}
        />
      </View>

      {/* Pupitre (dalle + fût + socle) — STATIQUE : c'est le sol sur lequel la
          carte se pose, il ne doit pas se détacher d'elle. */}
      <View pointerEvents="none" style={styles.couche}>
        <View
          style={[
            styles.dalle,
            { top: dalleTop, left: '50%', marginLeft: -dalleW / 2, width: dalleW, height: dalleH },
          ]}
        >
          <View style={styles.dalleLumiere} />
        </View>
        <View
          style={[
            styles.fut,
            {
              top: dalleTop + dalleH,
              left: '50%',
              marginLeft: -futW / 2,
              width: futW,
              height: futH,
            },
          ]}
        />
        <View
          style={[
            styles.socle,
            {
              top: dalleTop + dalleH + futH,
              left: '50%',
              marginLeft: -socleW / 2,
              width: socleW,
              height: socleH,
            },
          ]}
        />
      </View>

      {/* Ombre portée de la carte sur la dalle (glisse avec la rotation). */}
      <View
        pointerEvents="none"
        style={[
          styles.ombre,
          {
            width: largeur * 0.85,
            height: Math.max(8, dalleH * 0.5),
            left: '50%',
            marginLeft: -(largeur * 0.85) / 2,
            top: dalleTop + dalleH * 0.28,
            transform: [{ translateX: decalageOmbre }],
          },
        ]}
      />

      {/* Vignette : assombrit les bords de la vitrine (deux anneaux imbriqués
          simulant le dégradé) — l'éclairage tombe avec la distance, ce qui
          renforce la mise en valeur de la carte au centre. */}
      <View
        pointerEvents="none"
        style={[styles.vignette, { borderWidth: Math.max(12, hauteur * 0.11) }]}
      />
      <View
        pointerEvents="none"
        style={[styles.vignette2, { borderWidth: Math.max(8, hauteur * 0.05) }]}
      />

      {/* Carte pivotante : la perspective est en tête de la même chaîne de
          transformations ; l'angle effectif reste dans la bande face au
          spectateur et l'image bascule front/back — AUCUNE rotation imbriquée
          (Android ne rend pas les enfants d'un pivot 3D composé au-delà de
          90°, cf. commentaire du culling). */}
      <View
        style={[
          styles.pivot,
          {
            width: largeur,
            height: hauteur,
            left: '50%',
            marginLeft: -largeur / 2,
            top: margeHaut,
            transform: [
              { perspective: PERSPECTIVE },
              { scale: pose.zoom },
              { rotateX: `${pose.inclinaison}deg` },
              { rotateY: `${rotationEffective}deg` },
            ],
          },
        ]}
      >
        <View style={styles.face}>
          <Image
            source={{ uri: rectoVisible ? faceFront : faceDos }}
            style={styles.image}
            resizeMode="contain"
          />
          {/* Nom incrusté (deck.json positions.name) — sur le recto UNIQUEMENT
              (il tourne avec la carte ; le dos ne porte pas de nom). */}
          {rectoVisible && (
            <IncrustationNomCarte
              position={cdz.deck?.nom ?? null}
              repere={cdz.deck?.repere ?? 600}
              hauteurRepere={cdz.deck?.hauteurRepere ?? 1037}
              nom={nomAffiche}
              largeurCarte={largeur}
            />
          )}
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

const styles = StyleSheet.create({
  // ── Vitrine (pleine largeur du parent, fond sombre encadré) ──────────────
  scene: {
    // Pleine largeur du parent (exigence 2026-11-12) : la vitrine s'étend
    // autour de la carte au lieu d'un petit cadre.
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#191d24',
    borderWidth: 1,
    borderColor: '#2b303a',
    shadowColor: '#0b0d10',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  couche: {
    ...PLEIN,
  },
  nappe: {
    position: 'absolute',
    width: '92%',
    left: '4%',
    borderRadius: 9999,
    backgroundColor: '#20242c',
  },
  // Faisceau du spot : triangle (pointe en haut sous le plafond, base large
  // au niveau de la carte) dessiné par bordures latérales transparentes.
  faisceau: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(255, 248, 231, 0.07)',
  },
  faisceauCoeur: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(255, 248, 231, 0.11)',
  },
  halo: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 248, 231, 0.06)',
  },
  haloCoeur: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 248, 231, 0.09)',
  },
  // ── Pupitre ──────────────────────────────────────────────────────────────
  dalle: {
    position: 'absolute',
    backgroundColor: '#3c414d',
    borderRadius: 3,
    overflow: 'hidden',
  },
  dalleLumiere: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#5a6070',
  },
  fut: {
    position: 'absolute',
    backgroundColor: '#2a2e37',
    borderRadius: 2,
  },
  socle: {
    position: 'absolute',
    backgroundColor: '#22262e',
    borderRadius: 3,
  },
  ombre: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  vignette: {
    ...PLEIN,
    borderRadius: 9999,
    borderLeftColor: 'rgba(9, 11, 14, 0.3)',
    borderRightColor: 'rgba(9, 11, 14, 0.3)',
    borderTopColor: 'rgba(9, 11, 14, 0.3)',
    borderBottomColor: 'rgba(9, 11, 14, 0.3)',
  },
  vignette2: {
    ...PLEIN,
    borderRadius: 9999,
    borderLeftColor: 'rgba(9, 11, 14, 0.2)',
    borderRightColor: 'rgba(9, 11, 14, 0.2)',
    borderTopColor: 'rgba(9, 11, 14, 0.2)',
    borderBottomColor: 'rgba(9, 11, 14, 0.2)',
  },
  // ── Carte pivotante ──────────────────────────────────────────────────────
  pivot: {
    position: 'absolute',
    borderRadius: 12,
  },
  face: {
    ...PLEIN,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
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
