import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ErreurApi,
  renommerCarte,
  telechargerCarte,
} from '../services/api';
import { enregistrerCarte, lireCarteLocale, majIndex } from '../services/collection';
import { useAppSelector } from '../store/hooks';
import { cdzDepuisBase64, ouvrirCdz, type Cdz } from '../utils/cdz';
import { encoderBase64 } from '../utils/base64';
import VisuelCarte from './visuel-carte';

// Fenêtre détail d'une carte (ouvert depuis la liste de la maison) :
// l'archive .cdz vient du cache local <idUser>/<carteId>.cdz (§6.6) — ou, à
// défaut, GET /card/{id} (§5.5, il renvoie TOUJOURS le fichier) : validation
// complète (checksum global == cardHash, §6.3), stockage, maj de l'index du
// nom. Rotation des tokens gérée par le service. Le nom est renommable
// sur place (✎ — PUT /card/name §5.7, v2 remplace le cache + index).
type Etat =
  | { phase: 'chargement' }
  | { phase: 'pret'; cdz: Cdz; serveur: { cardpower: number | null; health: number | null; attack: number | null } | null }
  | { phase: 'sans-session' }
  | { phase: 'erreur'; message: string };

export default function CarteDetail({ carteId }: { carteId: number }) {
  // NE PAS importer requestToken : il change À CHAQUE appel protégé réussi
  // (rotation §3.3) — en dépendance de charger/useEffect, le chargement
  // repartait en boucle ou en double requête. Le service lit le token vivant
  // dans le store au moment de l'appel.
  const { idUser, apiToken } = useAppSelector((etat) => etat.utilisateur);
  const [etat, definirEtat] = useState<Etat>({ phase: 'chargement' });

  // Renommage sur place (§5.7) — exigence produit 2026-11-15 : le nom est
  // éditable depuis le détail, comme depuis l'éclosion de l'usine. Le serveur
  // renvoie l'archive mise à jour (sans checksum global) : validation par
  // extraction interne, remplacement du cache local + index du nom.
  const [renommage, definirRenommage] = useState<{
    actif: boolean;
    nom: string;
    enCours: boolean;
    erreur: string | null;
  }>({ actif: false, nom: '', enCours: false, erreur: null });

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
        if (!apiToken) {
          definirEtat({ phase: 'sans-session' });
          return;
        }
        const serveur = await telechargerCarte(carteId);
        const octets = cdzDepuisBase64(serveur.cardBase64);
        cdz = await ouvrirCdz(octets, serveur.cardHash ?? undefined);
        if (idUser !== null) {
          await enregistrerCarte(idUser, carteId, octets);
          if (cdz.datas.name) {
            await majIndex(idUser, carteId, cdz.datas.name, {
              id: cdz.datas.seasonid,
              nom: cdz.datas.saison,
            });
          }
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
  }, [carteId, idUser, apiToken]); // pas de requestToken — rotation §3.3

  useEffect(() => {
    (async () => charger())();
  }, [charger]);

  const imagePerso = useMemo(
    () =>
      etat.phase === 'pret'
        ? { uri: `data:image/png;base64,${encoderBase64(etat.cdz.perso)}` }
        : null,
    [etat],
  );

  // Envoi du nouveau nom (PUT /card/name §5.7) : archive reçue validée par
  // extraction interne (ZIP + hashs.json), v2 remplace la v1 du cache local,
  // index du nom (+ saison, pour la liste des saisons de la maison) mis à
  // jour, puis l'affichage repart sur la nouvelle archive. La v1 reste en
  // cache si l'archive reçue est invalide (non-ZIP, tar.xz du bug §5.7).
  const envoyerRenommage = useCallback(async () => {
    if (etat.phase !== 'pret' || renommage.enCours) return;
    const nom = renommage.nom.trim();
    if (nom.length === 0) return;
    definirRenommage((actuel) => ({ ...actuel, enCours: true, erreur: null }));
    try {
      const renommee = await renommerCarte(carteId, nom);
      const octets = cdzDepuisBase64(renommee.cardBase64);
      const cdz = await ouvrirCdz(octets);
      if (idUser !== null) {
        await enregistrerCarte(idUser, carteId, octets);
        await majIndex(idUser, carteId, nom, {
          id: cdz.datas.seasonid,
          nom: cdz.datas.saison,
        });
      }
      definirEtat((actuel) =>
        actuel.phase === 'pret' ? { ...actuel, cdz } : actuel,
      );
      definirRenommage({ actif: false, nom: '', enCours: false, erreur: null });
    } catch (erreur) {
      const brut = (erreur as Error).message;
      definirRenommage((actuel) => ({
        ...actuel,
        enCours: false,
        erreur: /non-ZIP|invalide/i.test(brut)
          ? `Version finale refusée (${brut}) — l'archive d'origine reste en place.`
          : brut,
      }));
    }
  }, [etat, renommage, carteId, idUser]);

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
        {renommage.actif ? (
          <View style={styles.renommage}>
            <TextInput
              style={styles.champNom}
              value={renommage.nom}
              onChangeText={(nouveau) =>
                definirRenommage((actuel) => ({ ...actuel, nom: nouveau }))
              }
              placeholder="Nouveau nom"
              placeholderTextColor="#9ca3af"
              maxLength={60}
              autoFocus
              editable={!renommage.enCours}
            />
            {renommage.erreur && <Text style={styles.erreurRenommage}>{renommage.erreur}</Text>}
            <View style={styles.renommageBoutons}>
              <Pressable
                style={({ pressed }) => [
                  styles.bouton,
                  (renommage.enCours || renommage.nom.trim().length === 0) &&
                    styles.boutonDesactive,
                  pressed && styles.boutonAppuye,
                ]}
                disabled={renommage.enCours || renommage.nom.trim().length === 0}
                onPress={envoyerRenommage}
              >
                <Text style={styles.boutonTexte}>
                  {renommage.enCours ? 'Envoi…' : 'Enregistrer'}
                </Text>
              </Pressable>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  definirRenommage({ actif: false, nom: '', enCours: false, erreur: null })
                }
                disabled={renommage.enCours}
              >
                <Text style={styles.annuler}>Annuler</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.enteteTexte}>
            <View style={styles.ligneNom}>
              <Text style={styles.nom} numberOfLines={1}>
                {nom}
              </Text>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  definirRenommage({ actif: true, nom, enCours: false, erreur: null })
                }
                accessibilityLabel={`Renommer la carte ${nom}`}
              >
                <Text style={styles.crayon}>✎</Text>
              </Pressable>
            </View>
            <Text style={styles.numero}>#{carteId}</Text>
          </View>
        )}
      </View>

      {/* Visuel 3D : faces front/back de l'archive, rotation par glissement
          (360° horizontal, ±30° vertical pour les reflets de lumière). */}
      <VisuelCarte cdz={cdz} largeur={300} />

      <View style={styles.stats}>
        <Text style={styles.statLigne}>
          Puissance&nbsp;: {cdz.datas.power ?? serveur?.cardpower ?? '—'}
        </Text>
        <Text style={styles.statLigne}>Santé&nbsp;: {cdz.datas.health ?? serveur?.health ?? '—'}</Text>
        <Text style={styles.statLigne}>Attaque&nbsp;: {cdz.datas.attack ?? serveur?.attack ?? '—'}</Text>
        <Text style={styles.statLigne}>Rareté&nbsp;: {cdz.datas.rarity ?? '—'}</Text>
        <Text style={styles.statLigne}>
          Saison&nbsp;: {cdz.datas.saison ?? cdz.datas.seasonid ?? '—'}
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
  ligneNom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  crayon: {
    fontSize: 16,
    color: '#43a047',
    paddingHorizontal: 4,
  },
  renommage: {
    flex: 1,
    gap: 8,
  },
  champNom: {
    height: 42,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#1f2937',
    backgroundColor: '#ffffff',
  },
  renommageBoutons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  erreurRenommage: {
    fontSize: 13,
    color: '#c62828',
  },
  annuler: {
    fontSize: 14,
    color: '#6b7280',
    textDecorationLine: 'underline',
  },
  boutonDesactive: {
    backgroundColor: '#a5d6a7',
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
