// Composant racine de l'application (enregistré par index.ts via
// registerRootComponent). Rend la fenêtre courante de la pile de navigation
// (src/navigation/navigateur.ts) — l'app est une SPA sans router ni URL :
// l'entrée est toujours le splash « chargement », puis le parcours se joue
// sur les boutons du jeu (zones de la carte, menu latéral, retour).
//
// Les fenêtres secondaires (usine, maison, mairie, boutique, arène, détail
// carte) portent la même barre d'en-tête maison (EnteteEcran : titre + bouton
// retour qui dépile). Les barres natives du Stack ont disparu avec le router.
import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import CarteDetail from './src/components/carte-detail';
import EnteteEcran from './src/components/entete-ecran';
import FenetreVierge from './src/components/fenetre-vierge';
import MaisonEcran from './src/components/maison-ecran';
import MairieEcran from './src/components/mairie-ecran';
import NotesVersion from './src/components/notes-version';
import UsineEcran from './src/components/usine-ecran';
import Chargement from './src/ecrans/chargement';
import Connexion from './src/ecrans/connexion';
import Principal from './src/ecrans/principal';
import {
  enregistrerEcouteur,
  fenetreCourante,
  retourner,
  type Fenetre,
} from './src/navigation/navigateur';
import { persistor, store } from './src/store/store';
import {
  installerHistoriqueWeb,
  retourWeb,
  synchroniser,
} from './src/utils/historique-web';

// Fenêtre secondaire : en-tête maison (titre + retour) au-dessus du contenu.
// Le retour dépile vers la fenêtre ouvrante (principal → maison → carte…).
// WEB : le retour consomme une entrée d'historique navigateur (history.back)
// et le popstate replie la pile (src/utils/historique-web.ts) — le ‹ du
// navigateur et le ‹ de l'en-tête restent alignés, l'app ne quitte jamais.
function FenetreAvecEntete({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <View style={styles.plein}>
      <EnteteEcran
        titre={titre}
        onRetour={Platform.OS === 'web' ? retourWeb : retourner}
      />
      {children}
    </View>
  );
}

function rendreFenetre(fenetre: Fenetre): ReactNode {
  switch (fenetre.nom) {
    case 'chargement':
      return <Chargement mode={'mode' in fenetre ? fenetre.mode : undefined} />;
    case 'connexion':
      return <Connexion />;
    case 'principal':
      return <Principal />;
    case 'usine':
      return (
        <FenetreAvecEntete titre="Usine">
          {/* Metro choisit la variante `usine-ecran.web.tsx` (formulaire de
              saisie) sur le web et `usine-ecran.tsx` (scanneur caméra) en natif. */}
          <UsineEcran />
        </FenetreAvecEntete>
      );
    case 'maison':
      return (
        <FenetreAvecEntete titre="Maison">
          <MaisonEcran />
        </FenetreAvecEntete>
      );
    case 'mairie':
      return (
        <FenetreAvecEntete titre="Mairie">
          <MairieEcran />
        </FenetreAvecEntete>
      );
    case 'boutique':
      return (
        <FenetreAvecEntete titre="Boutique">
          <FenetreVierge />
        </FenetreAvecEntete>
      );
    case 'arene':
      return (
        <FenetreAvecEntete titre="Arène">
          <FenetreVierge />
        </FenetreAvecEntete>
      );
    case 'carte':
      return (
        <FenetreAvecEntete titre="Carte">
          <CarteDetail carteId={fenetre.carteId} />
        </FenetreAvecEntete>
      );
    case 'notes':
      return (
        <FenetreAvecEntete titre="Notes de version">
          <NotesVersion />
        </FenetreAvecEntete>
      );
  }
}

export default function App() {
  // La pile vit dans le module navigateur (le service api.ts y écrit aussi,
  // hors React) ; l'état local n'est que le miroir de rendu.
  const [fenetre, setFenetre] = useState<Fenetre>(fenetreCourante);

  useEffect(() => {
    // WEB : une entrée d'historique navigateur par niveau de pile — le ‹ du
    // navigateur revient à la fenêtre précédente de l'app au lieu de quitter
    // le site (et le ‹ de l'en-tête reste aligné avec lui).
    if (Platform.OS === 'web') installerHistoriqueWeb();
    enregistrerEcouteur((nouvelle) => {
      setFenetre(nouvelle);
      synchroniser();
    });
    return () => enregistrerEcouteur(null);
  }, []);

  // Android — bouton système retour : dépile s'il reste une fenêtre sous la
  // courante ; à la racine (chargement/connecté sur principal…), `retourner`
  // renvoie false et l'OS ferme l'app (comportement d'origine du Stack).
  // Le listener lit la pile du module : aucun besoin de se réabonner.
  // (BackHandler n'existe pas sur le web — react-native-web loggue une erreur
  // si on s'y abonne, d'où la garde natif.)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const abonnement = BackHandler.addEventListener('hardwareBackPress', () => retourner());
    return () => abonnement.remove();
  }, []);

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {/* SafeAreaProvider : montait implicitement avec expo-router —
            registerRootComponent ne le fait pas (en-têtes + bandeau pub
            lisent useSafeAreaInsets). */}
        <SafeAreaProvider>{rendreFenetre(fenetre)}</SafeAreaProvider>
      </PersistGate>
    </Provider>
  );
}

const styles = StyleSheet.create({
  plein: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
