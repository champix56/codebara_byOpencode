import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fenetreCourante, naviguer } from '../navigation/navigateur';
import { useAppSelector } from '../store/hooks';

// Hauteur commune au titre et au logo : le logo reste exactement de la hauteur
// du texte, comme demandé, sans agrandir la barre.
const HAUTEUR_TITRE = 20;

// Affichage décoratif pour l'instant : `utilisateur.amount` n'est pas encore
// branché sur l'interface (cf. integration-client.md : monnaie non utilisée).
const MONTANT_AFFICHE = 1000;

type Props = {
  titre: string;
  // Bouton retour (chevron ‹) : dépile la pile de navigation quand fourni.
  onRetour?: () => void;
  // Emplacement gauche libre (ex. bouton ☰ du menu latéral, fenêtre principale) ;
  // présent, il remplace le chevron de retour.
  gauche?: ReactNode;
};

// Barre d'en-tête maison des fenêtres — remplace les en-têtes natifs du Stack
// (disparus avec le router). Titre centré précédé du logo, slot gauche
// (retour ou burger), et slot droite : pièce + valeur dans une bulle verte
// claire puis avatar (initiales du nickname) ouvrant directement la mairie.
// Les deux slots ont la même largeur pour garder le titre réellement centré.
// La marge haute respecte la zone sûre (encoche natif ; 0 sur le web).
export default function EnteteEcran({ titre, onRetour, gauche }: Props) {
  const insets = useSafeAreaInsets();
  const nickname = useAppSelector((etat) => etat.utilisateur.nickname);
  const initiales = nickname.trim().slice(0, 2).toUpperCase() || '?';

  const ouvrirMairie = () => {
    // Évite d'empiler une seconde mairie quand on est déjà dedans.
    if (fenetreCourante().nom !== 'mairie') {
      naviguer({ nom: 'mairie' });
    }
  };

  return (
    <View style={[styles.barre, { paddingTop: insets.top }]}>
      <View style={styles.rang}>
        <View style={[styles.cote, styles.coteGauche]}>
          {gauche ?? (onRetour && (
            <Pressable hitSlop={12} onPress={onRetour} accessibilityLabel="Retour">
              <Text style={styles.chevron}>‹</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.centre}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.titre} numberOfLines={1}>
            {titre}
          </Text>
        </View>
        <View style={[styles.cote, styles.coteDroit]}>
          <View style={styles.monnaie}>
            <Image
              source={require('../../assets/coin.png')}
              style={styles.piece}
              resizeMode="contain"
            />
            <View style={styles.bulleValeur}>
              <Text style={styles.valeur}>{MONTANT_AFFICHE}</Text>
            </View>
          </View>
          <Pressable
            hitSlop={8}
            onPress={ouvrirMairie}
            accessibilityLabel="Ouvrir la mairie"
            accessibilityRole="button"
            style={styles.avatar}
          >
            <Text style={styles.initiales}>{initiales}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: {
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  rang: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  cote: {
    width: 88,
    justifyContent: 'center',
  },
  coteGauche: {
    alignItems: 'flex-start',
  },
  coteDroit: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 5,
  },
  centre: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chevron: {
    fontSize: 28,
    color: '#1f2937',
    paddingHorizontal: 12,
  },
  logo: {
    width: HAUTEUR_TITRE,
    height: HAUTEUR_TITRE,
  },
  titre: {
    flexShrink: 1,
    fontSize: 17,
    lineHeight: HAUTEUR_TITRE,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  monnaie: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  piece: {
    width: 15,
    height: 15,
  },
  bulleValeur: {
    minWidth: 36,
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  valeur: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
  },
  initiales: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
  },
});
