# Notifications système (v0.0.18)

Deux relais se relaient pour afficher les messages de la Poste sans ouvrir l'application : le polling dans l'onglet/l'app active, puis une tâche native (mobile) ou un `periodicsync` du service worker (web) quand elle est fermée. Les deux chemins utilisent la même règle : **aucun token n'est envoyé depuis l'arrière-plan**, seulement `{"iduser": N}` dans le header `datas`. Le serveur ne renvoie donc aucun token roté et la chaîne de rotation en cours n'est pas consommée.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/hooks/use-notifications-systeme.ts` | Polling 30 s pendant que l'app est active, clic sur notification, enregistrement des relais |
| `src/services/api.ts` | `listerNotificationsSansToken`, `marquerNotificationFetcheeSansToken` (header `datas` = `iduser` seul) |
| `src/utils/dernier-utilisateur.ts` | Dernier `iduser` dans un stockage dédié, survivant à la purge Redux |
| `src/tasks/notifications-background.ts` | Tâche `expo-background-task` / `expo-task-manager` (natif), définie au chargement du bundle par `index.ts` |
| `src/tasks/notifications-background.web.ts` | No-op web : le service worker prend le relais |
| `src/services/notifications-plateforme.ts` | Handler `expo-notifications`, canal Android, son + vibration, clic |
| `src/services/notifications-plateforme.web.ts` | API `Notification`, son/vibration quand l'onglet est ouvert, config du service worker |
| `public/service-worker.js` | `periodicsync`, persistance de l'id, `showNotification` avec son/vibration, clic |
| `public/notification.wav` | Son web (les navigateurs qui ignorent l'option `sound` utilisent leur son par défaut) |

## Mobile (Android / iOS)

- `index.ts` importe `src/tasks/notifications-background.ts` pour son effet de bord : `TaskManager.defineTask` doit être appelé au chargement du bundle, y compris quand le système réveille l'app sans interface.
- `useNotificationsSysteme()` appelle `enregistrerTacheNotifications()` une fois : `BackgroundTask.registerTaskAsync` avec un intervalle plancher de **15 minutes**. L'enregistrement est idempotent.
- Exécution : lecture du dernier `iduser` → `preparerNotificationsArrierePlan()` (handler + canal, sans prompte) → `GET /notifications` sans token → pour chaque notification `fetched = false`, `scheduleNotificationAsync` puis `PUT /notifications/{id}/fetched` sans token.
- Affichage : titre « CodEbara », nature en sous-titre (`type`), objet en corps — jamais le contenu de la carte. Canaux Android : `codebara-notifications`, importance `HIGH`, son `default`, vibration `[0, 250, 250, 250]`. iOS utilise le son système ; la vibration n'a pas de motif personnalisé sur iOS.
- Le handler `setNotificationHandler` garde `shouldPlaySound: true` : le mettre à `false` supprimerait aussi le bandeau Android et le son du canal.
- Clic : session active → `poste` ; sinon reprise par tokens persistés puis `poste`, ou `connexion` si la session est morte. Aucune URL n'est modifiée (SPA à racine fixe).

## Web

- `preparerNotificationsSysteme()` enregistre `/service-worker.js`, demande la permission, puis tente `periodicSync.register('codebara-notifications', { minInterval: 15 min })`.
- Lors du polling, `enregistrerIdUserServiceWorker(idUser)` transmet le dernier id et l'URL serveur au service worker via `postMessage({ type: 'codebara-config', ... })`. Le service worker persiste ces valeurs dans le Cache API (`codebara-notif-config`) : aucun token n'est stocké.
- `periodicsync` lit cette config, interroge `GET /notifications` avec `iduser` seul, appelle `registration.showNotification` avec `vibrate` et `sound`, puis marque `fetched` avec `PUT /notifications/{id}/fetched` sans token.
- Quand l'onglet est ouvert, `afficherNotificationSysteme()` joue aussi `public/notification.wav` via `Audio` et appelle `navigator.vibrate` : les options `sound`/`vibrate` des notifications web ne sont pas normalisées d'un navigateur à l'autre.
- Clic : le service worker ramène l'onglet au premier plan (ou ouvre `/`) et poste le message `codebara-ouvrir-poste` au bundle React.

## Limites à connaître

- Android : intervalle **inexact**, 15 minutes minimum ; le système peut retarder l'exécution pour économiser la batterie.
- iOS : `BGTaskScheduler` choisit lui-même le moment (souvent lors de fenêtres d'activité) ; indisponible sur simulateur, nécessite un appareil physique et un build CNG qui applique le plugin `expo-background-task`.
- Si l'utilisateur **force la fermeture** de l'app (glissement depuis le sélecteur de tâches), le système android/ios peut suspendre les tâches jusqu'au prochain lancement : ce n'est pas contournable avec une notification locale. Une vraie notification push serveur serait nécessaire pour une garantie absolue.
- Web : `periodicSync` reste expérimental et souvent réservé aux PWA installées ; sans lui, le polling ne tourne que lorsque l'onglet est ouvert. Le son de notification dépend du navigateur/système.
- Le marquage `fetched` ne modifie pas `state` : la Poste décide seule du lu/non lu.

## Configuration native

`app.json` déclare le plugin `expo-background-task` et le plugin `expo-notifications` (icône monochrome, couleur `#43a047`, `enableRemoteNotifications: false`). `ios/` et `android/` restent générés par CNG : jamais d'édition manuelle. Le prochain build de l'utilisateur appliquera ces plugins.
