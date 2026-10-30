import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { detecterFormat, neRetenirQueChiffres } from '../utils/codes-bar';

// Fenêtre usine côté web : la caméra du module expo-camera n'y fonctionne pas
// (code natif), la saisie manuelle d'un code-barres la remplace. Le format est
// détecté à la volée par la longueur — EAN-8, EAN-13, UPC-A, UPC-E et UPC-B.
export default function UsineEcranWeb() {
  const [saisie, setSaisie] = useState('');
  const [codeSoumis, setCodeSoumis] = useState<string | null>(null);

  const chiffres = neRetenirQueChiffres(saisie);
  const detection = detecterFormat(chiffres);

  const soumettre = () => {
    if (!detection.valide) return;
    setCodeSoumis(chiffres);
  };

  return (
    <KeyboardAvoidingView style={styles.plein} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <View style={styles.centre}>
        <Text style={styles.titre}>Usine — saisie d&rsquo;un code-barres</Text>
        <Text style={styles.aide}>
          Formats acceptés : EAN-8, EAN-13, UPC-A, UPC-E et UPC-B (11 chiffres, sans clé de
          contrôle). Les séparateurs (espaces, tirets) sont ignorés.
        </Text>

        <TextInput
          style={styles.champ}
          value={saisie}
          onChangeText={(nouvelle) => {
            setSaisie(nouvelle);
            setCodeSoumis(null);
          }}
          placeholder="Code-barres"
          placeholderTextColor="#9aa3ab"
          keyboardType="numeric"
          maxLength={13}
          autoFocus
        />

        {chiffres.length > 0 && (
          <Text
            style={[
              styles.libelleFormat,
              detection.valide ? styles.formatValide : styles.formatInvalide,
            ]}
          >
            {detection.libelle}
          </Text>
        )}

        <Pressable
          style={[styles.bouton, !detection.valide && styles.boutonDesactive]}
          disabled={!detection.valide}
          onPress={soumettre}
        >
          <Text style={[styles.boutonTexte, !detection.valide && styles.boutonTexteDesactive]}>
            Valider le code
          </Text>
        </Pressable>

        {codeSoumis !== null && (
          <Text style={styles.soumis}>
            Code {codeSoumis} prêt — en attente du serveur (branchement à venir).
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  plein: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  titre: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  aide: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: 360,
  },
  champ: {
    width: '86%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#e3e6ea',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 2,
    color: '#111827',
  },
  libelleFormat: {
    fontSize: 14,
    fontWeight: '600',
  },
  formatValide: {
    color: '#2e7d32',
  },
  formatInvalide: {
    color: '#c62828',
  },
  bouton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    backgroundColor: '#43a047',
  },
  boutonDesactive: {
    backgroundColor: '#e5e7eb',
  },
  boutonTexte: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  boutonTexteDesactive: {
    color: '#9aa3ab',
  },
  soumis: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
});
