// Variante web du service de notifications système. `expo-notifications` ne
// couvre pas le web (SDK 58) : on utilise l'API `Notification` du navigateur,
// servie de préférence par le service worker public/service-worker.js. Le clic
// est renvoyé dans la page par postMessage, sans URL ni route (SPA à racine fixe).

const CHEMIN_SERVICE_WORKER = '/service-worker.js';
const TITRE = 'CodEbara';
const ICONE = '/icon.png';
const MESSAGE_OUVRIR_POSTE = 'codebara-ouvrir-poste';

export type NotificationAffichable = {
  id: number;
  object: string;
  type: string;
};

export async function preparerNotificationsSysteme(): Promise<void> {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register(CHEMIN_SERVICE_WORKER);
    } catch {
      // Service worker facultatif (navigation privée, permissions…).
    }
  }
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      // Refus utilisateur : simplement pas de notification système web.
    }
  }
}

export async function afficherNotificationSysteme(
  notification: NotificationAffichable,
): Promise<boolean> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false;
  }
  const options: NotificationOptions = {
    body: `${notification.object}${notification.type ? ` — ${notification.type}` : ''}`,
    icon: ICONE,
    tag: `codebara-${notification.id}`,
    data: { notificationId: notification.id },
  };
  try {
    // Chrome Android exige `registration.showNotification` ; `new Notification`
    // reste le repli sur les navigateurs sans service worker enregistré.
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const inscription = await navigator.serviceWorker.getRegistration();
      if (inscription) {
        await inscription.showNotification(TITRE, options);
        return true;
      }
    }
    new Notification(TITRE, options);
    return true;
  } catch {
    return false;
  }
}

export function installerClicNotification(
  surClic: (notificationId: number | null) => void,
): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return () => undefined;
  }
  const ecouteur = (evenement: MessageEvent) => {
    const donnees = evenement.data as
      | { type?: string; notificationId?: number }
      | undefined;
    if (donnees?.type !== MESSAGE_OUVRIR_POSTE) return;
    surClic(typeof donnees.notificationId === 'number' ? donnees.notificationId : null);
  };
  navigator.serviceWorker.addEventListener('message', ecouteur);
  return () => navigator.serviceWorker.removeEventListener('message', ecouteur);
}
