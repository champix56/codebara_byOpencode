import { router } from 'expo-router';
import { persistor, store } from '../store/store';
import { renouvelerRequestToken, seDeconnecter } from '../store/utilisateur';
import { hacherMotDePasse } from '../utils/hash';

// Client de l'API pyCodebara2 — contrat : 
// docs/integration-client.md (projet /home/champix/projets/pyCodebara2).

// Hôte du serveur : EXPO_PUBLIC_SERVER_URL (valeur posée dans .env) — ex.
// http://10.0.2.2:8080 depuis un
// émulateur Android, http://<IP LAN>:8080 sur un téléphone physique, ou
// http://localhost:8080 sur le web — CORS du serveur : localhost:8081/5173.
const URL_BASE = process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://localhost:8080';
// Timeout des appels simples (contrat §2 : 5–10 s ; POST /card long — non utilisé ici).
const DELAI_APP_MS = 10_000;

// Erreurs distinguées par le reste de l'app :
// - ErreurSession : couple de tokens consommé (« Invalid REQUEST TOKEN ») →
//   la session est morte, re-connexion login/pass requise ;
// - ErreurApi : tout le reste (utilisateur inconnu, réseau, métier...).
export class ErreurSession extends Error {
  constructor() {
    super('Invalid REQUEST TOKEN');
    this.name = 'ErreurSession';
  }
}

export class ErreurApi extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurApi';
  }
}

// ─── Outillage ───────────────────────────────────────────────────────────────

// Le serveur consomme le couple de tokens à chaque appel protégé réussi (§9.1) :
// deux appels parallèles avec le même couple échoueront. Une file sérialise les
// appels protégés de toute l'app.
let fileAppels: Promise<unknown> = Promise.resolve();
function enFile<T>(travail: () => Promise<T>): Promise<T> {
  const resultat = fileAppels.then(travail, travail);
  fileAppels = resultat.catch(() => undefined);
  return resultat;
}

async function lireJson(reponse: Response): Promise<Record<string, unknown>> {
  // Succès = HTTP 200 + corps JSON ; erreur = 400/404 avec {"message": "..."}
  // (§4). Un échec réseau (TypeError fetch) remonte tel quel.
  if (!reponse.ok) {
    const texte = await reponse.text();
    let message = texte;
    try {
      message = (JSON.parse(texte) as { message?: string }).message || texte;
    } catch {
      // Corps non JSON : garder le texte brut.
    }
    if (typeof message !== 'string') {
      // ex. HTTP 500 {"message": null} à la création d'un compte existant
      // (contrat §5.1). La chaîne exacte sert à creerCompte.
      message = 'Erreur serveur inconnue';
    }
    throw new ErreurApi(message);
  }
  return (await reponse.json()) as Record<string, unknown>;
}

async function avecDelai(init: { url: string; method: string; headers: Record<string, string>; body?: string }): Promise<Record<string, unknown>> {
  const controlé = new AbortController();
  const minuteur = setTimeout(() => controlé.abort(), DELAI_APP_MS);
  try {
    const reponse = await fetch(init.url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
      signal: controlé.signal,
    });
    return await lireJson(reponse);
  } catch (erreur) {
    if (erreur instanceof ErreurApi || erreur instanceof ErreurSession) throw erreur;
    throw new ErreurApi(`Serveur injoignable (${URL_BASE})`);
  } finally {
    clearTimeout(minuteur);
  }
}

function texteValeur(source: Record<string, unknown>, cle: string): string {
  return typeof source[cle] === 'string' ? (source[cle] as string) : '';
}

function nombreValeur(source: Record<string, unknown>, cle: string): number | null {
  return typeof source[cle] === 'number' ? (source[cle] as number) : null;
}

type DonneesUtilisateurServeur = {
  id: number;
  nickname: string;
  mail: string;
  amount: number | null;
  hash: string | null;
};

function lireUtilisateur(source: Record<string, unknown>): DonneesUtilisateurServeur {
  if (typeof source.id !== 'number') {
    throw new ErreurApi('Réponse utilisateur inattendue du serveur');
  }
  return {
    id: source.id,
    nickname: texteValeur(source, 'nickname'),
    mail: texteValeur(source, 'mail'),
    amount: nombreValeur(source, 'amount'),
    hash: typeof source.hash === 'string' ? (source.hash as string) : null,
  };
}

// Mort de session (couple de tokens consommé) : remise à zéro de la tranche
// persistée + retour à la connexion, centralisés dans appelProtege — l'écran
// reçoit ErreurSession (navigation déjà enclenchée).
function quitterSession(): void {
  store.dispatch(seDeconnecter());
  persistor.purge();
  router.replace('/login');
}

// ─── Route protégée générique (header `datas` + rotation) ───────────────────

async function appelProtege(
  chemin: string,
  options: { method?: string; corps?: Record<string, unknown>; datasExtra?: Record<string, unknown> } = {},
): Promise<Record<string, unknown>> {
  try {
    return await enFile(async () => {
      const tokens = store.getState().utilisateur;
      if (!tokens.apiToken || !tokens.requestToken) {
        throw new ErreurApi('Aucune session : authentification serveur requise');
      }
      const donnees = await avecDelai({
        url: `${URL_BASE}${chemin}`,
        method: options.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          datas: JSON.stringify({
            API_TOKEN: tokens.apiToken,
            API_REQUEST_TOKEN: tokens.requestToken,
            ...options.datasExtra,
          }),
        },
        body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
      });
      // Rotation sur tout succès de route protégée (§3.3) — jamais sur erreur.
      const nouveauToken = texteValeur(donnees, 'API_REQUEST_TOKEN');
      if (nouveauToken) {
        store.dispatch(renouvelerRequestToken(nouveauToken));
      }
      return donnees;
    });
  } catch (erreur) {
    if (erreur instanceof ErreurApi && estErreurSession(erreur.message)) {
      // Session morte (couple de tokens consommé) : reset persistant de la
      // tranche + retour connexion — centralisé pour toute l'app.
      quitterSession();
      throw new ErreurSession();
    }
    throw erreur;
  }
}

// Reconnaissance d'erreur par sous-chaîne (contrat §4 : jamais la phrase entière).
function estErreurSession(message: unknown): boolean {
  return typeof message === 'string' && message.includes('Invalid REQUEST TOKEN');
}

// ─── Authentification (§5.2 – GET /user/auth, deux modes exclusifs) ─────────

// (a) login/pass : renvoie données utilisateur + les DEUX tokens ré-émis.
export async function authentifierParLogin(
  mailExact: string,
  motDePasseClair: string,
): Promise<DonneesUtilisateurServeur & { apiToken: string; requestToken: string }> {
  const password = await hacherMotDePasse(mailExact, motDePasseClair);
  let donnees: Record<string, unknown>;
  try {
    donnees = await avecDelai({
      url: `${URL_BASE}/user/auth`,
      method: 'GET',
      headers: { datas: JSON.stringify({ mail: mailExact, password }) },
    });
  } catch (erreur) {
    // L'échec login/pass est un 404 générique « Invalid Path/Method… » (§5.2)
    // → « identifiants refusés ». Les autres erreurs (réseau…) remonrent telles.
    const message = (erreur as Error).message;
    if (erreur instanceof ErreurApi && message.includes('Invalid Path/Method')) {
      throw new ErreurApi('Connexion refusée : mail ou mot de passe inconnu');
    }
    throw erreur;
  }
  const apiToken = texteValeur(donnees, 'API_TOKEN');
  const requestToken = texteValeur(donnees, 'API_REQUEST_TOKEN');
  if (!apiToken || !requestToken) {
    throw new ErreurApi('Réponse d’authentification incomplète du serveur');
  }
  return { ...lireUtilisateur(donnees), apiToken, requestToken };
}

// (b) tokens (reprise de session au démarrage) : données utilisateur seulement,
// pas de renouvellement dans cette branche (§5.2b). Renvoie null si le
// couple est refusé (session morte, tokens périmés) — les tokens restent
// utilisables en cas de simple panne réseau (pas de rotation ni
// d'invalidation côté serveur sur erreur).
export async function authentifierParTokens(
  apiToken: string,
  requestToken: string,
): Promise<DonneesUtilisateurServeur | null> {
  try {
    const donnees = await avecDelai({
      url: `${URL_BASE}/user/auth`,
      method: 'GET',
      headers: { datas: JSON.stringify({ API_TOKEN: apiToken, API_REQUEST_TOKEN: requestToken }) },
    });
    return lireUtilisateur(donnees);
  } catch (erreur) {
    if (erreur instanceof ErreurApi && estErreurSession(erreur.message)) {
      // Sur /user/auth le couple refusé est un 404 générique ; toute erreur
      // d'authentification par tokens ⇒ session considérée comme morte.
      return null;
    }
    throw erreur;
  }
}

// ─── Création de compte (§5.1 – POST /user, sans header datas) ──────────────

export async function creerCompte(mailExact: string): Promise<void> {
  try {
    await avecDelai({
      url: `${URL_BASE}/user`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mail: mailExact }),
    });
  } catch (erreur) {
    // Contrat §4 : « métier refusé » → 403 {"message":"Forbidden"}, cas
    // volontairement confondus (mail mal formé / compte déjà existant).
    if (erreur instanceof ErreurApi && erreur.message === 'Forbidden') {
      throw new ErreurApi('Création refusée : vérifie cette adresse (elle est peut-être déjà utilisée)');
    }
    throw erreur;
  }
}

// ─── Mot de passe oublié (§5.9 — POST /user/renew-password, sans tokens) ────

// Nouveau mot de passe aléatoire place en base + envoyé par e-mail. La réponse
// de succès est {"renewed": true} SANS API_REQUEST_TOKEN : aucune rotation à
// déclencher sur cet appel. Échec métier = 403 {"message":"Forbidden"} — mail
// mal formé OU compte inconnu, volontairement indiscernables : côté écran,
// afficher « si ce compte existe, un mail vient d'être envoyé » pour ne pas
// révéler l'existence des comptes. À noter : avec le serveur en DEBUG=True,
// le mail n'est pas envoyé (mot de passe imprimé dans son log).
export async function renouvelerMotDePasse(mailExact: string): Promise<void> {
  await avecDelai({
    url: `${URL_BASE}/user/renew-password`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mail: mailExact }),
  });
}

// ─── Cartes (§5.4 – GET /card : liste de l'utilisateur connecté) ────────────

export type CarteListee = {
  id: number;
  cardHash: string;
  cardpower: number | null;
  health: number | null;
  attack: number | null;
};

export async function listerCartes(): Promise<CarteListee[]> {
  const donnees = await appelProtege('/card');
  const brut = Array.isArray(donnees.cards) ? donnees.cards : [];
  return brut
    .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
    .map((carte) => ({
      id: Number(carte.id),
      cardHash: texteValeur(carte, 'cardHash'),
      cardpower: nombreValeur(carte, 'cardpower'),
      health: nombreValeur(carte, 'health'),
      attack: nombreValeur(carte, 'attack'),
    }));
}
