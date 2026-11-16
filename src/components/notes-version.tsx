import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NOTES_VERSION, VERSION_APPLI } from '../data/notes-version';

// Fenêtre « notes de version » : nouveautés de chaque version, mode
// incrémentiel. La liste vient de src/data/notes-version.ts (généré depuis
// NOTES-VERSION.md, racine — npm run maj:notes après édition du md). La
// version courante (première section du md) est mise en avant.
export default function NotesVersion() {
  return (
    <ScrollView style={styles.plein} contentContainerStyle={styles.contenu}>
      <Text style={styles.introduction}>
        Nouveautés par version — la plus récente en premier.
      </Text>
      {NOTES_VERSION.map((note, index) => (
        <View
          key={note.version}
          style={[styles.version, index === 0 && styles.versionCourante]}
        >
          <View style={styles.enteteVersion}>
            <Text style={[styles.titreVersion, index === 0 && styles.titreCourant]}>
              {note.version}
            </Text>
            {index === 0 && note.version.replace(/^v/, '') === VERSION_APPLI && (
              <Text style={styles.badge}>installée</Text>
            )}
          </View>
          {note.lignes.map((ligne, numeroLigne) => (
            <Text key={numeroLigne} style={styles.ligne}>
              {`• ${ligne}`}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  plein: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contenu: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  introduction: {
    fontSize: 13,
    color: '#6b7280',
  },
  version: {
    gap: 6,
  },
  versionCourante: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a5d6a7',
    backgroundColor: '#f2faf3',
    padding: 14,
  },
  enteteVersion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titreVersion: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
  },
  titreCourant: {
    color: '#2e7d32',
  },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2e7d32',
    borderWidth: 1,
    borderColor: '#a5d6a7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ligne: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
});
