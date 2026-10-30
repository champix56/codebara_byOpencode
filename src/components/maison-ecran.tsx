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
import { type ProfilPartiel, modifierProfil } from '../store/utilisateur';
import { calculerEmpreinte } from '../utils/hash';

// Fenêtre maison : formulaire des informations du compte courant. Le nickname
// et le mot de passe sont modifiés directement dans la tranche utilisateur
// persistée (placeholder local jusqu'au branchement serveur).
export default function MaisonEcran() {
  const dispatcher = useAppDispatch();
  const utilisateur = useAppSelector((etat) => etat.utilisateur);

  const [nickname, setNickname] = useState(utilisateur.nickname);
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);
  const [enEnregistrement, setEnEnregistrement] = useState(false);

  const mdpModifie = motDePasse.length > 0;
  const confirmationDivergente =
    mdpModifie && confirmation.length > 0 && motDePasse !== confirmation;
  const peutSoumettre =
    !enEnregistrement &&
    nickname.trim().length > 0 &&
    (!mdpModifie || (confirmation.length > 0 && motDePasse === confirmation));

  // Enregistre le profil dans la tranche persistée : hash calculé localement
  // (SHA-256) uniquement si un nouveau mot de passe est saisi — champs vides =
  // conservation de l'empreinte actuelle.
  const enregistrer = async () => {
    if (!peutSoumettre) return;
    setEnEnregistrement(true);
    try {
      const changements: ProfilPartiel = { nickname: nickname.trim() };
      if (mdpModifie) {
        changements.hash = await calculerEmpreinte(motDePasse);
      }
      dispatcher(modifierProfil(changements));
      setMotDePasse('');
      setConfirmation('');
      setMessage({ texte: 'Modifications enregistrées.', erreur: false });
    } catch {
      setMessage({ texte: 'Échec du calcul de l’empreinte.', erreur: true });
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
        <Text style={styles.premierTitre}>Mon compte</Text>
        <Text style={styles.sousTitre}>Consulte et modifie tes informations</Text>

        <Text style={[styles.infoTexte, styles.label]} accessibilityLabel="Compte">
          Mail&nbsp;: {utilisateur.mail || '—'}
        </Text>
        <Text style={[styles.infoTexte, styles.label]}>
          Identifiant&nbsp;: {utilisateur.idUser === null ? '—' : `user #${utilisateur.idUser}`}
        </Text>

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
          <Text style={styles.label}>Nouveau mot de passe</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={motDePasse}
            onChangeText={(texte) => {
              setMotDePasse(texte);
              setMessage(null);
            }}
            returnKeyType="done"
          />
          <Text style={styles.label}>Confirmation du mot de passe</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={confirmation}
            onChangeText={(texte) => {
              setConfirmation(texte);
              setMessage(null);
            }}
            returnKeyType="done"
          />
          <Text style={styles.astuce}>
            Laissez les champs de mot de passe vides pour conserver l’actuel.
          </Text>
          {confirmationDivergente && (
            <Text style={styles.erreur}>Les mots de passe ne correspondent pas.</Text>
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
            <Text style={message.erreur ? styles.erreur : styles.normalMessage}>
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
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  infoTexte: {
    fontSize: 14,
    color: '#374151',
  },
  form: {
    width: '100%',
    maxWidth: 320,
    marginTop: 26,
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
  astuce: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
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
  normalMessage: {
    fontSize: 14,
    color: '#2e7d32',
    marginTop: 14,
    fontWeight: '600',
  },
  erreur: {
    fontSize: 13,
    color: '#c62828',
    marginBottom: 8,
  },
});
