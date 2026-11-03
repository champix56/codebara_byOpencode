import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ErreurApi,
  telechargerCarte,
} from '../services/api';
import { enregistrerCarte, lireCarteLocale, majIndex } from '../services/collection';
import { useAppSelector } from '../store/hooks';
import { cdzDepuisBase64, ouvrirCdz, type Cdz } from '../utils/cdz';
import { encoderBase64 } from '../utils/base64';

// Fenêtre détail d'une carte (ouvert depuis la liste de la maison) :
// l'archive .cdz vient du cache local <idUser>/<carteId>.cdz (§6.6) — ou, à
// défaut, GET /card/{id} (§5.5, il renvoie TOUJOURS le fichier) : validation
// complète (checksum global == cardHash, §6.3), stockage, maj de l'index du
// nom. Rotation des tokens gérée par le service.
type Etat =
  | { phase: 'chargement' }
  | { phase: 'pret'; cdz: Cdz; serveur: { cardpower: number | null; health: number | null; attack: number | null } | null }
  | { phase: 'sans-session' }
  | { phase: 'erreur'; message: string };

export default function CarteDetail({ carteId }: { carteId: number }) {
  const { idUser, apiToken, requestToken } = useAppSelector((etat) => etat.utilisateur);
  const [etat, definirEtat] = useState<Etat>({ phase: 'chargement' });

  const charger = useCallback(async () => {
    definirEtat({ phase: 'chargement' });
    if (!Number.isFinite(carteId)) {
      definirEtat({ phase: 'erreur', message: 'Numéro de carte inconnu' });
      return;
    }
    try {
      // 1) Cache local (§6.6) — une extraction ratée (archive illisible ou
      // corrompue) retombe sur le serveur.
      let brute = idUser === null ? null : await lireCarteLocale(idUser, carteId);
      let cdz: Cdz | null = null;
      if (brute) {
        try {
          cdz = await ouvrirCdz(brute);
        } catch {
          brute = null;
        }
      }
      // 2) Serveur — validation global (sha256 == cardHash) puis stockage.
      if (!cdz) {
        if (!apiToken || !requestToken) {
          definirEtat({ phase: 'sans-session' });
          return;
        }
        const serveur = await telechargerCarte(carteId);
        const octets = cdzDepuisBase64(serveur.cardBase64);
        cdz = await ouvrirCdz(octets, serveur.cardHash ?? undefined);
        if (idUser !== null) {
          await enregistrerCarte(idUser, carteId, octets);
          if (cdz.datas.name) await majIndex(idUser, carteId, cdz.datas.name);
        }
        definirEtat({
          phase: 'pret',
          cdz,
          serveur: {
            cardpower: serveur.cardpower,
            health: serveur.health,
            attack: serveur.attack,
          },
        });
        return;
      }
      definirEtat({ phase: 'pret', cdz, serveur: null });
    } catch (erreur) {
      if (erreur instanceof ErreurApi && erreur.message.includes('Aucune session')) {
        definirEtat({ phase: 'sans-session' });
        return;
      }
      definirEtat({ phase: 'erreur', message: (erreur as Error).message });
    }
  }, [carteId, idUser, apiToken, requestToken]);

  useEffect(() => {
    (async () => charger())();
  }, [charger]);

  const imageFront = useMemo(
    () =>
      etat.phase === 'pret'
        ? { uri: `data:image/png;base64,${encoderBase64(etat.cdz.front)}` }
        : null,
    [etat],
  );
  const imagePerso = useMemo(
    () =>
      etat.phase === 'pret'
        ? { uri: `data:image/png;base64,${encoderBase64(etat.cdz.perso)}` }
        : null,
    [etat],
  );

  if (etat.phase === 'chargement' || etat.phase === 'erreur' || etat.phase === 'sans-session') {
    const libelle =
      etat.phase === 'sans-session'
        ? 'Connecte-toi pour ouvrir le détail de cette carte.'
        : etat.phase === 'erreur'
          ? etat.message
          : 'Chargement de la carte…';
    return (
      <View style={[styles.plein, styles.centre]}>
        <Text style={etat.phase === 'erreur' ? styles.erreur : styles.texteState}>{libelle}</Text>
        {etat.phase !== 'chargement' && (
          <Pressable
            style={({ pressed }) => [styles.bouton, pressed && styles.boutonAppuye]}
            onPress={charger}
          >
            <Text style={styles.boutonTexte}>Réessayer</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const { cdz, serveur } = etat;
  const nom = cdz.datas.name && cdz.datas.name.length > 0 ? cdz.datas.name : `Carte #${carteId}`;

  return (
    <ScrollView style={styles.plein} contentContainerStyle={styles.contenu}>
      <View style={styles.entete}>
        {imagePerso && <Image source={imagePerso} style={styles.perso} resizeMode="contain" />}
        <View style={styles.enteteTexte}>
          <Text style={styles.nom}>{nom}</Text>
          <Text style={styles.numero}>#{carteId}</Text>
        </View>
      </View>

      {imageFront && (
        <Image
          source={imageFront}
          style={[styles.front, { aspectRatio: 600 / 1037 }]}
          resizeMode="contain"
        />
      )}

      <View style={styles.stats}>
        <Text style={styles.statLigne}>
          Puissance&nbsp;: {cdz.datas.power ?? serveur?.cardpower ?? '—'}
        </Text>
        <Text style={styles.statLigne}>Santé&nbsp;: {cdz.datas.health ?? serveur?.health ?? '—'}</Text>
        <Text style={styles.statLigne}>Attaque&nbsp;: {cdz.datas.attack ?? serveur?.attack ?? '—'}</Text>
        <Text style={styles.statLigne}>Rareté&nbsp;: {cdz.datas.rarity ?? '—'}</Text>
        <Text style={styles.statLigne}>
          Saison&nbsp;: {cdz.datas.seasonid ?? '—'}
        </Text>
      </View>

      {cdz.datas.specials.length > 0 && (
        <View style={styles.specials}>
          <Text style={styles.titreSpecials}>Capacités spéciales</Text>
          {cdz.datas.specials.map((special, index) => (
            <Text key={index} style={styles.special}>
              {`• ${special.name ?? '—'} — attaque ${special.attack ?? '—'}, santé ${special.health ?? '—'}, ${special.turn ?? '—'} tour(s)`}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  plein: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contenu: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 40,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  texteState: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  erreur: {
    fontSize: 14,
    color: '#c62828',
    textAlign: 'center',
  },
  bouton: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#43a047',
  },
  boutonAppuye: {
    backgroundColor: '#3b8b40',
  },
  boutonTexte: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 360,
  },
  perso: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  enteteTexte: {
    flex: 1,
  },
  nom: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  numero: {
    fontSize: 13,
    color: '#9ca3af',
  },
  front: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 12,
    marginTop: 16,
    backgroundColor: '#fafafa',
  },
  stats: {
    marginTop: 18,
    gap: 4,
  },
  statLigne: {
    fontSize: 15,
    color: '#374151',
  },
  specials: {
    marginTop: 16,
    gap: 6,
  },
  titreSpecials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  special: {
    fontSize: 13,
    color: '#4b5563',
  },
});
