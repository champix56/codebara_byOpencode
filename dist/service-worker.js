/* Service worker des notifications système web de CodEbara.
 *
 * L'app est une SPA sans route : le clic ne navigation JAMAIS vers une URL
 * particulière. On ramène l'onglet existant au premier plan (ou on ouvre la
 * racine) puis on poste un message au bundle React, qui ouvre la fenêtre
 * `poste` via src/navigation/navigateur.ts.
 *
 * Le `periodicsync` interroge le serveur avec le dernier `iduser` transmis par
 * la page : AUCUN token n'est envoyé, donc aucune rotation n'est consommée.
 * La configuration est persistée dans le Cache API car le service worker peut
 * être arrêté entre deux exécutions.
 */

const CACHE_CONFIG = 'codebara-notif-config';
const CLE_CONFIG = '/config';
const TAG_SYNC = 'codebara-notifications';
const MESSAGE_CONFIG = 'codebara-config';
const MESSAGE_OUVRIR_POSTE = 'codebara-ouvrir-poste';
const TITRE = 'CodEbara';
const ICONE = '/icon.png';
const SON = '/notification.wav';
const VIBRATION = [0, 250, 250, 250];

async function lireConfig() {
  try {
    const cache = await caches.open(CACHE_CONFIG);
    const reponse = await cache.match(CLE_CONFIG);
    if (!reponse) return null;
    const config = await reponse.json();
    const iduser = Number(config.iduser);
    const urlBase = typeof config.urlBase === 'string' ? config.urlBase.replace(/\/+$/, '') : '';
    if (!Number.isFinite(iduser) || iduser <= 0 || !urlBase) return null;
    return { iduser, urlBase };
  } catch {
    return null;
  }
}

async function ecrireConfig(iduser, urlBase) {
  const cache = await caches.open(CACHE_CONFIG);
  await cache.put(
    CLE_CONFIG,
    new Response(JSON.stringify({ iduser, urlBase }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(self.clients.claim());
});

self.addEventListener('message', (evenement) => {
  const donnees = evenement.data;
  if (!donnees || donnees.type !== MESSAGE_CONFIG) return;
  const iduser = Number(donnees.iduser);
  const urlBase = typeof donnees.urlBase === 'string' ? donnees.urlBase.replace(/\/+$/, '') : '';
  if (!Number.isFinite(iduser) || iduser <= 0 || !urlBase) return;
  evenement.waitUntil(ecrireConfig(iduser, urlBase));
});

async function afficher(notifications, config) {
  for (const notification of notifications) {
    if (!notification) continue;
    const id = Number(notification.id);
    if (!Number.isFinite(id) || notification.fetched === true || notification.fetched === 1) {
      continue;
    }
    const options = {
      body: String(notification.object || ''),
      icon: ICONE,
      tag: 'codebara-' + id,
      data: { notificationId: id },
      vibrate: VIBRATION,
      sound: SON,
    };
    try {
      await self.registration.showNotification(TITRE, options);
    } catch {
      continue;
    }
    try {
      // Marque « présentée » sans toucher à `state` (lu/non lu) et sans token.
      await fetch(config.urlBase + '/notifications/' + id + '/fetched', {
        method: 'PUT',
        headers: { datas: JSON.stringify({ iduser: config.iduser }) },
      });
    } catch {
      // Nouvel essai à la prochaine synchro ; `tag` évite l'accumulation.
    }
  }
}

async function interrogerServeur() {
  const config = await lireConfig();
  if (!config) return;
  const reponse = await fetch(config.urlBase + '/notifications', {
    method: 'GET',
    headers: { datas: JSON.stringify({ iduser: config.iduser }) },
  });
  if (!reponse.ok) return;
  const corps = await reponse.json();
  if (!corps || !Array.isArray(corps.notifications)) return;
  await afficher(corps.notifications, config);
}

self.addEventListener('periodicsync', (evenement) => {
  if (evenement.tag !== TAG_SYNC) return;
  evenement.waitUntil(interrogerServeur());
});

self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close();
  const donnees = evenement.notification.data || {};
  const message = {
    type: MESSAGE_OUVRIR_POSTE,
    notificationId: typeof donnees.notificationId === 'number' ? donnees.notificationId : null,
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
