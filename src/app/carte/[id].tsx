import { Stack, useLocalSearchParams } from 'expo-router';
import CarteDetail from '../../components/carte-detail';

// Route /carte/[id] — fenêtre détail d'une carte (ouverte depuis la liste de
// la maison) : barre de navigation native avec bouton retour. L'id vient du
// segment d'URL — Number() le transforme ; un id non numérique affiche un
// message dédié dans le composant.
export default function EcranCarte() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const carteId = Number(Array.isArray(id) ? id[0] : id);
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Carte' }} />
      <CarteDetail carteId={carteId} />
    </>
  );
}
