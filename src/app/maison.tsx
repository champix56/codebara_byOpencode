import { Stack } from 'expo-router';
import MaisonEcran from '../components/maison-ecran';

// Route /maison — fenêtre « maison » : le formulaire des informations du compte
// courant (modification du nickname et du mot de passe, tranche persistance
// utilisateur au store Redux). La barre de navigation native affiche le titre
// « Maison » et le bouton de retour.
export default function MaisonScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Maison' }} />
      <MaisonEcran />
    </>
  );
}
