import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { detecterFormat, neRetenirQueChiffres } from '../utils/codes-bar';
import { naviguer } from '../navigation/navigateur';
import { useAppSelector } from '../store/hooks';
import FabricationCarte from './fabrication-carte';

// Fenêtre usine côté web : le module expo-camera (code natif) n'y fonctionne
// pas — le scan CAMÉRA est assuré par @zxing/browser (décodage pur JS sur le
// flux getUserMedia, caméra arrière via facingMode 'environment'), limité aux
// formats produits gérés par la validation (EAN-8, EAN-13, UPC-A, UPC-E).
// La saisie manuelle reste possible ; si aucun périphérique caméra n'est
// détecté, le bouton de scan disparaît. iOS/Android restent sur usine-ecran.tsx
// (expo-camera).
//
// Exigence produit 2026-11-15 : après l'enregistrement du nom d'une carte
// fabriquée, redirection vers sa fenêtre détail (comme un clic dans la maison).

// Un même code relu en rafale est ignoré pendant ce délai (une lecture = une
// action) — même règle que le scanneur natif.
const DELAI_MEME_CODE_MS = 2500;

// Formats produits attendus (symbologies ZXing équivalentes aux TYPES_CIBLES
// du scanneur natif ; l'UPC-B 11 chiffres reste réservé à la saisie manuelle).
const FORMATS_CIBLES = [
  BarcodeFormat.EAN_8,
  BarcodeFormat.EAN_13,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
];

export default function UsineEcranWeb() {
  const [saisie, setSaisie] = useState('');
  const [codeSoumis, setCodeSoumis] = useState<string | null>(null);
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);
  const sessionActive = useAppSelector((etat) => etat.utilisateur.apiToken !== null);

  // Caméra : détection opportuniste (navigator.mediaDevices) — null tant que
  // la liste des périphériques n'est pas revenue ; false = bouton masqué.
  const [cameraDisponible, definirCameraDisponible] = useState<boolean | null>(null);
  const [scanActif, definirScanActif] = useState(false);

  // Éléments DOM du lecteur ZXing (pur navigateur — RN web les insère dans la
  // View de rendu via ref) ; les refs survivent aux re-rendus du geste.
  const conteneurVideoRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlesRef = useRef<IScannerControls | null>(null);
  const memoireScan = useRef<{ code: string; depuis: number }>({ code: '', depuis: 0 });

  // Détection des caméras au montage : liste des périphériques vidéo. Une
  // liste vide (certains navigateurs la masquent avant permission) laisse le
  // bouton visible — le démarrage affichera alors l'erreur adéquate.
  useEffect(() => {
    let annule = false;
    (async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        definirCameraDisponible(false);
        return;
      }
      try {
        const appareils = await navigator.mediaDevices.enumerateDevices();
        if (annule) return;
        definirCameraDisponible(
          appareils.length === 0 || appareils.some((appareil) => appareil.kind === 'videoinput'),
        );
      } catch {
        if (!annule) definirCameraDisponible(true); // indéterminé → tenter quand même
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  // Arrêt propre du lecteur au démontage (coupe le flux caméra).
  useEffect(
    () => () => {
      controlesRef.current?.stop();
      controlesRef.current = null;
      videoRef.current?.remove();
      videoRef.current = null;
    },
    [],
  );

  const arreterScan = () => {
    controlesRef.current?.stop();
    controlesRef.current = null;
    videoRef.current?.remove();
    videoRef.current = null;
    definirScanActif(false);
  };

  // Démarre le lecteur ZXing sur la caméra arrière : le callback alimente le
  // champ de saisie (même pipeline que la saisie manuelle : détection de
  // format + clé de contrôle). Les frames sans code (NotFoundException
  // continue) sont ignorées ; un même code est anti-rebondu 2,5 s.
  const demarrerScan = async () => {
    setMessage(null);
    arreterScan();
    const conteneur = conteneurVideoRef.current;
    if (!conteneur) return;
    const video = document.createElement('video');
    video.setAttribute('playsinline', 'true'); // lecture inline (iOS)
    video.muted = true;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    videoRef.current = video;
    conteneur.appendChild(video);

    const indications = new Map();
    indications.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS_CIBLES);
    const lecteur = new BrowserMultiFormatReader(indications);
    try {
      const controles = await lecteur.decodeFromVideoDevice(undefined, video, (resultat) => {
        if (!resultat) return;
        const chiffres = neRetenirQueChiffres(resultat.getText() ?? '');
        if (!chiffres) return;
        const maintenant = Date.now();
        if (
          memoireScan.current.code === chiffres &&
          maintenant - memoireScan.current.depuis < DELAI_MEME_CODE_MS
        ) {
          return;
        }
        memoireScan.current = { code: chiffres, depuis: maintenant };
        setSaisie(chiffres);
        setCodeSoumis(null);
      });
      controlesRef.current = controles;
      definirScanActif(true);
    } catch (erreur) {
      arreterScan();
      const nom = (erreur as { name?: string }).name ?? '';
      setMessage({
        texte:
          nom === 'NotAllowedError'
            ? 'Accès à la caméra refusé — autorise-la dans ton navigateur.'
            : nom === 'NotFoundError' || nom === 'OverconstrainedError'
              ? 'Aucune caméra détectée sur cet appareil.'
              : `Caméra indisponible : ${(erreur as Error).message}`,
        erreur: true,
      });
    }
  };

  const chiffres = neRetenirQueChiffres(saisie);
  const detection = detecterFormat(chiffres);

  const soumettre = () => {
    if (!detection.valide) return;
    setMessage(null);
    setCodeSoumis(chiffres);
  };

  return (
    <KeyboardAvoidingView style={styles.plein} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <View style={styles.centre}>
        <Text style={styles.titre}>Usine — saisie d&rsquo;un code-barres</Text>
        <Text style={styles.aide}>
          Formats acceptés : EAN-8, EAN-13, UPC-A, UPC-E et UPC-B (11 chiffres, sans clé de
          contrôle). Les séparateurs (espaces, tirets) sont ignorés.
        </Text>

        <TextInput
          style={styles.champ}
          value={saisie}
          onChangeText={(nouvelle) => {
            setSaisie(nouvelle);
            setCodeSoumis(null);
          }}
          placeholder="Code-barres"
          placeholderTextColor="#9aa3ab"
          keyboardType="numeric"
          maxLength={13}
        />

        {chiffres.length > 0 && (
          <Text
            style={[
              styles.libelleFormat,
              detection.valide ? styles.formatValide : styles.formatInvalide,
            ]}
          >
            {detection.libelle}
          </Text>
        )}

        {/* Caméra (web) : aperçu du lecteur ZXing + démarrage / arrêt. Le
            conteneur reçoit l'élément <video> natif du navigateur (la View web
            est un <div>, la ref pointe dessus). */}
        {cameraDisponible && (
          <View style={styles.blocCamera}>
            <View
              ref={(element) => {
                conteneurVideoRef.current = element as HTMLElement | null;
              }}
              style={[styles.vision, scanActif && styles.visionActive]}
            />
            <Pressable
              style={({ pressed }) => [styles.boutonScan, pressed && styles.boutonAppuye]}
              onPress={scanActif ? arreterScan : demarrerScan}
            >
              <Text style={styles.boutonScanTexte}>
                {scanActif ? 'Arrêter la caméra' : 'Scanner avec la caméra'}
              </Text>
            </Pressable>
            {scanActif && (
              <Text style={styles.astuce}>Vise un code-barres EAN-8, EAN-13, UPC-A ou UPC-E</Text>
            )}
          </View>
        )}

        <Pressable
          style={[styles.bouton, (!detection.valide || !sessionActive) && styles.boutonDesactive]}
          disabled={!detection.valide || !sessionActive}
          onPress={soumettre}
        >
          <Text style={[styles.boutonTexte, (!detection.valide || !sessionActive) && styles.boutonTexteDesactive]}>
            Fabriquer la carte
          </Text>
        </Pressable>

        {!sessionActive && (
          <Text style={styles.sansSession}>Sans session serveur, la fabrication est indisponible.</Text>
        )}

        {message && (
          <Text style={message.erreur ? styles.erreur : styles.messageSucces}>
            {message.texte}
          </Text>
        )}
      </View>

      <FabricationCarte
        chiffres={codeSoumis}
        surFermer={() => setCodeSoumis(null)}
        // Enregistrement réussi (nom + archive v2) : redirection vers la
        // fenêtre détail de la carte (exigence produit 2026-11-15) — la popup
        // se ferme et la pile empile le détail au-dessus de l'usine.
        surEnregistree={(carteId) => naviguer({ nom: 'carte', carteId })}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  plein: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  titre: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  aide: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: 360,
  },
  champ: {
    width: '86%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#e3e6ea',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 2,
    color: '#111827',
  },
  libelleFormat: {
    fontSize: 14,
    fontWeight: '600',
  },
  formatValide: {
    color: '#2e7d32',
  },
  formatInvalide: {
    color: '#c62828',
  },
  blocCamera: {
    alignItems: 'center',
    gap: 10,
  },
  vision: {
    width: 300,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  visionActive: {
    borderColor: '#43a047',
    borderWidth: 2,
  },
  boutonScan: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#1976d2',
  },
  boutonScanTexte: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  astuce: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  bouton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    backgroundColor: '#43a047',
  },
  boutonAppuye: {
    opacity: 0.85,
  },
  boutonDesactive: {
    backgroundColor: '#e5e7eb',
  },
  boutonTexte: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  boutonTexteDesactive: {
    color: '#9aa3ab',
  },
  sansSession: {
    fontSize: 12,
    color: '#9aa3ab',
    textAlign: 'center',
  },
  messageSucces: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2e7d32',
    textAlign: 'center',
  },
  erreur: {
    fontSize: 13,
    color: '#c62828',
    textAlign: 'center',
  },
});
