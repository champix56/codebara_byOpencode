import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { FormatCode } from '../utils/codes-bar';
import { LIBELLE_FORMAT, detecterFormat, neRetenirQueChiffres, verifierCode } from '../utils/codes-bar';
import { useAppSelector } from '../store/hooks';
import FabricationCarte from './fabrication-carte';

// Fenêtre usine côté natif (iOS / Android) : scanneur de codes-barres. Un seul
// appareil actif à la fois — la fenêtre est démontée par la pile quand l'utilisateur
// repart, ce qui coupe la caméra. Le scanneur est limité aux formats produits
// gérés par la validation ; l'UPC-B (11 chiffres sans clé) n'a pas de symbologie
// caméra et reste réservé à la saisie web.
const TYPES_CIBLES: FormatCode[] = ['ean8', 'ean13', 'upc_a', 'upc_e'];

// Un même code relu en rafale est ignoré pendant ce délai (une lecture = une action).
const DELAI_MEME_CODE_MS = 2500;

type ScanScanneur = { data: string; type: string };
type Scan = { chiffres: string; format: FormatCode; valide: boolean };

export default function UsineEcran() {
  const [permission, demanderPermission] = useCameraPermissions();
  const [dernierScan, setDernierScan] = useState<Scan | null>(null);
  const [fabrication, definirFabrication] = useState<string | null>(null);
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);
  const apiToken = useAppSelector((etat) => etat.utilisateur.apiToken);
  const sessionActive = apiToken !== null;

  // Anti-rafale : code identique ignoré quelques secondes.
  const memoireScan = useRef<{ code: string; depuis: number }>({ code: '', depuis: 0 });
  // Une seule demande automatique au montage (sinon re-prompt en boucle après refus).
  const aDemanderRef = useRef(false);

  useEffect(() => {
    if (permission === null || aDemanderRef.current) return;
    if (permission.granted === false && permission.canAskAgain) {
      aDemanderRef.current = true;
      demanderPermission();
    }
  }, [permission, demanderPermission]);

  const gererScan = (evenement: ScanScanneur) => {
    const chiffres = neRetenirQueChiffres(evenement.data ?? '');
    if (!chiffres) return;

    const maintenant = Date.now();
    if (
      memoireScan.current.code === chiffres &&
      maintenant - memoireScan.current.depuis < DELAI_MEME_CODE_MS
    ) {
      return;
    }
    memoireScan.current = { code: chiffres, depuis: maintenant };

    // Un nouveau scan hors fabrication invalide le message précédent.
    if (fabrication === null) setMessage(null);

    // Le type de la caméra fait foi — il lève l'ambiguïté EAN-8 / UPC-E ; sinon
    // (type inattendu) on retombe sur la détection par longueur.
    const format = (TYPES_CIBLES as string[]).includes(evenement.type)
      ? (evenement.type as FormatCode)
      : detecterFormat(chiffres).format;
    if (!format) return;

    setDernierScan({
      chiffres,
      format,
      valide: verifierCode(chiffres, format),
    });
  };

  // Permission en cours de résolution (déterminée au premier rendu en pratique).
  if (permission === null) {
    return (
      <View style={[styles.plein, styles.fondMessage]}>
        <Text style={styles.texteMessage}>Préparation de la caméra…</Text>
      </View>
    );
  }

  // Permission absente : écran dédié avec relance de la demande et accès aux
  // réglages système (cas du refus définitif).
  if (!permission.granted) {
    return (
      <View style={[styles.plein, styles.fondMessage]}>
        <Text style={styles.titreMessage}>Caméra indisponible</Text>
        <Text style={styles.texteMessage}>
          L&rsquo;usine a besoin de la caméra pour lire les codes-barres.
        </Text>
        <Pressable style={styles.activer} onPress={() => demanderPermission()}>
          <Text style={styles.activerTexte}>Activer la caméra</Text>
        </Pressable>
        <Pressable hitSlop={8} onPress={() => Linking.openSettings()}>
          <Text style={styles.reglages}>Ouvrir les réglages</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.plein}>
      <CameraView
        style={styles.appareil}
        onBarcodeScanned={gererScan}
        barcodeScannerSettings={{
          barcodeTypes: ['ean8', 'ean13', 'upc_a', 'upc_e'],
        }}
      />
      <View style={styles.panneau}>
        {dernierScan === null ? (
          <Text style={styles.astuce}>Visez un code-barres EAN-8, EAN-13, UPC-A ou UPC-E</Text>
        ) : (
          <>
            <View style={styles.ligne}>
              <Text style={styles.formatScan}>{LIBELLE_FORMAT[dernierScan.format]}</Text>
              <Text
                style={[
                  styles.badge,
                  dernierScan.valide ? styles.badgeValide : styles.badgeInvalide,
                ]}
              >
                {dernierScan.valide ? 'Code valide' : 'Clé de contrôle invalide'}
              </Text>
            </View>
            <Text style={styles.codeScan}>{dernierScan.chiffres}</Text>

            <Pressable
              style={({ pressed }) => [
                styles.boutonFabriquer,
                (!dernierScan.valide || !sessionActive || fabrication !== null) &&
                  styles.boutonFabriquerDesactive,
                pressed &&
                  dernierScan.valide &&
                  sessionActive &&
                  fabrication === null &&
                  styles.boutonFabriquerAppuye,
              ]}
              disabled={!dernierScan.valide || !sessionActive || fabrication !== null}
              onPress={() => definirFabrication(dernierScan.chiffres)}
            >
              <Text style={styles.boutonFabriquerTexte}>Fabriquer la carte</Text>
            </Pressable>

            {!sessionActive && (
              <Text style={styles.sansSession}>
                Sans session serveur, la fabrication est indisponible.
              </Text>
            )}
          </>
        )}

        {message && (
          <Text style={message.erreur ? styles.erreur : styles.messageSucces}>
            {message.texte}
          </Text>
        )}
      </View>

      <FabricationCarte
        chiffres={fabrication}
        surFermer={() => definirFabrication(null)}
        surEnregistree={(carteId, nom) =>
          setMessage({
            texte: `Carte #${carteId} « ${nom} » enregistrée — vois-la dans la maison.`,
            erreur: false,
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  plein: {
    flex: 1,
    backgroundColor: '#000000',
  },
  appareil: {
    flex: 1,
  },
  fondMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 32,
  },
  titreMessage: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  texteMessage: {
    fontSize: 14,
    color: '#d1d5db',
    textAlign: 'center',
  },
  activer: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: '#43a047',
  },
  activerTexte: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  reglages: {
    fontSize: 14,
    color: '#93c5fd',
    textDecorationLine: 'underline',
  },
  panneau: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 6,
  },
  astuce: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formatScan: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  badge: {
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  badgeValide: {
    backgroundColor: '#e6f4ea',
    color: '#2e7d32',
  },
  badgeInvalide: {
    backgroundColor: '#fdecea',
    color: '#c62828',
  },
  codeScan: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 2,
  },
  boutonFabriquer: {
    marginTop: 4,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#43a047',
  },
  boutonFabriquerAppuye: {
    backgroundColor: '#3b8b40',
  },
  boutonFabriquerDesactive: {
    backgroundColor: '#a5d6a7',
  },
  boutonFabriquerTexte: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  sansSession: {
    fontSize: 12,
    color: '#9ca3af',
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
