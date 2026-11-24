/* Service worker minimal pour les notifications système web de CodEbara.
 *
 * L'app est une SPA sans route : le clic ne navigation JAMAIS vers une URL
 * particulière. On ramène l'onglet existant au premier plan (ou on ouvre la
 * racine) puis on poste un message au bundle React, qui ouvre la fenêtre
 * `poste` via src/navigation/navigateur.ts.
 *
 * Pas de stratégie de cache agressive : le service worker ne doit jamais
 * empêcher une mise à jour du bundle web.
 */
self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close();
  const donnees = evenement.notification.data || {};
  const message = {
    type: 'codebara-ouvrir-poste',
    notificationId:
      typeof donnees.notificationId === 'number' ? donnees.notificationId : null,
  };

  evenement.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const fenetre of fenetres) {
        if ('focus' in fenetre) {
          await fenetre.focus();
          fenetre.postMessage(message);
          return;
        }
      }
      const nouvelleFenetre = await self.clients.openWindow('/');
      if (nouvelleFenetre) nouvelleFenetre.postMessage(message);
    })(),
  );
});
