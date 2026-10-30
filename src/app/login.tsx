import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import Constants from 'expo-constants';
import { useAppDispatch } from '../store/hooks';
import { UTILISATEUR_DEBUG, seConnecter } from '../store/utilisateur';

// Bouton de debug : visible uniquement si la variable d'environnement DEBUG vaut « true »
// (shell : `DEBUG=true npx expo start`, ou `DEBUG=true` dans .env). La config dynamique
// (app.config.ts) fait l'aiguillage : valeur inlinée via EXPO_PUBLIC_DEBUG côté bundle,
// plus redondance via Constants.expoConfig.extra.debug (réliable en natif).
const MODE_DEBUG =
  process.env.EXPO_PUBLIC_DEBUG === 'true' || Constants.expoConfig?.extra?.debug === true;

type Mode = 'login' | 'signup';

// La même fenêtre sert à la connexion ET à la création de compte :
// le lien en bas bascule d'un mode à l'autre.
export default function ConnexionScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const dispatcher = useAppDispatch();
  const canSubmit = identifiant.trim().length > 0 && motDePasse.length > 0;

  const soumettre = () => {
    // TODO: brancher sur l'authentification réelle
    // (mode 'login' -> connexion, mode 'signup' -> création de compte).
    // En attendant le serveur : entrer dans l'application sans vérification.
    if (canSubmit) {
      router.replace('/principal');
    }
  };

  const basculerMode = () => setMode(mode === 'login' ? 'signup' : 'login');

  // Bouton debug : saute l'authentification, charge le compte GOD dans la tranche
  // utilisateur persistante puis ouvre la fenêtre principale.
  const passerAuthentification = () => {
    dispatcher(seConnecter(UTILISATEUR_DEBUG));
    router.replace('/principal');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Bienvenue sur codEbara</Text>
        <Text style={styles.subtitle}>
          {mode === 'login' ? 'Connecte-toi à ton compte' : 'Crée ton compte'}
        </Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Login ou username"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            value={identifiant}
            onChangeText={setIdentifiant}
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={motDePasse}
            onChangeText={setMotDePasse}
          />

          <Pressable
            style={({ pressed }) => [
              styles.button,
              !canSubmit && styles.buttonDisabled,
              pressed && canSubmit && styles.buttonPressed,
            ]}
            onPress={soumettre}
            disabled={!canSubmit}
          >
            <Text style={styles.buttonLabel}>
              {mode === 'login' ? 'Connexion' : 'Créer mon compte'}
            </Text>
          </Pressable>

          {MODE_DEBUG && (
            <Pressable
              style={({ pressed }) => [styles.buttonDebug, pressed && styles.buttonDebugPressed]}
              onPress={passerAuthentification}
            >
              <Text style={styles.buttonDebugLabel}>Debug : passer l’authentification</Text>
            </Pressable>
          )}

          <Pressable hitSlop={8} onPress={basculerMode}>
            <Text style={styles.link}>
              {mode === 'login'
                ? 'Pas encore de compte ? Créer un compte'
                : 'Déjà un compte ? Se connecter'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </>
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
  logo: {
    width: 130,
    height: 130,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 28,
  },
  form: {
    width: '100%',
    maxWidth: 320,
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
  button: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#43a047',
    marginTop: 6,
  },
  buttonPressed: {
    backgroundColor: '#3b8b40',
  },
  buttonDisabled: {
    backgroundColor: '#a5d6a7',
  },
  buttonDebug: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    marginTop: 10,
  },
  buttonDebugPressed: {
    backgroundColor: '#f3f4f6',
  },
  buttonDebugLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  link: {
    fontSize: 14,
    color: '#2e7d32',
    textAlign: 'center',
    marginTop: 18,
    textDecorationLine: 'underline',
  },
});
