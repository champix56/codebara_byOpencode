import { Stack } from 'expo-router';
import FenetreVierge from '../components/fenetre-vierge';

export default function AreneScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Arène' }} />
      <FenetreVierge />
    </>
  );
}
