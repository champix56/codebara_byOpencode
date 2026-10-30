import { Stack } from 'expo-router';
import UsineEcran from '../components/usine-ecran';

// Route /usine — Metro choisit la variante `usine-ecran.web.tsx` (formulaire de
// saisie) sur le web et `usine-ecran.tsx` (scanneur caméra) sur iOS / Android.
// La barre de navigation natif affiche le titre et le bouton de retour.
export default function UsineScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Usine' }} />
      <UsineEcran />
    </>
  );
}
