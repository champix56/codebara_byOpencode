import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import {
  listerNotificationsSansToken,
  marquerNotificationFetcheeSansToken,
} from '../services/api';
import {
  afficherNotificationSysteme,
  preparerNotificationsArrierePlan,
} from '../services/notifications-plateforme';
import { lireDernierIdUser } from '../utils/dernier-utilisateur';

// Tâche native exécutée par le système (WorkManager / BGTaskScheduler). Elle
// doit être DÉFINIE au chargement du bundle : `index.ts` importe ce module.
export const TACHE_NOTIFICATIONS = 'codebara-notifications';

async function traiterNotifications(): Promise<void> {
  const idUser = await lireDernierIdUser();
  if (idUser === null) return;
  await preparerNotificationsArrierePlan();
  const notifications = await listerNotificationsSansToken(idUser);
  for (const notification of notifications) {
    if (notification.fetched) continue;
    const affichee = await afficherNotificationSysteme({
      id: notification.id,
      object: notification.object,
      type: notification.type,
    });
    if (affichee) await marquerNotificationFetcheeSansToken(notification.id, idUser);
  }
}

TaskManager.defineTask(TACHE_NOTIFICATIONS, async () => {
  try {
    await traiterNotifications();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// Enregistrement idempotent : les tâches sont conservées par le système entre
// deux lancements. Intervalle plancher 15 min (minimum imposé par Android).
export async function enregistrerTacheNotifications(): Promise<void> {
  const statut = await BackgroundTask.getStatusAsync();
  if (statut !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (await TaskManager.isTaskRegisteredAsync(TACHE_NOTIFICATIONS)) return;
  await BackgroundTask.registerTaskAsync(TACHE_NOTIFICATIONS, { minimumInterval: 15 });
}
