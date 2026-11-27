import { useRef, useState } from 'react';
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
import { VERSION_APPLI } from '../data/notes-version';
import { naviguer, remplacer } from '../navigation/navigateur';
import { authentifierParLogin, creerCompte, renouvelerMotDePasse, ErreurApi, obtenirUrlBase, definirUrlBase } from '../services/api';
import { useAppDispatch } from '../store/hooks';
import { UTILISATEUR_DEBUG, seConnecter } from '../store/utilisateur';

type Mode = 'login' | 'signup' | 'oublie';

// La même fenêtre sert à la connexion, à la création de compte ET au
// renouvellement du mot de passe (lien « Mot de passe oublié ? ») :
// les liens en bas basculent entre les trois. Le mail saisi est conservé
// d'un mode à l'autre.
export default function Connexion() {
  // Bouton de debug : visible uniquement si la variable d'environnement DEBUG vaut « true »
// (shell : `DEBUG=true npx expo start`, ou `DEBUG=true` dans .env). La config dynamique
// (app.config.ts) fait l'aiguillage : valeur inlinée via EXPO_PUBLIC_DEBUG côté bundle,
// plus redondance via Constants.expoConfig.extra.debug (réliable en natif).
const MODE_DEBUG =
  process.env.EXPO_PUBLIC_DEBUG === 'true' //|| Constants.expoConfig?.extra?.debug === true;
  const [mode, setMode] = useState<Mode>('login');
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);
  const [enCours, setEnCours] = useState(false);
  // Adresse du serveur — modifiable sur mobile comme sur web (préremplie avec
  // la valeur de .env, éditable avant la connexion).
  const [adresseServeur, setAdresseServeur] = useState(obtenirUrlBase());
  // Le champ « Adresse du serveur » est masqué par défaut ; il réapparaît après
  // 5 appuis rapides sur le logo (mobile comme web, usage développeur).
  const [afficherUrl, setAfficherUrl] = useState(false);
  const compteurLogoRef = useRef(0);
  const minuteurLogoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dispatcher = useAppDispatch();

  const gererTapLogo = () => {
    if (minuteurLogoRef.current) clearTimeout(minuteurLogoRef.current);
    compteurLogoRef.current += 1;
    if (compteurLogoRef.current >= 5) {
      setAfficherUrl(true);
      compteurLogoRef.current = 0;
    }
    minuteurLogoRef.current = setTimeout(() => {
      compteurLogoRef.current = 0;
    }, 2000);
  };

  // Connexion : mot de passe haché côté client (§3.2 du contrat : sha256Hex(mail_exact + clair)) ;
  // Création : mail seul (le serveur génère le mot de passe et l'envoie par
  // e-mail — config serveur DEBUG=False ; en dev rien n'est envoyé, §12.1).
  // Mot de passe oublié : mail seul → POST /user/renew-password (§5.9).
  const peutSoumettre =
    !enCours &&
    identifiant.trim().length > 0 &&
    (mode === 'login' ? motDePasse.length > 0 : identifiant.includes('@'));

  const soumettre = async () => {
    if (!peutSoumettre) return;
    // L'utilisateur peut avoir édité l'adresse du serveur (accès développeur
    // par 5 appuis sur le logo) : on l'applique avant tout appel API.
    definirUrlBase(adresseServeur);
    setEnCours(true);
    setMessage(null);
    const mailExact = identifiant.trim();
    try {
      if (mode === 'login') {
        const donnees = await authentifierParLogin(mailExact, motDePasse);
        // Données serveur + les deux tokens ré-émis → tranche persistée.
        dispatcher(
          seConnecter({
            idUser: donnees.id,
            nickname: donnees.nickname,
            mail: donnees.mail,
            amount: donnees.amount,
            avatar: donnees.avatar,
            hash: donnees.hash,
            apiToken: donnees.apiToken,
            requestToken: donnees.requestToken,
          }),
        );
        // Remplacement : pas de retour arrière vers la connexion. Le splash
        // est remis avec les étapes « connexion » puis « récupération des
        // cartes » (vérification du cache + téléchargement des manquantes).
        remplacer({ nom: 'chargement', mode: 'post-connexion' });
      } else if (mode === 'signup') {
        await creerCompte(mailExact);
        // Succès : le serveur a créé le compte ; le mot de passe arrive par
        // e-mail (quand la config serveur l'envoie — cf. §5.1 / §12.1).
        setMessage({
          texte: 'Compte créé. Le mot de passe t’arrive par e-mail si le serveur est configuré pour l’envoyer.',
          erreur: false,
        });
        setIdentifiant('');
        setMotDePasse('');
        setMode('login');
      } else {
        // Mot de passe oublié — contrat §5.9 : le serveur renvoie le NEUF par
        // e-mail ({"renewed": true}, aucun token émis). Le 403 « Forbidden » est
        // AMBIGU par conception (mail mal formé ou compte inconnu) → même
        // message : ne jamais révéler l'existence des comptes.
        try {
          await renouvelerMotDePasse(mailExact);
          setMessage({
            texte: 'Si ce compte existe, un courriel avec le nouveau mot de passe vient de partir.',
            erreur: false,
          });
        } catch (erreur) {
          const libelle = (erreur as Error).message;
          if (erreur instanceof ErreurApi && libelle === 'Forbidden') {
            setMessage({
              texte: 'Si ce compte existe, un courriel avec le nouveau mot de passe vient de partir.',
              erreur: false,
            });
          } else {
            throw erreur;
          }
        }
        setMotDePasse('');
        setMode('login');
      }
    } catch (erreur) {
      setMessage({ texte: (erreur as Error).message, erreur: true });
    } finally {
      setEnCours(false);
    }
  };

  const basculerMode = (cible: Mode) => {
    setMode(cible);
    setMessage(null);
  };

  // Bouton debug : saute l'authentification, charge le compte GOD dans la tranche
  // utilisateur persistante puis passe par le splash en mode `debug` (aucun
  // token serveur, aucune carte à récupérer) — mais l'étape saison est gardée,
  // surtout sur le web où elle doit être complètement arrivée avant la principale.
  const passerAuthentification = () => {
    dispatcher(seConnecter(UTILISATEUR_DEBUG));
    remplacer({ nom: 'chargement', mode: 'debug' });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Pressable onPress={gererTapLogo} accessibilityLabel="Logo">
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={styles.title}>Bienvenue sur codEbara</Text>
        <Text style={styles.subtitle}>
          {mode === 'login'
            ? 'Connecte-toi à ton compte'
            : mode === 'signup'
              ? 'Crée ton compte — le mot de passe t’arrivera par e-mail'
              : 'Saisis ton e-mail pour en recevoir un nouveau'}
        </Text>

        <View style={styles.form}>
          {afficherUrl && (
            <TextInput
              style={styles.input}
              placeholder="Adresse du serveur"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              value={adresseServeur}
              onChangeText={(texte) => {
                setAdresseServeur(texte);
                setMessage(null);
              }}
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={identifiant}
            onChangeText={(texte) => {
              setIdentifiant(texte);
              setMessage(null);
            }}
          />
          {mode === 'login' && (
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              value={motDePasse}
              onChangeText={(texte) => {
                setMotDePasse(texte);
                setMessage(null);
              }}
            />
          )}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              !peutSoumettre && styles.buttonDisabled,
              pressed && peutSoumettre && styles.buttonPressed,
            ]}
            onPress={soumettre}
            disabled={!peutSoumettre}
          >
            <Text style={styles.buttonLabel}>
              {mode === 'login'
                ? 'Connexion'
                : mode === 'signup'
                  ? 'Créer mon compte'
                  : 'Recevoir un nouveau mot de passe'}
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

          {message && (
            <Text style={message.erreur ? styles.messageErreur : styles.messageSucces} numberOfLines={3}>
              {message.texte}
            </Text>
          )}

          {mode !== 'oublie' && (
            <Pressable hitSlop={6} onPress={() => basculerMode('oublie')} accessibilityLabel="Mot de passe oublié">
              <Text style={styles.lienOublie}>Mot de passe oublié ?</Text>
            </Pressable>
          )}

          <Pressable
            hitSlop={8}
            onPress={() => basculerMode(mode === 'oublie' ? 'login' : mode === 'signup' ? 'login' : 'signup')}
          >
            <Text style={styles.link}>
              {mode === 'login'
                ? 'Pas encore de compte ? Créer un compte'
                : mode === 'signup'
                  ? 'Déjà un compte ? Se connecter'
                  : 'Je l’ai retrouvé — me connecter'}
            </Text>
          </Pressable>

          <Pressable
            hitSlop={6}
            onPress={() => naviguer({ nom: 'notes' })}
            accessibilityLabel={`Version ${VERSION_APPLI} — notes de version`}
          >
            <Text style={styles.version}>CodEbara v{VERSION_APPLI}</Text>
          </Pressable>
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
  messageSucces: {
    fontSize: 14,
    color: '#2e7d32',
    textAlign: 'center',
    marginTop: 12,
  },
  messageErreur: {
    fontSize: 14,
    color: '#c62828',
    textAlign: 'center',
    marginTop: 12,
  },
  link: {
    fontSize: 14,
    color: '#2e7d32',
    textAlign: 'center',
    marginTop: 10,
    textDecorationLine: 'underline',
  },
  lienOublie: {
    fontSize: 14,
    color: '#2e7d32',
    textAlign: 'center',
    marginTop: 18,
    textDecorationLine: 'underline',
  },
  version: {
    fontSize: 11,
    fontWeight: '600',
    color: '#43a047',
    textAlign: 'center',
    marginTop: 18,
  },
});
