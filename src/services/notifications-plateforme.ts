import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

// Variante native (Android/iOS) du service de notifications système.
// Le web résout `notifications-plateforme.web.ts` (API Notification du
// navigateur + service worker) : `expo-notifications` ne couvre pas le web.
const CANAL = 'codebara-notifications';

export type NotificationAffichable = {
  id: number;
  object: string;
  type: string;
};

function idDepuisReponse(reponse: Notifications.NotificationResponse | null): number | null {
  const brut = reponse?.notification.request.content.data?.notificationId;
  return typeof brut === 'number' ? brut : null;
}

export async function preparerNotificationsSysteme(): Promise<void> {
  // SDK 58 : sans handler explicite, la notification foreground est déjà
  // affichée par défaut ; on le pose quand même pour un comportement stable.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CANAL, {
      name: 'Notifications CodEbara',
      importance: AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#43a047',
    });
  }
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
}

export async function afficherNotificationSysteme(
  notification: NotificationAffichable,
): Promise<boolean> {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return false;
  await Notifications.scheduleNotificationAsync({
    identifier: `codebara-${notification.id}`,
    // Logo (icône Android via le config plugin), nature sous forme de sous-titre,
    // objet visible — jamais le corps ( carte/checksum ) de la notification.
    content: {
      title: 'CodEbara',
      subtitle: notification.type || 'information',
      body: notification.object,
      sound: false,
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
