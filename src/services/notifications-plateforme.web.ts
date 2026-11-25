// Variante web du service de notifications système. `expo-notifications` ne
// couvre pas le web (SDK 58) : on utilise l'API `Notification` du navigateur,
// servie de préférence par le service worker public/service-worker.js. Le clic
// est renvoyé dans la page par postMessage, sans URL ni route (SPA à racine fixe).

import { obtenirUrlBase } from './api';

const CHEMIN_SERVICE_WORKER = '/service-worker.js';
const TITRE = 'CodEbara';
const ICONE = '/icon.png';
const SON = '/notification.wav';
const VIBRATION = [0, 250, 250, 250];
const MESSAGE_OUVRIR_POSTE = 'codebara-ouvrir-poste';
const MESSAGE_CONFIG = 'codebara-config';
const SYNC_NOTIFICATIONS = 'codebara-notifications';

export type NotificationAffichable = {
  id: number;
  object: string;
  type: string;
};

// `vibrate` et `sound` ne sont pas dans le type TS du DOM, mais sont pris en
// charge par Chrome/Android ; les autres navigateurs les ignorent simplement.
type OptionsWeb = NotificationOptions & { sound?: string; vibrate?: number[] };

// `periodicSync` n'est pas encore dans les types DOM de TypeScript.
type RegistrationAvecSync = ServiceWorkerRegistration & {
  periodicSync?: {
    register(tag: string, options: { minInterval: number }): Promise<void>;
  };
};

function optionsWeb(notification: NotificationAffichable): OptionsWeb {
  return {
    body: `${notification.object}${notification.type ? ` — ${notification.type}` : ''}`,
    icon: ICONE,
    tag: `codebara-${notification.id}`,
    data: { notificationId: notification.id },
    vibrate: VIBRATION,
    sound: SON,
  };
}

// `sound`/`vibrate` des notifications web ne sont pas normalisés : quand
// l'onglet est ouvert, on joue aussi le son et la vibration directement.
function jouerSonEtVibrer(): void {
  try {
    void new Audio(SON).play().catch(() => undefined);
  } catch {
    // Lecture auto refusée par le navigateur : la notification reste affichée.
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(VIBRATION);
  }
}

async function configurerSyncPeriodique(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const inscription = (await navigator.serviceWorker.ready) as RegistrationAvecSync;
  const periode = inscription.periodicSync;
  if (!periode) return;
  try {
    await periode.register(SYNC_NOTIFICATIONS, { minInterval: 15 * 60 * 1000 });
  } catch {
    // API encore expérimentale : la tâche native couvre le mobile, le web
    // reste à jour quand l'onglet est ouvert.
  }
}

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
  await configurerSyncPeriodique();
}

// Transmis au service worker pour qu'il puisse interroger le serveur en synchro
// périodique : ni token, ni historique navigateur, juste le dernier id connecté.
export async function enregistrerIdUserServiceWorker(idUser: number | null): Promise<void> {
  if (idUser === null || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  try {
    const inscription = await navigator.serviceWorker.ready;
    inscription.active?.postMessage({
      type: MESSAGE_CONFIG,
      iduser: idUser,
      urlBase: obtenirUrlBase(),
    });
  } catch {
    // Service worker absent : le polling dans l'onglet continue de fonctionner.
  }
}

export async function afficherNotificationSysteme(
  notification: NotificationAffichable,
): Promise<boolean> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false;
  }
  const options = optionsWeb(notification);
  try {
    jouerSonEtVibrer();
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
