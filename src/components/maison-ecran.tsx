import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { naviguer } from '../navigation/navigateur';
import IncrustationNomCarte from './incrustation-nom-carte';
import { ErreurSession, listerCartes, type CarteListee } from '../services/api';
import { lireCarteLocale, lireIndex, type EntreeIndex } from '../services/collection';
import { useAppSelector } from '../store/hooks';
import { extraireApercu, type DeckCarte, type DonneesCarte } from '../utils/cdz';
import { encoderBase64 } from '../utils/base64';

// Fenêtre maison : aperçu des cartes en possession du joueur courant —
// GET /card du serveur pyCodebara2 (contrat §5.4), porteur du second token :
// la réponse ne liste QUE les cartes de l'utilisateur de la session. La
// grille est zoomable (2 à 6 cartes par ligne), filtrable par recherche
// (nom ou #id) et par série (saison datas.json des archives locales).
// Chaque carte reste taponable → fenêtre détail en grand.

// Aperçu chargé depuis le cache local (<idUser>/<id>.cdz §6.6) : image front
// encodée en data URI + datas.json (nom frais, saison, valeurs). Les cartes
// jamais ouvertes localement restent sans aperçu (cadre + #id) — le détail
// les téléchargera à l'ouverture (§5.5).
type Apercu = {
  image: string;
  datas: DonneesCarte;
  /** deck.json (positions des incrustations) — null si absent de l'archive. */
  deck: DeckCarte | null;
};

// Valeur de la liste déroulante « Série » : tout, une saison précise
// (datas.seasonid) ou les cartes sans série connue (archive absente).
type FiltreSerie = string; // 'toutes' | 'inconnue' | String(saison)

const COLONNES_MIN = 2;
const COLONNES_MAX = 6;

// Comparaison sans accents/diacritiques : « zeph » doit trouver « Zéphyr ».
const sansAccents = (texte: string): string =>
  texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Clé d'identité d'une saison : l'id quand datas.json en porte un, sinon le
// nom lisible (parsing opportuniste, cdz.ts) — null si la carte ne révèle
// aucune saison.
const cleSaison = (datas: DonneesCarte | null): string | null => {
  if (datas === null) return null;
  if (datas.seasonid !== null) return `id:${datas.seasonid}`;
  if (datas.saison) return `nom:${datas.saison}`;
  return null;
};

type EtatListe =
  | { phase: 'chargement' }
  | { phase: 'pret' }
  | { phase: 'vide' }
  | { phase: 'sans-session' }
  | { phase: 'erreur'; message: string };

export default function MaisonEcran() {
  // NE PAS importer requestToken ici : il change À CHAQUE appel protégé
  // réussi (rotation §3.3 dans le store) — l'inclure dans une dépendance de
  // charger/useEffect ferait rejouer le chargement en boucle. Le service lit
  // le token vivant dans le store au moment de l'appel ; le garde-fou
  // d'affichage s'appuie sur apiToken (stable pendant la session).
  const { apiToken, idUser } = useAppSelector((etat) => etat.utilisateur);
  const [etat, definirEtat] = useState<EtatListe>({ phase: 'chargement' });
  const [cartes, definirCartes] = useState<CarteListee[]>([]);
  // Index local (§6.6) : id → { nom, saisonId?, saison? } — les saisons y
  // sont portées pour la liste déroulante « Série ».
  const [nomsDetail, definirNomsDetail] = useState<Record<string, EntreeIndex>>({});
  const [rafraichit, definirRafraichit] = useState(false);

  // Outils de la grille : recherche, filtre série, zoom (cartes par ligne).
  const [recherche, definirRecherche] = useState('');
  const [serie, definirSerie] = useState<FiltreSerie>('toutes');
  // Défaut : 6 par ligne sur le web (grand écran), 3 en natif (portrait).
  const [colonnes, definirColonnes] = useState(() =>
    Platform.OS === 'web' ? 4 : 3,
  );

  // Aperçus locaux, lus une fois par liste (ref : identifiants déjà tentés —
  // un tirer-pour-actualiser ne relit pas les archives déjà couvertes).
  const [apercus, definirApercus] = useState<Record<number, Apercu>>({});
  const tenteRef = useRef<Set<number>>(new Set());
  // Largeur mesurée de la grille — la taille de police des incrustations de
  // nom suit la largeur réelle d'une cellule (les cellules sont en %).
  const [largeurGrille, definirLargeurGrille] = useState(0);

  const charger = useCallback(
    async (modeRafraichit: boolean) => {
      if (!apiToken) {
        definirEtat({ phase: 'sans-session' });
        return;
      }
      definirEtat({ phase: 'chargement' });
      if (modeRafraichit) definirRafraichit(true);
      try {
        const liste = await listerCartes();
        definirCartes(liste);
        // Index local des noms (datas.json du .cdz, §6.6) — absent de la
        // liste serveur. Une frappe latérale : échec ignoré, noms « # ».
        if (idUser !== null) {
          try {
            const index = await lireIndex(idUser);
            definirNomsDetail(index);
          } catch {
            definirNomsDetail({});
          }
        }
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
    [apiToken, idUser], // pas de requestToken — rotation à chaque succès (§3.3)
  );

  useEffect(() => {
    // Un seul chargement à l'ouverture (les appels protégés sont sérialisés
    // par le service — le couple de tokens ne peut être utilisé qu'une fois).
    (async () => charger(false))();
  }, [charger]);

  // Aperçus : lecture séquentielle des archives locales (une archive = unzip
  // + extraction front/datas, sans les contrôles §6.3) — une à une pour ne
  // pas bloquer le thread UI, annulée au démontage ou au changement de liste.
  useEffect(() => {
    let annule = false;
    (async () => {
      for (const carte of cartes) {
        if (annule) return;
        if (tenteRef.current.has(carte.id)) continue;
        tenteRef.current.add(carte.id); // tentée, succès ou échec : pas de boucle
        if (idUser === null) return;
        try {
          const brute = await lireCarteLocale(idUser, carte.id);
          if (!brute) continue; // jamais ouverte localement — reste sans aperçu
          const apercu = await extraireApercu(brute);
          if (annule) return;
          definirApercus((actuels) => ({
            ...actuels,
            [carte.id]: {
              image: `data:image/png;base64,${encoderBase64(apercu.front)}`,
              datas: apercu.datas,
              deck: apercu.deck,
            },
          }));
        } catch {
          // Archive illisible : pas d'aperçu (le détail saura la re-télécharger §5.5).
        }
      }
    })();
    return () => {
      annule = true;
    };
  }, [cartes, idUser]);

  // Filtres : recherche (nom, ou numéro avec ou sans #) + série.
  const cartesFiltrees = useMemo(() => {
    const requete = sansAccents(recherche.trim().toLowerCase());
    const numero = requete.replace(/^#/, '');
    return cartes.filter((carte) => {
      if (requete !== '') {
        const apercu = apercus[carte.id];
        const nom = sansAccents(
          (apercu?.datas.name ?? nomsDetail[String(carte.id)]?.nom ?? '').toLowerCase(),
        );
        const visible = nom.includes(requete) || (numero !== '' && String(carte.id).includes(numero));
        if (!visible) return false;
      }
      if (serie !== 'toutes') {
        const cle = cleSaison(apercus[carte.id]?.datas ?? null);
        if (serie === 'inconnue') {
          if (cle !== null) return false;
        } else if (cle === null || cle !== serie) {
          return false;
        }
      }
      return true;
    });
  }, [cartes, apercus, nomsDetail, recherche, serie]);

  // Options de la liste déroulante : saisons découvertes chez l'utilisateur
  // (aperçus locaux + index des noms, qui porte la saison lue dans datas.json
  // à la génération / au détail) + « inconnue » si des cartes en manquent.
  // Le libellé est le NOM de la saison quand l'archive en porte un, sinon
  // « Série n » sur l'identifiant — exigence produit 2026-11-15.
  const optionsSerie = useMemo(() => {
    type SaisonConnue = { id: number | null; nom: string | null };
    const saisons = new Map<string, SaisonConnue>();
    let inconnues = false;
    const retenue = (cle: string, id: number | null, nom: string | null) => {
      const existante = saisons.get(cle);
      if (!existante || (nom && !existante.nom)) {
        saisons.set(cle, { id, nom: nom ?? existante?.nom ?? null });
      }
    };
    for (const carte of cartes) {
      const datas = apercus[carte.id]?.datas ?? null;
      const cle = cleSaison(datas);
      if (cle === null) inconnues = true;
      else retenue(cle, datas?.seasonid ?? null, datas?.saison ?? null);
    }
    // L'index (mis à jour à la génération §6.1) révèle les saisons des cartes
    // dont l'aperçu local n'est pas chargé.
    for (const entree of Object.values(nomsDetail)) {
      const cle =
        entree.saisonId !== null && entree.saisonId !== undefined
          ? `id:${entree.saisonId}`
          : entree.saison
            ? `nom:${entree.saison}`
            : null;
      if (cle === null) continue;
      retenue(cle, entree.saisonId ?? null, entree.saison ?? null);
    }
    const options: { valeur: FiltreSerie; libelle: string }[] = [
      { valeur: 'toutes', libelle: 'Toutes les séries' },
    ];
    const classees = [...saisons.entries()].sort((a, b) => {
      const identA = a[1].id;
      const identB = b[1].id;
      if (identA !== null && identB !== null) return identA - identB;
      if (identA !== null) return -1;
      if (identB !== null) return 1;
      return a[0].localeCompare(b[0]);
    });
    for (const [cle, saison] of classees) {
      options.push({
        valeur: cle,
        libelle: saison.nom ?? `Série ${saison.id ?? cle}`,
      });
    }
    if (inconnues) options.push({ valeur: 'inconnue', libelle: 'Série inconnue' });
    return options;
  }, [cartes, apercus, nomsDetail]);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.contenu}
      keyboardShouldPersistTaps="handled"
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
        <>
          <View style={styles.outil}>
            <TextInput
              style={styles.recherche}
              placeholder="Chercher par nom ou #numéro"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
              value={recherche}
              onChangeText={definirRecherche}
              returnKeyType="search"
            />
            <View style={styles.filtres}>
              <View style={styles.filtreBloc}>
                <Text style={styles.outilLabel}>Série</Text>
                <Picker
                  style={styles.picker}
                  selectedValue={serie}
                  onValueChange={(valeur) => definirSerie(valeur)}
                  mode="dropdown"
                >
                  {optionsSerie.map((option) => (
                    <Picker.Item
                      key={option.valeur}
                      label={option.libelle}
                      value={option.valeur}
                    />
                  ))}
                </Picker>
              </View>
              <View style={styles.filtreBloc}>
                <Text style={styles.outilLabel}>Zoom</Text>
                <View style={styles.zoom}>
                  <Pressable
                    style={({ pressed }) => [styles.zoomBouton, pressed && styles.outilAppuye]}
                    onPress={() => definirColonnes((c) => Math.max(COLONNES_MIN, c - 1))}
                    accessibilityLabel="Agrandir les cartes"
                  >
                    <Text style={styles.zoomSymbole}>+</Text>
                  </Pressable>
                  <Text style={styles.zoomValeur}>{colonnes}/ligne</Text>
                  <Pressable
                    style={({ pressed }) => [styles.zoomBouton, pressed && styles.outilAppuye]}
                    onPress={() => definirColonnes((c) => Math.min(COLONNES_MAX, c + 1))}
                    accessibilityLabel="Réduire les cartes"
                  >
                    <Text style={styles.zoomSymbole}>−</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          {cartesFiltrees.length === 0 ? (
            <Text style={styles.texteState}>Aucune carte ne correspond à la recherche.</Text>
          ) : (
            <View
              style={styles.grille}
              onLayout={(evenement) => definirLargeurGrille(evenement.nativeEvent.layout.width)}
            >
              {cartesFiltrees.map((carte) => {
                const apercu = apercus[carte.id];
                const nom =
                  apercu?.datas.name ?? nomsDetail[String(carte.id)]?.nom ?? '';
                const libelle = nom !== '' ? nom : `Carte #${carte.id}`;
                const puissance = apercu?.datas.power ?? carte.cardpower ?? '—';
                const sante = apercu?.datas.health ?? carte.health ?? '—';
                const attaque = apercu?.datas.attack ?? carte.attack ?? '—';
                // Largeur réelle de l'image front dans la cellule (cellule en
                // % de la grille − padding 4×2) — pour l'échelle de police.
                const largeurCarte = largeurGrille / colonnes - 8;
                return (
                  <View
                    key={carte.id}
                    style={[styles.cellule, { width: `${100 / colonnes}%` }]}
                  >
                    <Pressable
                      style={({ pressed }) => [styles.carteCell, pressed && styles.carteCellAppuyee]}
                      onPress={() => naviguer({ nom: 'carte', carteId: carte.id })}
                      accessibilityLabel={`Carte ${libelle} — ouvrir le détail`}
                    >
                      <View style={styles.cadre}>
                        {apercu ? (
                          <>
                            <Image
                              source={{ uri: apercu.image }}
                              style={styles.front}
                              resizeMode="contain"
                            />
                            {/* Nom incrusté (deck.json positions.name). */}
                            <IncrustationNomCarte
                              position={apercu.deck?.nom ?? null}
                              repere={apercu.deck?.repere ?? 600}
                              hauteurRepere={apercu.deck?.hauteurRepere ?? 1037}
                              nom={
                                apercu.datas.name && apercu.datas.name.length > 0
                                  ? apercu.datas.name
                                  : `Carte #${carte.id}`
                              }
                              largeurCarte={largeurCarte}
                            />
                          </>
                        ) : (
                          <Text style={styles.sansApercu}>#{carte.id}</Text>
                        )}
                      </View>
                      <Text style={styles.cellNom} numberOfLines={1}>
                        {libelle}
                      </Text>
                      <Text style={styles.cellStats} numberOfLines={1}>
                        P {puissance} · S {sante} · A {attaque}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </>
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
  // ─── Outils (recherche + série + zoom) ────────────────────────────────────
  outil: {
    width: '100%',
    maxWidth: 560,
    gap: 10,
    marginBottom: 14,
  },
  recherche: {
    height: 44,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1f2937',
    backgroundColor: '#ffffff',
  },
  filtres: {
    flexDirection: 'row',
    gap: 12,
  },
  filtreBloc: {
    flex: 1,
    gap: 2,
  },
  outilLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    paddingHorizontal: 2,
  },
  picker: {
    height: 44,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
  },
  zoom: {
    height: 44,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  zoomBouton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomSymbole: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 24,
  },
  zoomValeur: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  outilAppuye: {
    backgroundColor: '#f3f4f6',
  },
  // ─── Grille d'aperçus ─────────────────────────────────────────────────────
  grille: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  cellule: {
    paddingHorizontal: 4,
  },
  carteCell: {
    borderRadius: 12,
    padding: 4,
    backgroundColor: 'transparent',
  },
  carteCellAppuyee: {
    backgroundColor: '#e8f5e9',
  },
  cadre: {
    width: '100%',
    aspectRatio: 600 / 1037,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  front: {
    width: '100%',
    height: '100%',
  },
  sansApercu: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
  },
  cellNom: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 6,
  },
  cellStats: {
    fontSize: 12,
    color: '#374151',
    marginTop: 2,
  },
});
