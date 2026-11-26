import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { definirBlocageRetour } from '../navigation/navigateur';
import {
  accepterCarteEnAttente,
  listerNotifications,
  marquerNotificationLue,
  obtenirNotification,
  refuserCarteEnAttente,
  type NotificationServeur,
} from '../services/api';
import { enregistrerCarte, majIndex } from '../services/collection';
import { useAppSelector } from '../store/hooks';
import { cdzDepuisBase64, ouvrirCdz, type Cdz } from '../utils/cdz';
import IconeNotification from './icone-notification';
import VisuelCarte from './visuel-carte';

// Fenêtre « Poste » : messagerie du joueur. La liste n'affiche que l'objet de
// chaque notification (§ contrat serveur). Ouvrir une notification la marque
// comme lue (PUT) puis charge son détail (GET).
//
// Une notification de carte ACHEVÉE impose de rester sur la page : le retour
// (en-tête, bouton Android, historique web) est verrouillé et une modal propose
// le visuel 3D + les stats + Accepter / Refuser. Le nom demandé à l'acceptation
// est OPTIONNEL. Une carte en ÉCHEC est supprimée dès l'ouverture (DELETE).
const INTERVALLE_RAFRAICHISSEMENT_MS = 30_000;

export default function PosteEcran() {
  const idUser = useAppSelector((etat) => etat.utilisateur.idUser);
  const [notifications, definirNotifications] = useState<NotificationServeur[]>([]);
  const [selection, definirSelection] = useState<NotificationServeur | null>(null);
  const [cdz, definirCdz] = useState<Cdz | null>(null);
  const [nom, definirNom] = useState('');
  const [demandeNom, definirDemandeNom] = useState(false);
  const [enTraitement, definirEnTraitement] = useState(false);
  const [erreur, definirErreur] = useState<string | null>(null);
  const [charge, definirCharge] = useState(true);
  const monte = useRef(true);

  useEffect(() => {
    monte.current = true;
    return () => {
      monte.current = false;
      definirBlocageRetour(false);
    };
  }, []);

  const charger = useCallback(async () => {
    try {
      const liste = await listerNotifications(idUser);
      if (monte.current) definirNotifications(liste);
    } catch (e) {
      if (monte.current) definirErreur((e as Error).message);
    } finally {
      if (monte.current) definirCharge(false);
    }
  }, [idUser]);

  useEffect(() => {
    // IIFE async comme dans maison-ecran : le chargement démarre bien au
    // montage sans appeler setState directement dans le corps de l'effet.
    (async () => charger())();
    const minuteur = setInterval(() => {
      if (monte.current && selection === null) (async () => charger())();
    }, INTERVALLE_RAFRAICHISSEMENT_MS);
    return () => clearInterval(minuteur);
  }, [charger, selection]);

  // Ouvre la notification : PUT (marquer lue) puis GET (détail).
  const ouvrir = async (notification: NotificationServeur) => {
    definirErreur(null);
    definirEnTraitement(true);
    try {
      await marquerNotificationLue(notification.id);
      const detail = await obtenirNotification(notification.id);
      if (!monte.current) return;

      const carteAchevee =
        detail.type === 'nouvelles cartes' &&
        detail.cardid !== null &&
        detail.card &&
        detail.reception?.state === 'achevé';

      if (carteAchevee) {
        let archive: Cdz | null = null;
        try {
          archive = await ouvrirCdz(
            cdzDepuisBase64(detail.card as string),
            detail.checksum || undefined,
          );
        } catch {
          definirErreur('Archive de la carte illisible — elle peut quand même être acceptée ou refusée.');
        }
        definirBlocageRetour(true);
        definirCdz(archive);
        definirNom('');
        definirDemandeNom(false);
        definirSelection(detail);
        return;
      }

      // Carte en échec : la notification ouverte déclenche directement DELETE.
      if (detail.cardid !== null) {
        await refuserCarteEnAttente(detail.cardid);
        if (!monte.current) return;
        await charger();
      }
      definirSelection({ ...detail, card: undefined });
    } catch (e) {
      if (monte.current) definirErreur((e as Error).message);
    } finally {
      if (monte.current) definirEnTraitement(false);
    }
  };

  const terminer = async () => {
    definirBlocageRetour(false);
    definirSelection(null);
    definirCdz(null);
    definirNom('');
    definirDemandeNom(false);
    definirEnTraitement(false);
    await charger();
  };

  const confirmerAcceptation = async () => {
    if (!selection?.cardid || enTraitement) return;
    definirEnTraitement(true);
    definirErreur(null);
    try {
      const recue = await accepterCarteEnAttente(
        selection.cardid,
        nom.trim() ? nom.trim() : undefined,
      );
      const octets = cdzDepuisBase64(recue.cardBase64);
      let archive = cdz;
      if (!archive) archive = await ouvrirCdz(octets);
      if (idUser !== null) {
        await enregistrerCarte(idUser, recue.cardid, octets);
        await majIndex(
          idUser,
          recue.cardid,
          nom.trim() || archive.datas.name || '',
          { id: archive.datas.seasonid, nom: archive.datas.saison },
        );
      }
      await terminer();
    } catch (e) {
      if (monte.current) definirErreur((e as Error).message);
    } finally {
      if (monte.current) definirEnTraitement(false);
    }
  };

  const refuser = async () => {
    if (!selection?.cardid || enTraitement) return;
    definirEnTraitement(true);
    try {
      await refuserCarteEnAttente(selection.cardid);
      await terminer();
    } catch (e) {
      if (monte.current) definirErreur((e as Error).message);
    } finally {
      if (monte.current) definirEnTraitement(false);
    }
  };

  const stats = cdz?.datas;

  return (
    <View style={styles.plein}>
      <ScrollView contentContainerStyle={styles.liste}>
        {charge && <ActivityIndicator color="#43a047" />}
        {!charge && notifications.length === 0 && (
          <Text style={styles.vide}>Aucune notification pour le moment.</Text>
        )}
        {notifications.map((notification) => (
          <Pressable
            key={notification.id}
            style={({ pressed }) => [styles.message, pressed && styles.messagePresse]}
            onPress={() => ouvrir(notification)}
            accessibilityLabel={`Ouvrir : ${notification.object}`}
          >
            <IconeNotification echec={notification.type === 'information'} />
            {/* Contrat : l'objet seul est affiché dans la liste (v0.0.19). */}
            <Text style={styles.objet}>{notification.object}</Text>
          </Pressable>
        ))}
        {erreur && selection === null && <Text style={styles.erreur}>{erreur}</Text>}
      </ScrollView>

      <Modal visible={selection !== null} animationType="fade" transparent>
        <View style={styles.voile}>
          <View style={styles.cadre}>
            {enTraitement && <ActivityIndicator color="#43a047" />}

            {selection?.card && (
              <>
                <Text style={styles.titre}>
                  {selection.cardid ? `Carte #${selection.cardid}` : selection.object}
                </Text>
                {cdz && <VisuelCarte cdz={cdz} largeur={180} />}
                <View style={styles.stats}>
                  <Text style={styles.stat}>Santé : {stats?.health ?? '—'}</Text>
                  <Text style={styles.stat}>Attaque : {stats?.attack ?? '—'}</Text>
                  <Text style={styles.stat}>Puissance : {stats?.power ?? '—'}</Text>
                </View>
              </>
            )}

            {selection && !selection.card && (
              <>
                <IconeNotification echec />
                <Text style={styles.titre}>{selection.object}</Text>
                <Text style={styles.texte}>
                  {selection.reason
                    ? `Motif de l’échec : ${selection.reason}`
                    : 'Cette carte n’a pas pu être générée. Elle a été retirée de la file.'}
                </Text>
              </>
            )}

            {erreur && <Text style={styles.erreur}>{erreur}</Text>}

            {/* Carte achevée : aucun bouton Fermer — acceptation ou refus obligatoire. */}
            {selection?.card && !demandeNom && (
              <View style={styles.actions}>
                <Pressable
                  style={[styles.bouton, styles.boutonAccepter]}
                  onPress={() => definirDemandeNom(true)}
                  disabled={enTraitement}
                >
                  <Text style={styles.boutonTexte}>Accepter</Text>
                </Pressable>
                <Pressable
                  style={[styles.bouton, styles.boutonRefuser]}
                  onPress={refuser}
                  disabled={enTraitement}
                >
                  <Text style={styles.boutonTexte}>Refuser</Text>
                </Pressable>
              </View>
            )}

            {selection?.card && demandeNom && (
              <View style={styles.actions}>
                <Text style={styles.label}>Nom de la carte (facultatif)</Text>
                <TextInput
                  style={styles.champ}
                  value={nom}
                  onChangeText={definirNom}
                  placeholder="Sans nom"
                  placeholderTextColor="#9ca3af"
                  maxLength={60}
                />
                <Pressable
                  style={[styles.bouton, styles.boutonAccepter]}
                  onPress={confirmerAcceptation}
                  disabled={enTraitement}
                >
                  <Text style={styles.boutonTexte}>Confirmer</Text>
                </Pressable>
                <Pressable
                  style={[styles.bouton, styles.boutonNeutre]}
                  onPress={() => definirDemandeNom(false)}
                  disabled={enTraitement}
                >
                  <Text style={styles.boutonTexte}>Retour</Text>
                </Pressable>
              </View>
            )}

            {selection && !selection.card && !enTraitement && (
              <Pressable style={[styles.bouton, styles.boutonNeutre]} onPress={terminer}>
                <Text style={styles.boutonTexte}>Compris</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  plein: { flex: 1, backgroundColor: '#f9fafb' },
  liste: { padding: 16, gap: 10 },
  vide: { color: '#6b7280', textAlign: 'center', marginTop: 32 },
  messagePresse: { backgroundColor: '#f3f4f6' },
  message: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  objet: { fontSize: 15, color: '#1f2937', flexShrink: 1 },
  erreur: { color: '#c62828', textAlign: 'center', fontSize: 13 },
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
    maxHeight: '90%',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 20,
    gap: 12,
  },
  titre: { fontSize: 18, fontWeight: '700', color: '#1f2937', textAlign: 'center' },
  texte: { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  stats: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap' },
  stat: { fontSize: 12, color: '#374151' },
  label: { fontSize: 13, color: '#374151' },
  champ: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#1f2937',
  },
  actions: { gap: 8 },
  bouton: { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  boutonAccepter: { backgroundColor: '#43a047' },
  boutonRefuser: { backgroundColor: '#c62828' },
  boutonNeutre: { backgroundColor: '#e5e7eb' },
  boutonTexte: { color: '#ffffff', fontWeight: '700' },
});
