import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

// Variante native (Android/iOS) du service de notifications système.
// Le web résout `notifications-plateforme.web.ts` (API Notification du
// navigateur + service worker) : `expo-notifications` ne couvre pas le web.
const CANAL = 'codebara-notifications';
const VIBRATION = [0, 250, 250, 250];

export type NotificationAffichable = {
  id: number;
  object: string;
  type: string;
};

function idDepuisReponse(reponse: Notifications.NotificationResponse | null): number | null {
  const brut = reponse?.notification.request.content.data?.notificationId;
  return typeof brut === 'number' ? brut : null;
}

// Sans demande de permission : appellable au chargement du bundle, y compris
// quand la tâche en arrière-plan réveille l'app sans montage de l'interface.
export function configurerNotificationsSysteme(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      // Sur Android, `false` empêche aussi le bandeau de s'afficher et annule
      // le son du canal : on laisse le son système jouer.
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function configurerCanal(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL, {
    name: 'Notifications CodEbara',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: VIBRATION,
    lightColor: '#43a047',
  });
}

export async function preparerNotificationsSysteme(): Promise<void> {
  configurerNotificationsSysteme();
  await configurerCanal();
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') {
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
  }
}

// Préparation minimale pour la tâche en arrière-plan : handler + canal, sans
// prompte (impossible hors interface). Les permissions sont celles accordées
// lors d'un lancement normal de l'app.
export async function preparerNotificationsArrierePlan(): Promise<void> {
  configurerNotificationsSysteme();
  await configurerCanal();
}

// Le service worker est une particularité web : côté natif, le dernier id est
// déjà mémorisé par AsyncStorage pour la tâche en arrière-plan.
export async function enregistrerIdUserServiceWorker(idUser: number | null): Promise<void> {
  void idUser;
}

export async function afficherNotificationSysteme(
  notification: NotificationAffichable,
): Promise<boolean> {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return false;
  const identifiant = `codebara-${notification.id}`;
  // Même identifiant = même notification : on évite un doublage si le polling
  // et la tâche en arrière-plan se croisent avant le marquage `fetched`.
  try {
    await Notifications.cancelScheduledNotificationAsync(identifiant);
  } catch {
    // Aucune notification planifiée sous cet identifiant : cas normal.
  }
  await Notifications.scheduleNotificationAsync({
    identifier: identifiant,
    // Logo (icône Android via le config plugin), nature sous forme de sous-titre,
    // objet visible — jamais le corps ( carte/checksum ) de la notification.
    content: {
      title: 'CodEbara',
      subtitle: notification.type || 'information',
      body: notification.object,
      sound: true,
      vibrate: Platform.OS === 'android' ? VIBRATION : undefined,
      data: { notificationId: notification.id },
    },
    trigger: Platform.OS === 'android' ? { channelId: CANAL } : null,
  });
  return true;
}

export function installerClicNotification(
  surClic: (notificationId: number | null) => void,
): () => void {
  const abonnement = Notifications.addNotificationResponseReceivedListener((reponse) => {
    const id = idDepuisReponse(reponse);
    Notifications.clearLastNotificationResponse();
    surClic(id);
  });
  // App lancée depuis le centre de notifications : le clic a eu lieu avant le
  // montage de l'écouteur. `getLastNotificationResponseAsync` le rejoue une fois.
  void Notifications.getLastNotificationResponseAsync()
    .then((reponse) => {
      if (!reponse) return;
      const id = idDepuisReponse(reponse);
      Notifications.clearLastNotificationResponse();
      surClic(id);
    })
    .catch(() => undefined);
  return () => abonnement.remove();
}
