import { Stack } from 'expo-router';
import FenetreVierge from '../components/fenetre-vierge';

export default function MaisonScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Maison' }} />
      <FenetreVierge />
    </>
  );
}
