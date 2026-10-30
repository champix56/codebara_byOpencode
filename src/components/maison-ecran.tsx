import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ErreurSession, listerCartes, type CarteListee } from '../services/api';
import { useAppSelector } from '../store/hooks';

// Fenêtre maison : liste des cartes en possession du joueur — GET /card du
// serveur pyCodebara2 (contrat §5.4) : id, checksum, puissance, santé, attaque.
// Le rendu graphique et le nom viendront du fichier .cdz (perso.png / datas.json,
// GET /card/{id}) — ici, la liste brute fait foi pour la collection.
type EtatListe =
  | { phase: 'chargement' }
  | { phase: 'pret' }
  | { phase: 'vide' }
  | { phase: 'sans-session' }
  | { phase: 'erreur'; message: string };

export default function MaisonEcran() {
  const { apiToken, requestToken } = useAppSelector((etat) => etat.utilisateur);
  const [etat, definirEtat] = useState<EtatListe>({ phase: 'chargement' });
  const [cartes, definirCartes] = useState<CarteListee[]>([]);
  const [rafraichit, definirRafraichit] = useState(false);

  const charger = useCallback(
    async (modeRafraichit: boolean) => {
      if (!apiToken || !requestToken) {
        definirEtat({ phase: 'sans-session' });
        return;
      }
      definirEtat({ phase: 'chargement' });
      if (modeRafraichit) definirRafraichit(true);
      try {
        const liste = await listerCartes();
        definirCartes(liste);
        definirEtat(liste.length === 0 ? { phase: 'vide' } : { phase: 'pret' });
      } catch (erreur) {
        if (erreur instanceof ErreurSession) {
          // Session morte : le service a déjà réinitialisé le store et
          // déclenché la navigation vers la connexion — rien à afficher.
          return;
        }
        definirEtat({ phase: 'erreur', message: (erreur as Error).message });
      } finally {
        definirRafraichit(false);
      }
    },
    [apiToken, requestToken],
  );

  useEffect(() => {
    // Un seul chargement à l'ouverture (les appels protégés sont sérialisés
    // par le service — le couple de tokens ne peut être utilisé qu'une fois).
    (async () => charger(false))();
  }, [charger]);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.contenu}
      refreshControl={
        <RefreshControl refreshing={rafraichit} onRefresh={() => charger(true)} />
      }
    >
      <Text style={styles.titre}>Mes cartes</Text>

      {etat.phase === 'sans-session' && (
        <Text style={styles.texteState}>
          Connecte-toi au serveur (authentification par mail / mot de passe) pour
          voir la collection enregistrée.
        </Text>
      )}

      {etat.phase === 'chargement' && <Text style={styles.texteState}>Chargement de la collection…</Text>}

      {etat.phase === 'vide' && <Text style={styles.texteState}>Aucune carte encore — passe à l’usine scanner un code-barres !</Text>}

      {etat.phase === 'erreur' && (
        <View style={styles.blocErreur}>
          <Text style={styles.erreur}>{etat.message}</Text>
          <Pressable
            style={({ pressed }) => [styles.boutonReessayer, pressed && styles.boutonAppuye]}
            onPress={() => charger(false)}
          >
            <Text style={styles.boutonTexte}>Réessayer</Text>
          </Pressable>
        </View>
      )}

      {etat.phase === 'pret' && (
        <View style={styles.liste}>
          {cartes.map((carte) => (
            <View key={carte.id} style={styles.carte}>
              <Text style={styles.carteId}>#&nbsp;{carte.id}</Text>
              <Text style={styles.carteStats}>
                Puissance&nbsp;: {carte.cardpower ?? '—'}&nbsp; Santé&nbsp;:{' '}
                {carte.health ?? '—'}&nbsp; Attaque&nbsp;: {carte.attack ?? '—'}
              </Text>
              <Text style={styles.carteHash} numberOfLines={1}>
                {carte.cardHash}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contenu: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 40,
  },
  titre: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 18,
  },
  texteState: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 12,
  },
  liste: {
    width: '100%',
    maxWidth: 400,
    gap: 10,
  },
  carte: {
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 4,
  },
  carteId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  carteStats: {
    fontSize: 14,
    color: '#374151',
  },
  carteHash: {
    fontSize: 12,
    color: '#9ca3af',
  },
  blocErreur: {
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  erreur: {
    fontSize: 14,
    color: '#c62828',
    textAlign: 'center',
  },
  boutonReessayer: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#43a047',
    paddingHorizontal: 32,
  },
  boutonAppuye: {
    backgroundColor: '#3b8b40',
  },
  boutonTexte: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});
