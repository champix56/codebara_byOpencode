import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { modifierProfil } from '../store/utilisateur';
import {
  ErreurSession,
  modifierUtilisateurServeur,
  quitterSession,
} from '../services/api';
import { evaluerMotDePasse, type EvaluationMotDePasse } from '../utils/motDePasse';

// Indicateur de niveau : libellé et couleur selon le nombre de règles
// respectées (0–2 faible, 3–4 moyen, 5 fort — cf. src/utils/motDePasse.ts).
const NIVEAU_LIBELLE: Record<NonNullable<EvaluationMotDePasse['niveau']>, string> = {
  faible: 'Faible',
  moyen: 'Moyen',
  fort: 'Fort',
};
const NIVEAU_COULEUR: Record<NonNullable<EvaluationMotDePasse['niveau']>, string> = {
  faible: '#ef4444',
  moyen: '#f59e0b',
  fort: '#22c55e',
};
const COULEUR_SEGMENT_VIDE = '#e5e7eb';

// Fenêtre mairie : informations personnelles du compte et modifications.
// - nickname : envoyé au serveur via PUT /user (contrat §5.10, tokens
//   requis) puis tranche rechargée depuis la réponse ; sans session
//   (compte debug GOD, tokens nuls) resté local ;
// - mot de passe : SAISI par l'utilisateur (champ masqué + bouton Afficher/
//   Masquer, indicateur de niveau). Validé CÔTÉ CLIENT (§5.10 : 5 règles) puis
//   haché côté client — le serveur ne voit que SHA256(mail + clair). Sur le
//   200 de PUT /user : déconnexion complète (reset tranche persistée + purge
//   + retour /login) — l'utilisateur se reconnecte avec le nouveau mot de
//   passe. La session serveur resterait valable, mais l'app préfère la sortie
//   explicite (décision produit).
export default function MairieEcran() {
  const dispatcher = useAppDispatch();
  const utilisateur = useAppSelector((etat) => etat.utilisateur);

  const [nickname, setNickname] = useState(utilisateur.nickname);
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);
  const [enEnregistrement, setEnEnregistrement] = useState(false);
  const [motDePasse, setMotDePasse] = useState('');
  const [afficherMdp, setAfficherMdp] = useState(false);
  const [enEnvoiMdp, setEnEnvoiMdp] = useState(false);

  const sessionActive = utilisateur.apiToken !== null;
  const evaluation = evaluerMotDePasse(motDePasse);
  const couleurNiveau = evaluation.niveau
    ? NIVEAU_COULEUR[evaluation.niveau]
    : COULEUR_SEGMENT_VIDE;

  const peutSoumettre = !enEnregistrement && nickname.trim().length > 0;
  const peutEnvoyerMdp = sessionActive && evaluation.toutesRespectees && !enEnvoiMdp;

  // Pseudo : PUT /user {nickname} (§5.10) — la réponse 200 porte le profil à
  // jour + le nouveau API_REQUEST_TOKEN (rotation gérée par appelProtege) ;
  // la tranche est rechargée depuis le profil renvoyé. Mort de session
  // (« Invalid REQUEST TOKEN ») : déjà gérée dans api.ts (reset + /login).
  const enregistrer = async () => {
    if (!peutSoumettre) return;
    setEnEnregistrement(true);
    setMessage(null);
    try {
      if (sessionActive) {
        const profil = await modifierUtilisateurServeur({ nickname: nickname.trim() });
        dispatcher(modifierProfil({ nickname: profil.nickname, hash: profil.hash }));
        setMessage({ texte: 'Modifications enregistrées sur le serveur.', erreur: false });
      } else {
        // Compte debug GOD : aucun token serveur → sauvegarde locale seule.
        dispatcher(modifierProfil({ nickname: nickname.trim() }));
        setMessage({ texte: 'Modifications enregistrées localement (aucune session serveur).', erreur: false });
      }
    } catch (erreur) {
      if (erreur instanceof ErreurSession) return;
      setMessage({ texte: (erreur as Error).message, erreur: true });
    } finally {
      setEnEnregistrement(false);
    }
  };

  // Mot de passe : PUT /user {password: SHA256(mail_courant + clair)} (§5.10).
  // La promesse se résout UNIQUEMENT sur 200 : toute erreur (400/403, réseau,
  // session morte) lève avant. Sur 200 → déconnexion complète (§ en-tête) :
  // reset tranche persistée + purge + router.replace('/login'), centralisés
  // dans quitterSession.
  const enregistrerMotDePasse = async () => {
    if (!peutEnvoyerMdp) return;
    setEnEnvoiMdp(true);
    setMessage(null);
    try {
      await modifierUtilisateurServeur({ motDePasseClair: motDePasse });
      quitterSession();
    } catch (erreur) {
      if (erreur instanceof ErreurSession) return;
      setMessage({ texte: (erreur as Error).message, erreur: true });
      setEnEnvoiMdp(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.premierTitre}>Ma mairie</Text>
        <Text style={styles.sousTitre}>Tes informations personnelles</Text>

        <View style={styles.carte}>
          <Text style={styles.infoLigne}>
            Mail&nbsp;: {utilisateur.mail || '—'}
          </Text>
          <Text style={styles.infoLigne}>
            Identifiant&nbsp;: {utilisateur.idUser === null ? '—' : `user #${utilisateur.idUser}`}
          </Text>
          <Text style={styles.infoLigne}>
            Monnaie&nbsp;: {utilisateur.amount === null ? '—' : utilisateur.amount}
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Nickname</Text>
          <TextInput
            style={styles.input}
            placeholder="Login ou username"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            value={nickname}
            onChangeText={(texte) => {
              setNickname(texte);
              setMessage(null);
            }}
            returnKeyType="done"
          />

          <Pressable
            style={({ pressed }) => [
              styles.bouton,
              !peutSoumettre && styles.boutonDesactive,
              pressed && peutSoumettre && styles.boutonAppuye,
            ]}
            onPress={enregistrer}
            disabled={!peutSoumettre}
          >
            <Text style={styles.boutonTexte}>Enregistrer</Text>
          </Pressable>

          <Text style={[styles.label, styles.labelMdp]}>Nouveau mot de passe</Text>
          <View style={styles.champMdp}>
            <TextInput
              style={styles.champMdpSaisie}
              placeholder="Mot de passe"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!afficherMdp}
              autoCapitalize="none"
              autoCorrect={false}
              value={motDePasse}
              onChangeText={(texte) => {
                setMotDePasse(texte);
                setMessage(null);
              }}
            />
            <Pressable hitSlop={8} onPress={() => setAfficherMdp(!afficherMdp)}>
              <Text style={styles.oeil}>{afficherMdp ? 'Masquer' : 'Afficher'}</Text>
            </Pressable>
          </View>

          <View style={styles.indicateur}>
            {evaluation.regles.map((regle) => (
              <View
                key={regle.id}
                style={[
                  styles.indicateurSegment,
                  { backgroundColor: regle.passe ? couleurNiveau : COULEUR_SEGMENT_VIDE },
                ]}
              />
            ))}
            {evaluation.niveau && (
              <Text style={[styles.indicateurTexte, { color: couleurNiveau }]}>
                {NIVEAU_LIBELLE[evaluation.niveau]}
              </Text>
            )}
          </View>

          <View style={styles.regles}>
            {evaluation.regles.map((regle) => (
              <View key={regle.id} style={styles.regle}>
                <View
                  style={[
                    styles.reglePuce,
                    regle.passe ? styles.reglePuceOui : styles.reglePuceNon,
                  ]}
                />
                <Text style={regle.passe ? styles.regleTexteOui : styles.regleTexteNon}>
                  {regle.libelle}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.bouton,
              !peutEnvoyerMdp && styles.boutonDesactive,
              pressed && peutEnvoyerMdp && styles.boutonAppuye,
            ]}
            onPress={enregistrerMotDePasse}
            disabled={!peutEnvoyerMdp}
          >
            <Text style={styles.boutonTexte}>
              {enEnvoiMdp ? 'Envoi…' : 'Enregistrer le mot de passe'}
            </Text>
          </Pressable>

          {!sessionActive && (
            <Text style={styles.sansSession}>
              Sans session serveur (compte debug), le mot de passe reste inchangé.
            </Text>
          )}

          {message && (
            <Text style={message.erreur ? styles.erreur : styles.messageSucces}>
              {message.texte}
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  premierTitre: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  sousTitre: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 18,
  },
  carte: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  infoLigne: {
    fontSize: 14,
    color: '#374151',
  },
  form: {
    width: '100%',
    maxWidth: 320,
    marginTop: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  labelMdp: {
    marginTop: 4,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1f2937',
    backgroundColor: '#ffffff',
    marginBottom: 14,
  },
  champMdp: {
    height: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    marginBottom: 10,
  },
  champMdpSaisie: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1f2937',
  },
  oeil: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
  },
  indicateur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  indicateurSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: COULEUR_SEGMENT_VIDE,
  },
  indicateurTexte: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
  regles: {
    columnGap: 12,
    rowGap: 4,
    marginBottom: 12,
  },
  regle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reglePuce: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  reglePuceOui: {
    backgroundColor: '#22c55e',
  },
  reglePuceNon: {
    backgroundColor: '#d1d5db',
  },
  regleTexteOui: {
    fontSize: 12,
    color: '#166534',
  },
  regleTexteNon: {
    fontSize: 12,
    color: '#9ca3af',
  },
  sansSession: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 10,
    textAlign: 'center',
  },
  bouton: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#43a047',
    marginTop: 2,
  },
  boutonAppuye: {
    backgroundColor: '#3b8b40',
  },
  boutonDesactive: {
    backgroundColor: '#a5d6a7',
  },
  boutonTexte: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  messageSucces: {
    fontSize: 14,
    color: '#2e7d32',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '600',
  },
  erreur: {
    fontSize: 13,
    color: '#c62828',
    textAlign: 'center',
    marginTop: 12,
  },
});
