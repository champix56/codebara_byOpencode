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
import { ErreurApi, renouvelerMotDePasse } from '../services/api';

// Fenêtre mairie : accès aux informations personnelles du compte et à leur
// modification.
// - nickname : écrit dans la tranche utilisateur persistée (PUT /user absent
//   du serveur à ce jour — contrat §9.3/§12.1) ;
// - mot de passe : le serveur ne permet pas de CHOISIR un mot de passe ;
//   le seul chemin contractuel est POST /user/renew-password (§5.9) — le
//   mot de passe actuel devient inutilisable pour la connexion et un NOUVEAU
//   mot de passe aléatoire est envoyé par e-mail (réponse {"renewed": true},
//   sans token : aucune rotation ; 403 « Forbidden » ambigu par conception).
export default function MairieEcran() {
  const dispatcher = useAppDispatch();
  const utilisateur = useAppSelector((etat) => etat.utilisateur);

  const [nickname, setNickname] = useState(utilisateur.nickname);
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);
  const [enEnregistrement, setEnEnregistrement] = useState(false);
  const [etapeMdp, definirEtapeMdp] = useState<'repos' | 'confirme' | 'envoi'>('repos');

  const peutSoumettre = !enEnregistrement && nickname.trim().length > 0;
  const mdpDisponible = utilisateur.mail.length > 0;

  // Enregistrement local du nickname (PUT /user absent du serveur à ce jour).
  const enregistrer = async () => {
    if (!peutSoumettre) return;
    setEnEnregistrement(true);
    try {
      dispatcher(modifierProfil({ nickname: nickname.trim() }));
      setMessage({ texte: 'Modifications enregistrées.', erreur: false });
    } finally {
      setEnEnregistrement(false);
    }
  };

  // Renouvellement du mot de passe côté serveur (§5.9) : le mail du compte est
  // celui de la tranche. Échec 403 « Forbidden » (mail mal formé / compte
  // inconnu, indiscernables volontairement) OU succès → même message ambigu
  // que l'écran de connexion : pas d'oracle d'existence du compte.
  const envoyerNouveauMotDePasse = async () => {
    definirEtapeMdp('envoi');
    setMessage(null);
    try {
      await renouvelerMotDePasse(utilisateur.mail);
      setMessage({
        texte: 'Mot de passe renouvelé : un courriel part avec le nouveau. L’actuel ne fonctionnera plus pour la connexion.',
        erreur: false,
      });
    } catch (erreur) {
      const libelle = (erreur as Error).message;
      if (erreur instanceof ErreurApi && libelle === 'Forbidden') {
        setMessage({
          texte: 'Demande envoyée : un courriel avec le nouveau mot de passe arrivera si le compte est reconnu.',
          erreur: false,
        });
      } else {
        setMessage({ texte: libelle, erreur: true });
      }
    } finally {
      definirEtapeMdp('repos');
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

          <Text style={styles.label}>Mot de passe</Text>
          {etapeMdp === 'repos' && (
            <Pressable
              style={({ pressed }) => [
                styles.boutonLien,
                !mdpDisponible && styles.boutonDesactive,
                pressed && mdpDisponible && styles.boutonAppuye,
              ]}
              disabled={!mdpDisponible}
              onPress={() => definirEtapeMdp('confirme')}
            >
              <Text style={styles.boutonTexte}>Recevoir un nouveau mot de passe par e-mail</Text>
            </Pressable>
          )}

          {etapeMdp !== 'repos' && (
            <View style={styles.blocCompose}>
              {etapeMdp === 'confirme' && (
                <Text style={styles.avertissement}>
                  Un mot de passe aléatoire sera créé par le serveur et envoyé à&nbsp;:
                  {'\n' + (utilisateur.mail || '—') + '\n'}
                  Ton mot de passe actuel cessera de fonctionner pour la connexion.
                </Text>
              )}
              {etapeMdp === 'confirme' && (
                <View style={styles.ligneBoutons}>
                  <Pressable
                    style={({ pressed }) => [styles.bouton, styles.boutonMoitie, styles.boutonDanger, pressed && styles.boutonAppuye]}
                    onPress={envoyerNouveauMotDePasse}
                  >
                    <Text style={styles.boutonTexte}>Confirmer</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.bouton, styles.boutonMoitie, styles.boutonAnnule, pressed && styles.boutonAnnuleAppuye]}
                    onPress={() => definirEtapeMdp('repos')}
                  >
                    <Text style={styles.boutonAnnuleTexte}>Annuler</Text>
                  </Pressable>
                </View>
              )}
              {etapeMdp === 'envoi' && <Text style={styles.texteEtat}>Demande envoyée au serveur…</Text>}
            </View>
          )}

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

          {message && (
            <Text style={message.erreur ? styles.erreur : styles.messageSucces}>
              {message.texte}
            </Text>
          )}

          <Text style={styles.astuce}>
            Le nickname modifié est conservé sur cet appareil ; la synchronisation
            serveur arrivera avec l’endpoint dédié.
          </Text>
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
  bouton: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#43a047',
    marginTop: 6,
  },
  boutonLien: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#43a047',
    marginBottom: 14,
  },
  boutonDanger: {
    backgroundColor: '#c62828',
  },
  boutonAnnule: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  boutonAnnuleAppuye: {
    backgroundColor: '#f3f4f6',
  },
  boutonAnnuleTexte: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  blocCompose: {
    marginTop: 2,
  },
  ligneBoutons: {
    flexDirection: 'row',
    gap: 10,
  },
  boutonMoitie: {
    flex: 1,
  },
  avertissement: {
    fontSize: 13,
    color: '#374151',
    backgroundColor: '#fef4f2',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  texteEtat: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
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
  astuce: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 18,
    textAlign: 'center',
  },
});
