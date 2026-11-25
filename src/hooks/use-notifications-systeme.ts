import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import {
  authentifierParTokens,
  listerNotifications,
  marquerNotificationFetchee,
} from '../services/api';
import {
  afficherNotificationSysteme,
  enregistrerIdUserServiceWorker,
  installerClicNotification,
  preparerNotificationsSysteme,
} from '../services/notifications-plateforme';
import { enregistrerTacheNotifications } from '../tasks/notifications-background';
import {
  estRetourBloque,
  fenetreCourante,
  naviguer,
  remplacer,
} from '../navigation/navigateur';
import { store } from '../store/store';
import { seConnecter } from '../store/utilisateur';
import {
  enregistrerDernierIdUser,
  lireDernierIdUser,
} from '../utils/dernier-utilisateur';

// Service global de notifications système (mobile + web), monté UNE fois par
// l'application sous PersistGate. Toutes les 30 s tant que l'app est active,
// on interroge GET /notifications ; seules les notifications non encore
// « fetched » côté serveur sont présentées, puis marquées comme telles (sans
// changer leur état lu/non lu dans la Poste). Quand l'app est fermée, le relais
// est pris par la tâche native (src/tasks/) ou le service worker web — toujours
// avec `iduser` seul, jamais avec un token.
const INTERVALLE_INTERROGATION_MS = 30_000;

// Mémoire de session : évite un doublage si le marquage serveur échoue.
const dejaAffichees = new Set<number>();

function applicationActive(): boolean {
  if (Platform.OS === 'web') {
    return typeof document === 'undefined' || document.visibilityState !== 'hidden';
  }
  return AppState.currentState === 'active';
}

function ouvrirFenetrePoste(): void {
  if (fenetreCourante().nom === 'poste') return;
  // Une carte achevée peut verrouiller la navigation : le clic utilisateur sur
  // une notification reste une action explicite, on force donc le remplacement.
  if (estRetourBloque()) {
    remplacer({ nom: 'poste' }, true);
  } else {
    naviguer({ nom: 'poste' });
  }
}

async function traiterClicNotification(): Promise<void> {
  const utilisateur = store.getState().utilisateur;
  if (utilisateur.apiToken !== null && utilisateur.idUser !== null) {
    ouvrirFenetrePoste();
    return;
  }
  // App non connectée : on tente la reprise par tokens persistés. Succès →
  // Poste ; échec → connexion (l'utilisateur doit se connecter).
  if (utilisateur.apiToken && utilisateur.requestToken) {
    try {
      const donnees = await authentifierParTokens(
        utilisateur.apiToken,
        utilisateur.requestToken,
      );
      if (donnees) {
        store.dispatch(
          seConnecter({
            idUser: donnees.id,
            nickname: donnees.nickname,
            mail: donnees.mail,
            amount: donnees.amount,
            hash: donnees.hash,
            apiToken: utilisateur.apiToken,
            requestToken: utilisateur.requestToken,
          }),
        );
        ouvrirFenetrePoste();
        return;
      }
    } catch {
      // Session morte ou serveur injoignable : retour à la connexion.
    }
  }
  remplacer({ nom: 'connexion' }, true);
}

export function useNotificationsSysteme(): void {
  useEffect(() => {
    let monte = true;
    let interrogationEnCours = false;

    void preparerNotificationsSysteme().catch(() => undefined);
    // Mobile : la tâche native survit à la fermeture de l'app. Web : no-op, le
    // service worker enregistre son propre `periodicsync` plus haut.
    void enregistrerTacheNotifications().catch(() => undefined);
    const desinstallerClic = installerClicNotification(() => {
      void traiterClicNotification();
    });

    // Les sessions déjà hydratées au démarrage ont leur id mémorisé ; utile
    // quand le stockage dédié n'existait pas encore (montée de version).
    const idCourant = store.getState().utilisateur.idUser;
    if (idCourant !== null && idCourant > 0) {
      void enregistrerDernierIdUser(idCourant);
    }

    const interroger = async () => {
      if (!monte || interrogationEnCours || !applicationActive()) return;
      interrogationEnCours = true;
      try {
        const utilisateur = store.getState().utilisateur;
        const idUser =
          utilisateur.idUser !== null && utilisateur.idUser > 0
            ? utilisateur.idUser
            : await lireDernierIdUser();
        if (idUser === null) return;
        // Le service worker web mémorise le dernier joueur pour son propre
        // passage en arrière-plan ; aucun token ne lui est confié.
        void enregistrerIdUserServiceWorker(idUser);
        const notifications = await listerNotifications(idUser);
        for (const notification of notifications) {
          if (notification.fetched) continue;
          if (dejaAffichees.has(notification.id)) continue;
          dejaAffichees.add(notification.id);
          const affichee = await afficherNotificationSysteme({
            id: notification.id,
            object: notification.object,
            type: notification.type,
          });
          if (affichee) await marquerNotificationFetchee(notification.id);
          else dejaAffichees.delete(notification.id);
        }
      } catch {
        // Serveur injoignable/session expirée : silence, nouvel essai dans 30 s.
      } finally {
        interrogationEnCours = false;
      }
    };

    void interroger();
    const minuteur = setInterval(() => {
      void interroger();
    }, INTERVALLE_INTERROGATION_MS);
    // Reprise immédiate quand on revient sur l'app (natif) — le timer continue
    // sur web, où `visibilityState` filtre déjà les onglets cachés.
    const abonnementApp =
      Platform.OS === 'web'
        ? null
        : AppState.addEventListener('change', (etat) => {
            if (etat === 'active') void interroger();
          });

    return () => {
      monte = false;
      clearInterval(minuteur);
      abonnementApp?.remove();
      desinstallerClic();
    };
  }, []);
}
