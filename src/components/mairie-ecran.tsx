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

// Fenêtre mairie : accès aux informations personnelles du compte et à leur
// modification. Le nickname est écrit dans la tranche utilisateur persistée ;
// le changement de mot de passe n'est PAS faisable aujourd'hui : le mot de
// passe est généré par le serveur et envoyé par e-mail à la création (contrat
// pyCodebara2 §5.1 / §12.1), et l'endpoint de mise à jour (PUT /user) n'existe
// pas encore — la section est volontairement inertée tant que le serveur ne
// le rend pas disponible.
export default function MairieEcran() {
  const dispatcher = useAppDispatch();
  const utilisateur = useAppSelector((etat) => etat.utilisateur);

  const [nickname, setNickname] = useState(utilisateur.nickname);
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);
  const [enEnregistrement, setEnEnregistrement] = useState(false);

  const peutSoumettre = !enEnregistrement && nickname.trim().length > 0;

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
          <View style={[styles.input, styles.champDeshibile]}>
            <Text style={styles.champDeshibileTexte}>
              Modifiable plus tard — généré par le serveur et envoyé par e-mail à la création.
            </Text>
          </View>

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
  champDeshibile: {
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    height: 'auto',
    minHeight: 48,
  },
  champDeshibileTexte: {
    fontSize: 13,
    color: '#9ca3af',
  },
  bouton: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#43a047',
    marginTop: 6,
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
