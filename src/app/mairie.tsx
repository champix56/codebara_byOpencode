import { Stack } from 'expo-router';
import MairieEcran from '../components/mairie-ecran';

// Route /mairie — fenêtre « mairie » : accès aux informations personnelles et
// à leur modification (nickname et, à terme, mot de passe une fois l'endpoint
// serveur disponible). La barre de navigation native affiche le titre
// « Mairie » et le bouton de retour.
export default function MairieScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Mairie' }} />
      <MairieEcran />
    </>
  );
}
