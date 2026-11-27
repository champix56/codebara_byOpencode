import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewInstance,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle, ClipPath, Defs, Image as SvgImage } from 'react-native-svg';
import { AVATARS_INTEGRES, uriAvatarIntegre } from '../utils/avatars-integres';
import { capturerAvatar } from '../utils/capture-avatar';

// Fenêtre de choix de l'avatar du compte (v0.0.22) :
//  1. six avatars intégrés, une photo de la bibliothèque, ou suppression ;
//  2. l'image choisie est recadrée dans un cercle (zoom + déplacement) puis
//     capturée en PNG transparent 150×150 et envoyée au serveur.
// Le masque est un ClipPath SVG (cross-platform) ; la capture est fournie par
// capture-avatar.ts sur natif et capture-avatar.web.ts sur navigateur.
const TAILLE_AVATAR = 150;
const COTE_CERCLE = 220;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const PAS_ZOOM = 0.25;
const ID_CLIP = 'avatar-editeur-clip';

type Source = { uri: string; titre: string };
type Etape = 'choix' | 'edition';

type Props = {
  visible: boolean;
  avatarActuel: string | null;
  onFermer: () => void;
  /** null = retirer l'avatar ; sinon data URI PNG 150×150 à envoyer au serveur. */
  onEnregistrer: (avatar: string | null) => Promise<void>;
};

const limiter = (valeur: number, zoom: number): number => {
  const borne = (COTE_CERCLE * (zoom - 1)) / 2;
  return Math.max(-borne, Math.min(borne, valeur));
};

export default function AvatarEditeur({
  visible,
  avatarActuel,
  onFermer,
  onEnregistrer,
}: Props) {
  const [etape, setEtape] = useState<Etape>('choix');
  const [source, setSource] = useState<Source | null>(null);
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const [decalage, setDecalage] = useState({ x: 0, y: 0 });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const refCercle = useRef<ViewInstance | null>(null);
  // Origine du glisser en coordonnées écran : lire une ref dans un handler
  // tactile uniquement (jamais pendant le rendu).
  const departRef = useRef({ x: 0, y: 0 });

  const reinitialiser = () => {
    setEtape('choix');
    setSource(null);
    setZoom(ZOOM_MIN);
    setDecalage({ x: 0, y: 0 });
    setErreur(null);
  };

  const fermer = () => {
    if (enCours) return;
    reinitialiser();
    onFermer();
  };

  const choisirIntegre = async (module: number, titre: string) => {
    setEnCours(true);
    setErreur(null);
    try {
      const uri = await uriAvatarIntegre(module);
      setSource({ uri, titre });
      setZoom(ZOOM_MIN);
      setDecalage({ x: 0, y: 0 });
      setEtape('edition');
    } catch {
      setErreur('Cet avatar intégré n’a pas pu être chargé.');
    } finally {
      setEnCours(false);
    }
  };

  const choisirPhoto = async () => {
    setErreur(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErreur('Autorise l’accès aux photos pour choisir un avatar.');
        return;
      }
      // Le recadrage circulaire est fait ici : pas de crop natif (allowsEditing
      // false) pour garder le même geste sur Android, iOS et web.
      const resultat = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });
      if (resultat.canceled || resultat.assets.length === 0) return;
      setSource({ uri: resultat.assets[0].uri, titre: 'Photo' });
      setZoom(ZOOM_MIN);
      setDecalage({ x: 0, y: 0 });
      setEtape('edition');
    } catch {
      setErreur('La photo n’a pas pu être ouverte.');
    }
  };

  const enregistrer = async () => {
    if (!source || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const png = await capturerAvatar(
        refCercle,
        source.uri,
        zoom,
        decalage.x,
        decalage.y,
        TAILLE_AVATAR,
        COTE_CERCLE,
      );
      if (!png.startsWith('data:image/png;base64,')) {
        throw new Error('Capture d’avatar invalide');
      }
      await onEnregistrer(png);
      reinitialiser();
      onFermer();
    } catch (erreur) {
      setErreur((erreur as Error).message || 'L’avatar n’a pas pu être enregistré.');
    } finally {
      setEnCours(false);
    }
  };

  const retirer = async () => {
    if (enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      await onEnregistrer(null);
      reinitialiser();
      onFermer();
    } catch (erreur) {
      setErreur((erreur as Error).message || 'L’avatar n’a pas pu être retiré.');
    } finally {
      setEnCours(false);
    }
  };

  const ajusterZoom = (delta: number) => {
    const suivant = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + delta));
    setZoom(suivant);
    setDecalage((actuel) => ({
      x: limiter(actuel.x, suivant),
      y: limiter(actuel.y, suivant),
    }));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={fermer}>
      <View style={styles.fond}>
        <View style={styles.carte}>
          <Text style={styles.titre}>
            {etape === 'choix' ? 'Choisir un avatar' : 'Recadrer l’avatar'}
          </Text>
          {erreur && <Text style={styles.erreur}>{erreur}</Text>}

          {etape === 'choix' ? (
            <ScrollView style={styles.grille}>
              <View style={styles.ligne}>
                {AVATARS_INTEGRES.map((avatar) => (
                  <Pressable
                    key={avatar.id}
                    style={styles.boutonAvatar}
                    onPress={() => choisirIntegre(avatar.module, avatar.titre)}
                    disabled={enCours}
                    accessibilityLabel={`Choisir l’avatar ${avatar.titre}`}
                  >
                    <Image
                      source={avatar.module}
                      style={styles.imageIntegree}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </View>
              <Pressable style={styles.boutonPhoto} onPress={choisirPhoto} disabled={enCours}>
                <Text style={styles.boutonTexte}>Choisir une photo</Text>
              </Pressable>
              {avatarActuel && (
                <Pressable style={styles.boutonRetirer} onPress={retirer} disabled={enCours}>
                  <Text style={styles.boutonRetirerTexte}>Retirer l’avatar</Text>
                </Pressable>
              )}
            </ScrollView>
          ) : (
            <View style={styles.edition}>
              <View style={styles.cercle} ref={refCercle} collapsable={false}>
                <Svg width={COTE_CERCLE} height={COTE_CERCLE}>
                  <Defs>
                    <ClipPath id={ID_CLIP}>
                      <Circle cx={COTE_CERCLE / 2} cy={COTE_CERCLE / 2} r={COTE_CERCLE / 2} />
                    </ClipPath>
                  </Defs>
                  <SvgImage
                    href={{ uri: source?.uri ?? '' }}
                    x={COTE_CERCLE / 2 - (COTE_CERCLE * zoom) / 2 + decalage.x}
                    y={COTE_CERCLE / 2 - (COTE_CERCLE * zoom) / 2 + decalage.y}
                    width={COTE_CERCLE * zoom}
                    height={COTE_CERCLE * zoom}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#${ID_CLIP})`}
                  />
                </Svg>
                <View
                  style={styles.zoneGlisser}
                  onTouchStart={(evenement) => {
                    departRef.current = {
                      x: decalage.x - evenement.nativeEvent.pageX,
                      y: decalage.y - evenement.nativeEvent.pageY,
                    };
                  }}
                  onTouchMove={(evenement) => {
                    setDecalage({
                      x: limiter(departRef.current.x + evenement.nativeEvent.pageX, zoom),
                      y: limiter(departRef.current.y + evenement.nativeEvent.pageY, zoom),
                    });
                  }}
                />
              </View>
              <Text style={styles.consigne}>Glisse l’image, puis zoome pour ajuster.</Text>
              <View style={styles.controlesZoom}>
                <Pressable
                  style={styles.boutonZoom}
                  onPress={() => ajusterZoom(-PAS_ZOOM)}
                  disabled={enCours || zoom <= ZOOM_MIN}
                >
                  <Text style={styles.boutonZoomTexte}>−</Text>
                </Pressable>
                <Text style={styles.zoomValeur}>{zoom.toFixed(2)}×</Text>
                <Pressable
                  style={styles.boutonZoom}
                  onPress={() => ajusterZoom(PAS_ZOOM)}
                  disabled={enCours || zoom >= ZOOM_MAX}
                >
                  <Text style={styles.boutonZoomTexte}>+</Text>
                </Pressable>
              </View>
            </View>
          )}

          {enCours && <ActivityIndicator color="#2563eb" style={styles.chargement} />}

          <View style={styles.actions}>
            <Pressable style={styles.boutonNeutre} onPress={fermer} disabled={enCours}>
              <Text style={styles.boutonNeutreTexte}>Annuler</Text>
            </Pressable>
            {etape === 'edition' && (
              <Pressable style={styles.boutonValider} onPress={enregistrer} disabled={enCours}>
                <Text style={styles.boutonTexte}>Enregistrer</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  carte: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
  },
  titre: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  erreur: {
    color: '#b91c1c',
    fontSize: 13,
    marginBottom: 8,
  },
  grille: {
    maxHeight: 320,
  },
  ligne: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 14,
  },
  boutonAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d1d5db',
  },
  imageIntegree: {
    width: 72,
    height: 72,
  },
  boutonPhoto: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  boutonTexte: {
    color: '#ffffff',
    fontWeight: '700',
  },
  boutonRetirer: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  boutonRetirerTexte: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  edition: {
    alignItems: 'center',
  },
  cercle: {
    width: COTE_CERCLE,
    height: COTE_CERCLE,
    borderRadius: COTE_CERCLE / 2,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  zoneGlisser: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  consigne: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  controlesZoom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
  },
  boutonZoom: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boutonZoomTexte: {
    fontSize: 22,
    color: '#1f2937',
    lineHeight: 24,
  },
  zoomValeur: {
    color: '#374151',
    fontWeight: '600',
  },
  chargement: {
    marginTop: 10,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
  },
  boutonNeutre: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  boutonNeutreTexte: {
    color: '#374151',
    fontWeight: '600',
  },
  boutonValider: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
});
