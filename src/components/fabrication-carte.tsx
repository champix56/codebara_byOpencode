import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAppSelector } from '../store/hooks';
import {
  genererCarte,
  renommerCarte,
  telechargerCarte,
} from '../services/api';
import { enregistrerCarte, majIndex } from '../services/collection';
import { cdzDepuisBase64, ouvrirCdz, type Cdz } from '../utils/cdz';
import VisuelCarte from './visuel-carte';

// Popup de fabrication d'une carte, partagée par les fenêtres usine (natif et
// web) — recette complète du contrat §6.1 :
//  1) POST /card {cb} (citation du code-barres scanné/saisi) — génération
//     synchrone jusqu'à ~2 min (timeout dédié 150 s) ;
//  2) réponse {cardid, checksum, card, rotation} → base64 → octets →
//     sha256(bytes) == checksum, extraction (signature ZIP + hashs.json) →
//     en cas de corruption interne : re-téléchargement unique GET /card/{id} ;
//  3) stockage immédiat de la v1 : <idUser>/<cardid>.cdz (§6.1) ;
//  4) popup « éclosion » : visuel 3D (front.png / back.png tournables,
//     visuel-carte.tsx) + champ de nom OBLIGATOIRE (décision produit
//     2026-11-03) ;
//  5) PUT /card/name {cid, name} (§5.7) → nouvelle archive → validation
//     interne (ZIP uniquement — le tar.xz du bug §5.7 est refusé, la v1 reste
//     en cache) → remplacement de la v1 par la v2 + maj de l'index du nom.
type Etape =
  | { phase: 'generer' }
  | { phase: 'eclosion'; carteId: number; cdz: Cdz }
  | { phase: 'sans-fichier'; carteId: number }
  | { phase: 'erreur'; message: string };

type Props = {
  chiffres: string | null;
  surFermer: () => void;
  // Appelé après l'enregistrement complet (v2 stockée + index) — le parent
  // affiche son toast de succès et ferme la popup.
  surEnregistree?: (carteId: number, nom: string) => void;
};

export default function FabricationCarte({ chiffres, surFermer, surEnregistree }: Props) {
  const idUser = useAppSelector((etat) => etat.utilisateur.idUser);
  const sessionActive = useAppSelector((etat) => etat.utilisateur.apiToken !== null);

  const [etape, definirEtape] = useState<Etape>({ phase: 'generer' });
  const [nom, definirNom] = useState('');
  const [enEnvoi, definirEnEnvoi] = useState(false);

  // Une seule génération par code soumis (effet strict-mode double ignoré).
  const dejaLance = useRef<string | null>(null);
  // Guard des setState après démontage (fermeture pendant la requête).
  const monteRef = useRef(true);
  useEffect(() => {
    monteRef.current = true;
    return () => {
      monteRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!chiffres || dejaLance.current === chiffres) return;
    dejaLance.current = chiffres;
    (async () => {
      if (!sessionActive) {
        definirEtape({ phase: 'erreur', message: 'Aucune session : connecte-toi pour fabriquer une carte.' });
        return;
      }
      definirEtape({ phase: 'generer' });
      try {
        const carte = await genererCarte(chiffres);
        if (!monteRef.current) return;
        if (!carte.cardBase64) {
          // Réponse asynchrone (mode à venir, §5.3) : la carte est créée côté
          // serveur, son fichier est à aller chercher plus tard.
          definirEtape({ phase: 'sans-fichier', carteId: carte.cardid });
          return;
        }
        let cache = cdzDepuisBase64(carte.cardBase64);
        let cdz: Cdz;
        try {
          cdz = await ouvrirCdz(cache, carte.checksum ?? undefined);
        } catch {
          // Écart au contrôle (transport ou hashs.json) : « re-télécharger la
          // carte » (§6.1/§6.3) — un seul essai via GET /card/{id} (§5.5).
          const telechargee = await telechargerCarte(carte.cardid);
          cache = cdzDepuisBase64(telechargee.cardBase64);
          cdz = await ouvrirCdz(cache, telechargee.cardHash ?? undefined);
        }
        if (!idUser) {
          throw new Error('Utilisateur courant inconnu — impossible de stocker la carte');
        }
        await enregistrerCarte(idUser, carte.cardid, cache);
        if (!monteRef.current) return;
        definirEtape({ phase: 'eclosion', carteId: carte.cardid, cdz });
      } catch (erreur) {
        if (!monteRef.current) return;
        definirEtape({ phase: 'erreur', message: (erreur as Error).message });
      }
    })();
  }, [chiffres, sessionActive, idUser]);

  const nomValide = nom.trim().length > 0;

  // Étape 5 : renommage §5.7 — le nom est OBLIGATOIRE (décision produit) ;
  // réponse {cid, card} sans checksum global → validation par extraction
  // interne ; ZIP uniquement : une archive non-ZIP (tar.xz du bug §5.7) est
  // refusée et la v1 reste en cache. Sur 200 : v2 remplace v1 + index.
  const envoyerNom = async () => {
    if (etape.phase !== 'eclosion' || !nomValide || enEnvoi) return;
    const { carteId } = etape;
    definirEnEnvoi(true);
    try {
      const renommee = await renommerCarte(carteId, nom.trim());
      const octets = cdzDepuisBase64(renommee.cardBase64);
      await ouvrirCdz(octets);
      if (!idUser) throw new Error('Utilisateur courant inconnu');
      await enregistrerCarte(idUser, carteId, octets);
      await majIndex(idUser, carteId, nom.trim());
      if (monteRef.current) surEnregistree?.(carteId, nom.trim());
      surFermer();
    } catch (erreur) {
      const brut = (erreur as Error).message;
      const message = /non-ZIP|invalide/i.test(brut)
        ? `La version finale a été refusée (${brut}). La version d’origine reste dans la collection.`
        : brut;
      definirEtape({ phase: 'erreur', message });
    } finally {
      definirEnEnvoi(false);
    }
  };

  return (
    <Modal visible={chiffres !== null} animationType="fade" transparent>
      <View style={styles.voile}>
        <View style={styles.cadre}>
          {etape.phase === 'generer' && (
            <View style={styles.centre}>
              <ActivityIndicator size="large" color="#43a047" />
              <Text style={styles.titre}>{'Fabriquer la carte'}</Text>
              <Text style={styles.texte}>
                Génération en cours — une illustration IA est produite, cela peut prendre
                jusqu’à 2 minutes.
              </Text>
            </View>
          )}

          {etape.phase === 'eclosion' && (
            <View style={styles.centre}>
              <Text style={styles.titre}>Éclosion — carte #{etape.carteId}</Text>
              {/* Visuel 3D : front/back tournables (glisser = tourner). */}
              <VisuelCarte cdz={etape.cdz} largeur={220} />
              <Text style={styles.label}>Nom de la carte</Text>
              <TextInput
                style={styles.champ}
                value={nom}
                onChangeText={definirNom}
                placeholder="Obligatoire"
                placeholderTextColor="#9ca3af"
                autoCapitalize="sentences"
                maxLength={60}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.bouton,
                  (!nomValide || enEnvoi) && styles.boutonDesactive,
                  pressed && nomValide && !enEnvoi && styles.boutonAppuye,
                ]}
                disabled={!nomValide || enEnvoi}
                onPress={envoyerNom}
              >
                <Text style={styles.boutonTexte}>{enEnvoi ? 'Envoi…' : 'Envoyer le nom'}</Text>
              </Pressable>
            </View>
          )}

          {etape.phase === 'sans-fichier' && (
            <View style={styles.centre}>
              <Text style={styles.titre}>Carte #{etape.carteId} créée</Text>
              <Text style={styles.texte}>
                Le serveur prépare son fichier : la carte apparaîtra dans la maison une fois
                finalisée (interroge la collection plus tard).
              </Text>
              <Pressable style={styles.bouton} onPress={surFermer}>
                <Text style={styles.boutonTexte}>Compris</Text>
              </Pressable>
            </View>
          )}

          {etape.phase === 'erreur' && (
            <View style={styles.centre}>
              <Text style={styles.titre}>Échec de fabrication</Text>
              <Text style={styles.erreur}>{etape.message}</Text>
              <Pressable style={[styles.bouton, styles.boutonNeutre]} onPress={surFermer}>
                <Text style={styles.boutonTexte}>Fermer</Text>
              </Pressable>
            </View>
          )}

          {etape.phase !== 'generer' && (
            <Pressable hitSlop={8} onPress={surFermer} style={styles.croix}>
              <Text style={styles.croixTexte}>Fermer</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  voile: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cadre: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 20,
  },
  centre: {
    gap: 10,
  },
  titre: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  texte: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  erreur: {
    fontSize: 13,
    color: '#c62828',
    textAlign: 'center',
  },
  front: {
    width: '88%',
    alignSelf: 'center',
    borderRadius: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  champ: {
    height: 44,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#1f2937',
  },
  bouton: {
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#43a047',
    marginTop: 4,
  },
  boutonAppuye: {
    backgroundColor: '#3b8b40',
  },
  boutonDesactive: {
    backgroundColor: '#a5d6a7',
  },
  boutonNeutre: {
    backgroundColor: '#6b7280',
  },
  boutonTexte: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  croix: {
    position: 'absolute',
    top: 10,
    right: 12,
    padding: 6,
  },
  croixTexte: {
    fontSize: 13,
    color: '#6b7280',
    textDecorationLine: 'underline',
  },
});
