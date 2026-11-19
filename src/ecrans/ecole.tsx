import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  naviguer,
} from '../navigation/navigateur';
import {
  CARACTERES_INTERDITS_RECHERCHE,
  ErreurSession,
  envoyerDemandeAmi,
  listerAmis,
  listerDemandesAmis,
  LONGUEUR_MIN_RECHERCHE_UTILISATEUR,
  refuserDemandeAmi,
  rechercherUtilisateurs,
  type Ami,
  type DemandeAmi,
  type UtilisateurTrouve,
} from '../services/api';

type Onglet = 'recherche' | 'amis';
type Message = { texte: string; erreur: boolean } | null;

// Fenêtre « école » — deux onglets :
// - « Recherche » : GET /users?value=… (nickname/mail, 4 car. min, 5 résultats
//   triés par pertinence). Suivant `friendStatus`, on propose l'ajout, on
//   affiche « en attente » (bouton grisé) ou « Ami ». Aucun accès à la maison
//   depuis la recherche.
// - « Amis » : demandes reçues repliables (accepter = POST inverse, refus =
//   DELETE) puis amis validés ; clic sur un ami → maison en lecture seule.
export default function Ecole() {
  const [onglet, setOnglet] = useState<Onglet>('recherche');

  // ── Onglet recherche ─────────────────────────────────────────────────────
  const [recherche, setRecherche] = useState('');
  const [resultats, setResultats] = useState<UtilisateurTrouve[]>([]);
  const [enRecherche, setEnRecherche] = useState(false);
  const [rechercheEffectuee, setRechercheEffectuee] = useState(false);
  const [messageRecherche, setMessageRecherche] = useState<Message>(null);

  // ── Onglet amis ──────────────────────────────────────────────────────────
  const [demandes, setDemandes] = useState<DemandeAmi[]>([]);
  const [amis, setAmis] = useState<Ami[]>([]);
  const [chargementAmis, setChargementAmis] = useState(false);
  const [demandesOuvertes, setDemandesOuvertes] = useState(true);
  const [actionEnCours, setActionEnCours] = useState<number | null>(null);
  const [messageAmis, setMessageAmis] = useState<Message>(null);

  const valeur = recherche.trim();
  const valeurValide =
    valeur.length >= LONGUEUR_MIN_RECHERCHE_UTILISATEUR &&
    !CARACTERES_INTERDITS_RECHERCHE.test(valeur);
  const peutRechercher = valeurValide && !enRecherche;

  const lancerRecherche = async () => {
    if (!peutRechercher) return;
    setEnRecherche(true);
    setMessageRecherche(null);
    setRechercheEffectuee(false);
    try {
      const trouves = await rechercherUtilisateurs(valeur);
      setResultats(trouves);
      setRechercheEffectuee(true);
      if (trouves.length === 0) {
        setMessageRecherche({ texte: 'Aucun joueur ne correspond à cette recherche.', erreur: false });
      }
    } catch (erreur) {
      if (erreur instanceof ErreurSession) return;
      setResultats([]);
      setMessageRecherche({ texte: (erreur as Error).message, erreur: true });
    } finally {
      setEnRecherche(false);
    }
  };

  const ajouterAmi = async (utilisateur: UtilisateurTrouve) => {
    if (actionEnCours !== null) return;
    setActionEnCours(utilisateur.id);
    setMessageRecherche(null);
    try {
      await envoyerDemandeAmi(utilisateur.id);
      setResultats((actuels) => actuels.map((u) =>
        u.id === utilisateur.id ? { ...u, friendStatus: 'pending' } : u));
      setMessageRecherche({
        texte: `Demande envoyée à ${utilisateur.nickname}.`,
        erreur: false,
      });
    } catch (erreur) {
      if (erreur instanceof ErreurSession) return;
      const texte = (erreur as Error).message;
      // Le serveur peut nous rattraper (demande inverse déjà envoyée, amitié
      // déjà validée) : on aligne l'affichage sans laisser un bouton mort.
      if (texte === 'Already friends') {
        setResultats((actuels) => actuels.map((u) =>
          u.id === utilisateur.id ? { ...u, friendStatus: 'friend' } : u));
      } else if (texte === 'Friend request already exists') {
        setResultats((actuels) => actuels.map((u) =>
          u.id === utilisateur.id ? { ...u, friendStatus: 'pending' } : u));
      }
      setMessageRecherche({ texte, erreur: true });
    } finally {
      setActionEnCours(null);
    }
  };

  const chargerAmis = useCallback(async () => {
    setChargementAmis(true);
    setMessageAmis(null);
    try {
      // Deux appels protégés sérialisés par api.ts (tokens rotatifs).
      const [recues, valides] = await Promise.all([
        listerDemandesAmis(),
        listerAmis(),
      ]);
      setDemandes(recues);
      setAmis(valides);
    } catch (erreur) {
      if (erreur instanceof ErreurSession) return;
      setMessageAmis({ texte: (erreur as Error).message, erreur: true });
    } finally {
      setChargementAmis(false);
    }
  }, []);

  const changerOnglet = (suivant: Onglet) => {
    setOnglet(suivant);
    if (suivant === 'amis' && amis.length === 0 && demandes.length === 0) {
      void chargerAmis();
    }
  };

  const accepter = async (demande: DemandeAmi) => {
    if (actionEnCours !== null) return;
    setActionEnCours(demande.id);
    setMessageAmis(null);
    try {
      // Accepter = POSTer la demande inverse (§5.12) : même appel qu'une
      // nouvelle demande, mais ici le serveur bascule l'amitié en validée.
      await envoyerDemandeAmi(demande.id);
      await chargerAmis();
    } catch (erreur) {
      if (erreur instanceof ErreurSession) return;
      setMessageAmis({ texte: (erreur as Error).message, erreur: true });
    } finally {
      setActionEnCours(null);
    }
  };

  const refuser = async (demande: DemandeAmi) => {
    if (actionEnCours !== null) return;
    setActionEnCours(demande.id);
    setMessageAmis(null);
    try {
      await refuserDemandeAmi(demande.id);
      setDemandes((actuelles) => actuelles.filter((d) => d.id !== demande.id));
    } catch (erreur) {
      if (erreur instanceof ErreurSession) return;
      setMessageAmis({ texte: (erreur as Error).message, erreur: true });
    } finally {
      setActionEnCours(null);
    }
  };

  const visiterMaison = (ami: Ami) => {
    naviguer({ nom: 'maison-visite', amiId: ami.id, nickname: ami.nickname });
  };

  return (
    <View style={styles.container}>
      {/* Deux onglets : recherche générale / amis */}
      <View style={styles.onglets}>
        <Pressable
          style={[styles.onglet, onglet === 'recherche' && styles.ongletActif]}
          onPress={() => changerOnglet('recherche')}
          accessibilityLabel="Onglet recherche"
        >
          <Text style={[styles.ongletTexte, onglet === 'recherche' && styles.ongletTexteActif]}>
            Recherche
          </Text>
        </Pressable>
        <Pressable
          style={[styles.onglet, onglet === 'amis' && styles.ongletActif]}
          onPress={() => changerOnglet('amis')}
          accessibilityLabel="Onglet amis"
        >
          <Text style={[styles.ongletTexte, onglet === 'amis' && styles.ongletTexteActif]}>
            Amis{amis.length > 0 ? ` (${amis.length})` : ''}
          </Text>
        </Pressable>
      </View>

      {onglet === 'recherche' ? (
        <View style={styles.contenu}>
          <View style={styles.searchBox}>
            <Text style={styles.label}>Rechercher un joueur</Text>
            <Text style={styles.hint}>
              nickname ou e-mail · {LONGUEUR_MIN_RECHERCHE_UTILISATEUR} caractères minimum · 5 résultats maximum
            </Text>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.input}
                placeholder="Ex. Alex ou alex@exemple.fr"
                placeholderTextColor="#9ca3af"
                value={recherche}
                onChangeText={(texte) => {
                  setRecherche(texte);
                  setMessageRecherche(null);
                }}
                onSubmitEditing={lancerRecherche}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!enRecherche}
              />
              <Pressable
                style={[styles.bouton, !peutRechercher && styles.boutonDesactive]}
                onPress={lancerRecherche}
                disabled={!peutRechercher}
                accessibilityLabel="Lancer la recherche"
              >
                <Text style={styles.boutonTexte}>Chercher</Text>
              </Pressable>
            </View>
            {!valeurValide && valeur.length > 0 && (
              <Text style={styles.aide}>
                4 caractères minimum, sans espace ni caractère spécial (&amp; = % ? # +).
              </Text>
            )}
            {messageRecherche && (
              <Text style={messageRecherche.erreur ? styles.erreur : styles.info}>
                {messageRecherche.texte}
              </Text>
            )}
          </View>

          {enRecherche && (
            <View style={styles.chargement}>
              <ActivityIndicator color="#3b82f6" />
              <Text style={styles.chargementTexte}>Recherche en cours…</Text>
            </View>
          )}

          <FlatList
            data={resultats}
            keyExtractor={(utilisateur) => String(utilisateur.id)}
            renderItem={({ item }) => (
              <View style={styles.resultat}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarTexte}>
                    {item.nickname.slice(0, 1).toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.userInfos}>
                  <Text style={styles.userPseudo}>{item.nickname}</Text>
                  <Text style={styles.userMail}>{item.mail}</Text>
                </View>
                {item.friendStatus === 'unknown' ? (
                  <Pressable
                    style={[styles.boutonAmi, actionEnCours === item.id && styles.boutonDesactive]}
                    onPress={() => ajouterAmi(item)}
                    disabled={actionEnCours !== null}
                    accessibilityLabel={`Ajouter ${item.nickname} en ami`}
                  >
                    <Text style={styles.boutonAmiTexte}>Ajouter</Text>
                  </Pressable>
                ) : item.friendStatus === 'pending' ? (
                  <View style={styles.boutonAmiGrise}>
                    <Text style={styles.boutonAmiGriseTexte}>En attente</Text>
                  </View>
                ) : (
                  <View style={styles.badgeAmi}>
                    <Text style={styles.badgeAmiTexte}>Ami</Text>
                  </View>
                )}
              </View>
            )}
            ListHeaderComponent={
              rechercheEffectuee && resultats.length > 0 ? (
                <Text style={styles.listTitle}>
                  {resultats.length} joueur{resultats.length > 1 ? 's' : ''} trouvé{resultats.length > 1 ? 's' : ''}
                </Text>
              ) : undefined
            }
            ListEmptyComponent={
              !enRecherche && !rechercheEffectuee ? (
                <Text style={styles.placeholder}>
                  Saisissez au moins 4 caractères pour trouver un joueur.
                </Text>
              ) : undefined
            }
            contentContainerStyle={styles.liste}
          />
        </View>
      ) : (
        <View style={styles.contenu}>
          <View style={styles.section}>
            {/* Section repliable des demandes reçues non encore traitées */}
            <Pressable
              style={styles.sectionEntete}
              onPress={() => setDemandesOuvertes((ouvert) => !ouvert)}
              accessibilityLabel="Afficher ou masquer les demandes d'amis"
            >
              <Text style={styles.sectionTitre}>
                Demandes reçues ({demandes.length})
              </Text>
              <Text style={styles.chevronSection}>{demandesOuvertes ? '▾' : '▸'}</Text>
            </Pressable>
            {demandesOuvertes && (
              <View>
                {demandes.length === 0 ? (
                  <Text style={styles.sectionVide}>Aucune demande en attente.</Text>
                ) : demandes.map((demande) => (
                  <View key={demande.id} style={styles.demande}>
                    <View style={styles.userInfos}>
                      <Text style={styles.userPseudo}>{demande.nickname}</Text>
                      <Text style={styles.userMail}>{demande.mail}</Text>
                      {demande.daterequest && (
                        <Text style={styles.dateDemande}>Demandée le {demande.daterequest}</Text>
                      )}
                    </View>
                    <View style={styles.actionsDemande}>
                      <Pressable
                        style={[styles.boutonAmi, actionEnCours !== null && styles.boutonDesactive]}
                        onPress={() => accepter(demande)}
                        disabled={actionEnCours !== null}
                        accessibilityLabel={`Accepter ${demande.nickname}`}
                      >
                        <Text style={styles.boutonAmiTexte}>Accepter</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.boutonRefuser, actionEnCours !== null && styles.boutonDesactive]}
                        onPress={() => refuser(demande)}
                        disabled={actionEnCours !== null}
                        accessibilityLabel={`Refuser ${demande.nickname}`}
                      >
                        <Text style={styles.boutonRefuserTexte}>Refuser</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <Text style={styles.listTitleAmis}>Mes amis ({amis.length})</Text>
          {chargementAmis && (
            <View style={styles.chargement}>
              <ActivityIndicator color="#3b82f6" />
              <Text style={styles.chargementTexte}>Chargement…</Text>
            </View>
          )}
          {messageAmis && (
            <Text style={messageAmis.erreur ? styles.erreur : styles.info}>{messageAmis.texte}</Text>
          )}
          <FlatList
            data={amis}
            keyExtractor={(ami) => String(ami.id)}
            renderItem={({ item }) => (
              <Pressable
                style={styles.ami}
                onPress={() => visiterMaison(item)}
                accessibilityLabel={`Visiter la maison de ${item.nickname}`}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarTexte}>
                    {item.nickname.slice(0, 1).toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.userInfos}>
                  <Text style={styles.userPseudo}>{item.nickname}</Text>
                  <Text style={styles.userMail}>
                    {item.mail} · {item.cardcount} carte{item.cardcount > 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              !chargementAmis ? (
                <Text style={styles.placeholder}>Aucun ami validé pour le moment.</Text>
              ) : undefined
            }
            contentContainerStyle={styles.liste}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  onglets: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  onglet: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ongletActif: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  ongletTexte: {
    fontSize: 15,
    color: '#6b7280',
  },
  ongletTexteActif: {
    color: '#2563eb',
    fontWeight: '600',
  },
  contenu: {
    flex: 1,
  },
  searchBox: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#1f2937',
    backgroundColor: '#ffffff',
  },
  bouton: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boutonDesactive: {
    backgroundColor: '#cbd5e1',
  },
  boutonTexte: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  aide: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 8,
  },
  erreur: {
    color: '#ef4444',
    fontSize: 13,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  info: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  chargement: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  chargementTexte: {
    color: '#6b7280',
    fontSize: 13,
  },
  liste: {
    padding: 16,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 10,
  },
  listTitleAmis: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  placeholder: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  resultat: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  ami: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarTexte: {
    color: '#1d4ed8',
    fontSize: 18,
    fontWeight: '700',
  },
  userInfos: {
    flex: 1,
  },
  userPseudo: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  userMail: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    color: '#9ca3af',
    marginLeft: 8,
  },
  boutonAmi: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  boutonAmiTexte: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  boutonAmiGrise: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  boutonAmiGriseTexte: {
    color: '#9ca3af',
    fontSize: 13,
  },
  badgeAmi: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#dcfce7',
  },
  badgeAmiTexte: {
    color: '#15803d',
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  sectionEntete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sectionTitre: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  chevronSection: {
    fontSize: 18,
    color: '#6b7280',
  },
  sectionVide: {
    color: '#9ca3af',
    fontSize: 13,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  demande: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f3f4f6',
  },
  dateDemande: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  actionsDemande: {
    gap: 6,
  },
  boutonRefuser: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  boutonRefuserTexte: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
  },
});
