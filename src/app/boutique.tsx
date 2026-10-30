import { Stack } from 'expo-router';
import FenetreVierge from '../components/fenetre-vierge';

export default function BoutiqueScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Boutique' }} />
      <FenetreVierge />
    </>
  );
}
