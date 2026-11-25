// Sur le web, la tâche native n'existe pas : le service worker gère un
// `periodicsync` best-effort (voir public/service-worker.js et
// src/services/notifications-plateforme.web.ts).
export const TACHE_NOTIFICATIONS = 'codebara-notifications';

export async function enregistrerTacheNotifications(): Promise<void> {
  // Rien à enregistrer côté navigateur.
}
