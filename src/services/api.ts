import { remplacer } from '../navigation/navigateur';
import { persistor, store } from '../store/store';
import { renouvelerRequestToken, seDeconnecter } from '../store/utilisateur';
import { hacherMotDePasse } from '../utils/hash';
import { decoderBase64 } from '../utils/base64';
import {
  enregistrerDernierIdUser,
  lireDernierIdUser,
} from '../utils/dernier-utilisateur';

// Client de l'API pyCodebara2 — contrat : 
// docs/integration-client.md (projet /home/champix/projets/pyCodebara2).

// Hôte du serveur : EXPO_PUBLIC_SERVER_URL (valeur posée dans .env) — ex.
// http://10.0.2.2:8080 depuis un
// émulateur Android, http://<IP LAN>:8080 sur un téléphone physique, ou
// http://localhost:8080 sur le web — CORS du serveur : localhost:8081/5173.
// Adresse de base du serveur. Modifiable à l'exécution (champ de connexion sur
// mobile) : on garde une valeur par défaut issue de .env, et une valeur courante
// mutable que les appels API utilisent.
const URL_BASE_DEFAUT = process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://localhost:8080';
let urlBaseCourante = URL_BASE_DEFAUT;

// Renvoie l'adresse de base actuellement utilisée (mobile : celle saisie à la
// connexion ; sinon la valeur de .env).
export function obtenirUrlBase(): string {
  return urlBaseCourante;
}

// Met à jour l'adresse de base utilisée par tous les appels API suivants.
// Vide → retour à la valeur par défaut de .env.
export function definirUrlBase(url: string): void {
  const nettoyee = (url ?? '').trim().replace(/\/+$/, '');
  urlBaseCourante = nettoyee.length > 0 ? nettoyee : URL_BASE_DEFAUT;
}
// Timeout des appels simples (contrat §2 : 5–10 s). La génération de carte
// POST /card est LONGUE (illustration IA synchrone : plusieurs secondes à
// ~1–2 min, §5.3) — timeout dédié bien plus généreux.
const DELAI_APP_MS = 10_000;
const DELAI_GENERATION_MS = 150_000;
// `GET /friend/{iduser}/cards/{idcard}` renvoie un seul .cdz en base64 (≈1,9 Mo)
// et succède à la liste légère `GET /friend/{id}/cards`. Le transfert d'une
// archive peut dépasser le délai standard de 10 s : délai dédié, sans écriture
// locale — cf. maison-visite-ecran.tsx.
const DELAI_CARTE_AMI_MS = 120_000;

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
  // Les routes /friend/* renvoient un API_REQUEST_TOKEN neuf MÊME sur une
  // erreur métier (400/404, §5.12 serveur) : il doit être stocké pour que
  // l'appel suivant ne consomme pas un couple déjà utilisé.
  readonly tokenRotate: string | null;

  // Vrai quand la requête a PU atteindre le serveur et consommer le couple de
  // tokens, mais que la réponse n'a pas pu être lue (timeout, coupure réseau,
  // corps JSON tronqué). Le serveur garde le token précédent en grâce : un
  // unique retry permet alors de récupérer le remplacement au lieu de perdre
  // la session (bug mobile du chargement des maisons d'ami).
  readonly transportIncertain: boolean;

  constructor(
    message: string,
    tokenRotate: string | null = null,
    transportIncertain = false,
  ) {
    super(message);
    this.name = 'ErreurApi';
    this.tokenRotate = tokenRotate;
    this.transportIncertain = transportIncertain;
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
    let corps: Record<string, unknown> | null = null;
    let corpsIllisible = false;
    try {
      const parsed: unknown = JSON.parse(texte);
      if (typeof parsed === 'object' && parsed !== null) {
        corps = parsed as Record<string, unknown>;
      } else {
        corpsIllisible = true;
      }
    } catch {
      // Corps non JSON : garder le texte brut ; le token roté éventuellement
      // renvoyé par le serveur est illisible (cf. transportIncertain).
      corpsIllisible = true;
    }
    let message: string;
    if (typeof corps?.message === 'string') {
      message = corps.message;
    } else if (corps !== null && 'message' in corps) {
      // ex. HTTP 500 {"message": null} à la création d'un compte existant
      // (contrat §5.1). La chaîne exacte sert à creerCompte.
      message = 'Erreur serveur inconnue';
    } else {
      // Corps non JSON : garder le texte brut.
      message = texte;
    }
    const tokenRotate = typeof corps?.API_REQUEST_TOKEN === 'string'
      ? corps.API_REQUEST_TOKEN as string
      : null;
    throw new ErreurApi(message, tokenRotate, corpsIllisible && !tokenRotate);
  }
  return (await reponse.json()) as Record<string, unknown>;
}

async function avecDelai(
  init: { url: string; method: string; headers: Record<string, string>; body?: string },
  timeoutMs: number = DELAI_APP_MS,
): Promise<Record<string, unknown>> {
  const controlé = new AbortController();
  const minuteur = setTimeout(() => controlé.abort(), timeoutMs);
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
    if (erreur instanceof Error && erreur.name === 'AbortError') {
      throw new ErreurApi(
        `Le serveur met trop de temps à répondre (${obtenirUrlBase()}) — réessaie.`,
        null,
        true,
      );
    }
    throw new ErreurApi(`Serveur injoignable (${obtenirUrlBase()})`, null, true);
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

// Mort de session (couple de tokens consommé) ou sortie volontaire (mot de
// passe changé, §5.10 : l'app déconnecte l'utilisateur après un 200) :
// remise à zéro de la tranche persistée + retour à la connexion, centralisés
// ici — l'écran reçoit ensuite son erreur ou se redessine sur la connexion.
export function quitterSession(): void {
  store.dispatch(seDeconnecter());
  persistor.purge();
  // Forcer : la messagerie peut verrouiller la navigation, mais une session
  // morte doit toujours ramener à la connexion.
  remplacer({ nom: 'connexion' }, true);
}

// ─── Route protégée générique (header `datas` + rotation) ───────────────────

async function appelProtege(
  chemin: string,
  options: { method?: string; corps?: Record<string, unknown>; datasExtra?: Record<string, unknown>; timeout?: number } = {},
): Promise<Record<string, unknown>> {
  // Tout le traitement (y compris la rotation et la gestion de session) vit
  // DANS la tâche sérialisée : le token stocké est donc toujours à jour avant
  // que l'appel suivant de la file ne lise le store (utile quand l'onglet Amis
  // enchaîne demandes + amis + cartes).
  return enFile(async () => {
    try {
      const tokens = store.getState().utilisateur;
      if (!tokens.apiToken || !tokens.requestToken) {
        throw new ErreurApi('Aucune session : authentification serveur requise');
      }
      const donnees = await avecDelai(
        {
          url: `${obtenirUrlBase()}${chemin}`,
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
        },
        options.timeout ?? DELAI_APP_MS,
      );
      // Rotation sur tout succès de route protégée (§3.3) — jamais sur erreur.
      const nouveauToken = texteValeur(donnees, 'API_REQUEST_TOKEN');
      if (nouveauToken) {
        store.dispatch(renouvelerRequestToken(nouveauToken));
      }
      return donnees;
    } catch (erreur) {
      if (erreur instanceof ErreurApi && estErreurSession(erreur.message)) {
        // Session morte (couple de tokens consommé) : reset persistant de la
        // tranche + retour connexion — centralisé pour toute l'app.
        quitterSession();
        throw new ErreurSession();
      }
      // Erreur métier /friend/* : le serveur a déjà consommé le couple de tokens
      // et en renvoie un neuf dans le corps (§5.13) — le stocker avant de
      // relancer l'erreur à l'écran. Les autres routes ne le font pas (§3.3).
      if (erreur instanceof ErreurApi && erreur.tokenRotate) {
        store.dispatch(renouvelerRequestToken(erreur.tokenRotate));
      }
      throw erreur;
    }
  });
}

// Reconnaissance d'erreur par sous-chaîne (contrat §4 : jamais la phrase entière).
function estErreurSession(message: unknown): boolean {
  return typeof message === 'string' && message.includes('Invalid REQUEST TOKEN');
}

// Route publique : `GET /notifications` et `PUT /notifications/{id}/fetched`
// acceptent `{"iduser": N}` dans le header `datas` sans token (aucun token
// renvoyé). Un corps sur GET est interdit par le `fetch` de React Native
// (« Body not allowed for GET or HEAD requests »), qui se traduirait par un
// faux « Serveur injoignable ».
type OptionsSansToken = {
  method?: string;
  corps?: Record<string, unknown>;
  iduser?: number | null;
};

async function appelSansToken(
  chemin: string,
  options: OptionsSansToken,
): Promise<Record<string, unknown>> {
  const { method = 'GET', corps, ...donnees } = options;
  const sansCorps = method === 'GET' || method === 'HEAD';
  return avecDelai({
    url: `${obtenirUrlBase()}${chemin}`,
    method,
    headers: { datas: JSON.stringify(donnees) },
    ...(corps && !sansCorps ? { body: JSON.stringify(corps) } : {}),
  });
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
      url: `${obtenirUrlBase()}/user/auth`,
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
  const utilisateur = lireUtilisateur(donnees);
  // Mémoire du dernier joueur connecté, hors tranche Redux purgée à la
  // déconnexion : sert au polling notifications sans session.
  await enregistrerDernierIdUser(utilisateur.id);
  return { ...utilisateur, apiToken, requestToken };
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
      url: `${obtenirUrlBase()}/user/auth`,
      method: 'GET',
      headers: { datas: JSON.stringify({ API_TOKEN: apiToken, API_REQUEST_TOKEN: requestToken }) },
    });
    const utilisateur = lireUtilisateur(donnees);
    await enregistrerDernierIdUser(utilisateur.id);
    return utilisateur;
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
      url: `${obtenirUrlBase()}/user`,
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
    url: `${obtenirUrlBase()}/user/renew-password`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mail: mailExact }),
  });
}

// ─── Mise à jour du profil (§5.10 — PUT /user, tokens requis) ───────────────

// Champs tous optionnels (au moins un requis, sinon le serveur renverrait un
// 400). Le mot de passe est validé et haché ICI (contrat §5.10 : validation
// côté client obligatoire) : le serveur ne reçoit que le hash final
// SHA256(mail_courant + clair) — le mail de session ne change pas par cet
// appel de la mairie, donc mail_final = mail courant. Réponse 200 : profil à
// jour + nouveau API_REQUEST_TOKEN (rotation appliquée par appelProtege).
export async function modifierUtilisateurServeur(
  modifications: { nickname?: string; motDePasseClair?: string },
): Promise<DonneesUtilisateurServeur> {
  if (modifications.nickname === undefined && modifications.motDePasseClair === undefined) {
    throw new ErreurApi('Aucune modification à envoyer');
  }
  const corps: Record<string, unknown> = {};
  if (modifications.nickname !== undefined) {
    corps.nickname = modifications.nickname;
  }
  if (modifications.motDePasseClair !== undefined) {
    const mailSession = store.getState().utilisateur.mail;
    corps.password = await hacherMotDePasse(mailSession, modifications.motDePasseClair);
  }
  const reponse = await appelProtege('/user', { method: 'PUT', corps });
  return lireUtilisateur(reponse);
}

// ─── Recherche d'utilisateurs (§5.12 — GET /users?value=, tokens requis) ────

// État de la relation avec le compte connecté (§5.11 serveur) : pilote le
// bouton d'action de la recherche (« ajouter », « en attente », « ami »).
export type StatutAmi = 'unknown' | 'pending' | 'friend';

// Profil minimal renvoyé par GET /users (le mail ne sert qu'à l'écran « école »).
export type UtilisateurTrouve = {
  id: number;
  nickname: string;
  mail: string;
  friendStatus: StatutAmi;
};

// Garde-fou client : le serveur renvoie déjà les 5 plus pertinents, on tronque
// aussi ici au cas où un ancien serveur renverrait une liste plus longue.
const LIMITE_RECHERCHE_UTILISATEURS = 5;

export const LONGUEUR_MIN_RECHERCHE_UTILISATEUR = 4;

// La query string n'est PAS décodée par le serveur (doc serveur §5.11, client
// §5.12) : on refuse les caractères qui casseraient la requête ou altéreraient
// le préfixe.
export const CARACTERES_INTERDITS_RECHERCHE = /[\s&=%?#+]/u;

export async function rechercherUtilisateurs(value: string): Promise<UtilisateurTrouve[]> {
  const prefixe = value.trim();
  if (prefixe.length < LONGUEUR_MIN_RECHERCHE_UTILISATEUR) {
    throw new ErreurApi('Saisissez au moins 4 caractères pour rechercher un joueur');
  }
  if (CARACTERES_INTERDITS_RECHERCHE.test(prefixe)) {
    throw new ErreurApi('La recherche ne doit contenir ni espace ni caractère spécial (& = % ? # +)');
  }
  // Valeur envoyée telle quelle, sans encodage URL (le serveur ne décode pas).
  const donnees = await appelProtege(`/users?value=${prefixe}`);
  const brut = Array.isArray(donnees.users) ? donnees.users : [];
  return brut
    .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
    .map((utilisateur) => ({
      id: Number(utilisateur.id),
      nickname: texteValeur(utilisateur, 'nickname'),
      mail: texteValeur(utilisateur, 'mail'),
      friendStatus: lireStatutAmi(utilisateur.friendStatus),
    }))
    .filter((utilisateur) => Number.isInteger(utilisateur.id) && utilisateur.id > 0)
    .slice(0, LIMITE_RECHERCHE_UTILISATEURS);
}

function lireStatutAmi(valeur: unknown): StatutAmi {
  return valeur === 'friend' || valeur === 'pending' ? valeur : 'unknown';
}

// ─── Amis (§5.12 serveur — /friend/*, /friends, tokens requis) ──────────────

export type DemandeAmi = {
  id: number;
  nickname: string;
  mail: string;
  daterequest: string | null;
};

export type Ami = {
  id: number;
  nickname: string;
  mail: string;
  cardcount: number;
};

/** Métadonnée d'une carte de la liste `GET /friend/{id}/cards` (sans archive). */
export type CarteAmi = {
  id: number;
  cardHash: string | null;
  cardpower: number | null;
  health: number | null;
  attack: number | null;
};

/** Carte unitaire `GET /friend/{iduser}/cards/{idcard}` : archive incluse. */
export type CarteAmiChargee = CarteAmi & {
  /** .cdz complet en base64 — décodé EN MÉMOIRE, jamais enregistré localement. */
  cardBase64: string;
};

function lireListeAmis(brut: unknown): Ami[] {
  return (Array.isArray(brut) ? brut : [])
    .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
    .map((v) => ({
      id: Number(v.id),
      nickname: texteValeur(v, 'nickname'),
      mail: texteValeur(v, 'mail'),
      cardcount: typeof v.cardcount === 'number' ? v.cardcount : 0,
    }))
    .filter((ami) => Number.isInteger(ami.id) && ami.id > 0);
}

/** Demandes reçues en attente — `GET /friend/requested`. */
export async function listerDemandesAmis(): Promise<DemandeAmi[]> {
  const donnees = await appelProtege('/friend/requested');
  return (Array.isArray(donnees.requests) ? donnees.requests : [])
    .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
    .map((v) => ({
      id: Number(v.id),
      nickname: texteValeur(v, 'nickname'),
      mail: texteValeur(v, 'mail'),
      daterequest: typeof v.daterequest === 'string' ? v.daterequest : null,
    }))
    .filter((demande) => Number.isInteger(demande.id) && demande.id > 0);
}

/** Amis validés — `GET /friends` (liste complète, sans limite ni pagination). */
export async function listerAmis(): Promise<Ami[]> {
  return lireListeAmis((await appelProtege('/friends')).friends);
}

/**
 * Envoie une demande (`POST /friend/request/{id}`). Si la demande inverse est
 * en attente, LE MÊME APPEL vaut acceptation (§5.12) — pas de route /accept.
 */
export async function envoyerDemandeAmi(id: number): Promise<void> {
  await appelProtege(`/friend/request/${id}`, { method: 'POST' });
}

/** Refuse une demande reçue (`DELETE /friend/request/{idDuDemandeur}`). */
export async function refuserDemandeAmi(id: number): Promise<void> {
  await appelProtege(`/friend/request/${id}`, { method: 'DELETE' });
}

/**
 * Liste des cartes d'un ami — `GET /friend/{id}/cards` (lecture seule).
 * Réponse légère : métadonnées seules, sans `.cdz`. Le client enchaîne ensuite
 * les appels `recupererCarteAmi`, un par carte de cette liste.
 */
export async function listerCartesAmi(idAmi: number): Promise<CarteAmi[]> {
  const donnees = await appelProtege(`/friend/${idAmi}/cards`);
  return (Array.isArray(donnees.cards) ? donnees.cards : [])
    .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
    .map((v) => ({
      id: Number(v.id),
      cardHash: typeof v.cardHash === 'string' ? v.cardHash : null,
      cardpower: nombreValeur(v, 'cardpower'),
      health: nombreValeur(v, 'health'),
      attack: nombreValeur(v, 'attack'),
    }))
    .filter((carte) => Number.isInteger(carte.id) && carte.id > 0);
}

/**
 * Une carte de la liste — `GET /friend/{iduser}/cards/{idcard}` (lecture seule).
 * Le serveur vérifie l'amitié validée ET que la carte appartient bien à
 * `idAmi` ; sinon erreur 404 avec token roté (géré par `appelProtege`).
 */
export async function recupererCarteAmi(
  idAmi: number,
  idCarte: number,
): Promise<CarteAmiChargee> {
  const appeler = () => appelProtege(`/friend/${idAmi}/cards/${idCarte}`, {
    timeout: DELAI_CARTE_AMI_MS,
  });
  let donnees: Record<string, unknown>;
  try {
    donnees = await appeler();
  } catch (erreur) {
    // .cdz ≈ 1,9 Mo : sur mobile, le bridge natif peut avorter la lecture du
    // corps APRÈS que le serveur a consommé le couple de tokens et roté. Le
    // client n'a alors pas reçu le remplacement. Le serveur conserve le token
    // précédent en grâce : un seul retry le récupère et évite une fausse
    // déconnexion à la carte suivante (les tentatives sont sérialisées).
    if (!(erreur instanceof ErreurApi) || !erreur.transportIncertain) {
      throw erreur;
    }
    donnees = await appeler();
  }
  const carte = donnees.card;
  if (typeof carte !== 'object' || carte === null) {
    throw new ErreurApi('Réponse carte d’ami inattendue du serveur');
  }
  const source = carte as Record<string, unknown>;
  const cardBase64 = texteValeur(source, 'card');
  if (!cardBase64) {
    throw new ErreurApi('Réponse carte d’ami inattendue du serveur (fichier .cdz absente)');
  }
  return {
    id: nombreValeur(source, 'id') ?? idCarte,
    cardHash: typeof source.cardHash === 'string' ? source.cardHash : null,
    cardpower: nombreValeur(source, 'cardpower'),
    health: nombreValeur(source, 'health'),
    attack: nombreValeur(source, 'attack'),
    cardBase64,
  };
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

// ─── Génération de carte (§5.3 – POST /card, depuis l'usine) ────────────────

// Résultat de la génération : en mode synchrone (actuel) `cardBase64` porte
// l'archive .cdz complète ; en mode asynchrone (à venir, §5.3) elle est
// absente et la carte devra être récupérée plus tard via GET /card/{id}.
export type CarteGeneree = {
  cardid: number;
  checksum: string | null;
  cardBase64: string | null;
};

export async function genererCarte(codeBarres: string): Promise<CarteGeneree> {
  let donnees: Record<string, unknown>;
  try {
    donnees = await appelProtege('/card', {
      method: 'POST',
      corps: { cb: codeBarres },
      timeout: DELAI_GENERATION_MS,
    });
  } catch (erreur) {
    // §9.2 : le serveur d'IA (FastSDCPU) peut ne pas tourner — POST /card
    // renvoie alors un 400 « Invalid Request with body… » masqué. Ce n'est
    // PAS une session morte (ne jamais déconnecter ici) : message dédié.
    const message = (erreur as Error).message;
    if (erreur instanceof ErreurApi && message.includes('Invalid Request with body given')) {
      throw new ErreurApi('Génération indisponible : le serveur d’IA ne répond pas. Réessaie plus tard.');
    }
    throw erreur;
  }
  const cardid = nombreValeur(donnees, 'cardid');
  const card = texteValeur(donnees, 'card');
  if (cardid === null || (card !== '' && card.length === 0)) {
    throw new ErreurApi('Réponse de génération inattendue du serveur');
  }
  // card absent = réponse asynchrone (mode à venir) : l'app s'adapte (l'écran
  // usine annoncera une création sans fichier, à aller chercher plus tard).
  const checksum = texteValeur(donnees, 'checksum');
  return { cardid, checksum: checksum || null, cardBase64: card || null };
}

// ─── Une carte (§5.5 – GET /card/{id}) ──────────────────────────────────────

// Utilisée pour : premier téléchargement après une génération asynchrone,
// re-remplissage du cache, rafraîchissement. `card` est TOUJOURS renvoyé par
// le serveur (pas d'URL de fichier à deviner, §5.5). Le contrôle global se
// fait contre `cardHash` (== checksum de génération, §6.3).
export type CarteTelechargee = {
  id: number;
  cardHash: string | null;
  cardpower: number | null;
  health: number | null;
  attack: number | null;
  cardBase64: string;
};

export async function telechargerCarte(carteId: number): Promise<CarteTelechargee> {
  const donnees = await appelProtege(`/card/${carteId}`);
  const card = texteValeur(donnees, 'card');
  if (!card) {
    throw new ErreurApi('Réponse carte inattendue du serveur (fichier .cdz absente)');
  }
  return {
    id: nombreValeur(donnees, 'id') ?? carteId,
    cardHash: texteValeur(donnees, 'cardHash') || null,
    cardpower: nombreValeur(donnees, 'cardpower'),
    health: nombreValeur(donnees, 'health'),
    attack: nombreValeur(donnees, 'attack'),
    cardBase64: card,
  };
}

// ─── Vérification d'intégrité (§5.6 – GET /card/check) ──────────────────────

// Compare le sha256 du fichier .cdz COMPLET que le client possède avec celui
// enregistré côté serveur (anti-tamper). `cid` et `hash` voyagent dans le
// header `datas` (pas de body, §5.6). Réponse {isChecksumGood, API_REQUEST_TOKEN}
// — la rotation du token est gérée par `appelProtege`.
export async function verifierChecksumCarte(
  carteId: number,
  hash: string,
): Promise<boolean> {
  const donnees = await appelProtege('/card/check', {
    datasExtra: { cid: carteId, hash },
  });
  return donnees.isChecksumGood === true;
}

// ─── Saisons d'affichage (§5.11 – GET /season/check + GET /season) ──────────

// Résultat de /season/check : hash sha256 du .cds de la saison courante
// (sélection serveur selon date actuelle + pays de la demande) — `appseason`
// null (ou hash vide) = aucune saison active → client sur sa saison embarquée.
export type SaisonVerifiee = {
  appseason: number | null;
  hash: string | null;
};

// Compare le hash du .cds LOCAL du client avec la saison courante du serveur.
// `pays` (champ `country` du header datas, ex. "fr-FR") pilote la sélection —
// absent, le serveur retombe sur la saison intl. La rotation du token est
// gérée par appelProtege.
export async function verifierSaison(hash: string, pays: string | null): Promise<SaisonVerifiee> {
  const donnees = await appelProtege('/season/check', {
    datasExtra: { hash, ...(pays ? { country: pays } : {}) },
  });
  return {
    appseason: nombreValeur(donnees, 'appseason'),
    hash: texteValeur(donnees, 'hash') || null,
  };
}

// Télécharge le .cds complet de la saison courante (§5.11, base64 dans la
// réponse — gros paquet : timeout dédié). null = aucune saison active
// (appseason vide, pas de champ season) → le client utilise sa saison
// embarquée dans la build.
export type SaisonTelechargee = {
  appseason: number | null;
  hash: string | null;
  octets: Uint8Array;
};

export async function telechargerSaison(pays: string | null): Promise<SaisonTelechargee | null> {
  const donnees = await appelProtege('/season', {
    datasExtra: pays ? { country: pays } : {},
    timeout: 60_000,
  });
  const season = texteValeur(donnees, 'season');
  if (!season) return null;
  return {
    appseason: nombreValeur(donnees, 'appseason'),
    hash: texteValeur(donnees, 'hash') || null,
    octets: decoderBase64(season),
  };
}

// ─── Renommage (§5.7 – PUT /card/name, depuis l'usine) ──────────────────────

// Réponse : même forme qu'une carte fraîchement mise à jour {cid, card} —
// SANS checksum global : la vérification complète repose sur l'extraction
// interne (signature ZIP + hashs.json, cf. src/utils/cdz.ts). Décision
// produit (2026-11-03) : ZIP uniquement — un tar.xz issu du bug serveur
// §5.7 est refusé (aucun fallback).
export type CarteRenommee = {
  cid: number;
  cardBase64: string;
};

export async function renommerCarte(cid: number, name: string): Promise<CarteRenommee> {
  const donnees = await appelProtege('/card/name', { method: 'PUT', corps: { cid, name } });
  const card = texteValeur(donnees, 'card');
  if (!card) {
    throw new ErreurApi('Réponse de renommage inattendue du serveur (fichier .cdz absente)');
  }
  return { cid: nombreValeur(donnees, 'cid') ?? cid, cardBase64: card };
}

// ─── Messagerie (notifications + cartes en attente de réception) ────────────

export type NotificationServeur = {
  id: number;
  object: string;
  date: string | null;
  type: string;
  state: number;
  /** Déjà présentée en notification système (ne modifie PAS `state`). */
  fetched: boolean;
  cardid: number | null;
  /** Présent sur le détail d'une carte achevée (même contenu que GET /card/{id}). */
  card?: string;
  checksum?: string;
  reception?: { id: number; state: string; cb: string };
};

function lireNotification(source: unknown): NotificationServeur | null {
  if (typeof source !== 'object' || source === null) return null;
  const brute = source as Record<string, unknown>;
  if (typeof brute.id !== 'number') return null;
  const receptionBrute = brute.reception as Record<string, unknown> | undefined;
  return {
    id: brute.id,
    object: texteValeur(brute, 'object'),
    date: texteValeur(brute, 'date') || null,
    type: texteValeur(brute, 'type'),
    state: nombreValeur(brute, 'state') ?? 0,
    fetched: brute.fetched === true || brute.fetched === 1,
    cardid: nombreValeur(brute, 'cardid'),
    card: texteValeur(brute, 'card') || undefined,
    checksum: texteValeur(brute, 'checksum') || undefined,
    reception:
      receptionBrute && typeof receptionBrute.id === 'number'
        ? {
            id: receptionBrute.id,
            state: texteValeur(receptionBrute, 'state'),
            cb: texteValeur(receptionBrute, 'cb'),
          }
        : undefined,
  };
}

// Avec session : les tokens du header désignent le joueur (le corps porte aussi
// `iduser`). Sans session : `iduser` seul dans le corps, aucun token rendu.
export async function listerNotifications(idUser: number | null): Promise<NotificationServeur[]> {
  const connecte = store.getState().utilisateur.apiToken !== null;
  // `iduser` voyage dans le header `datas` (avec les tokens si Session) : jamais
  // de corps sur GET, refusé par React Native et par les navigateurs.
  const donnees = connecte
    ? await appelProtege('/notifications', { datasExtra: { iduser: idUser } })
    : await appelSansToken('/notifications', { iduser: idUser });
  const brut = donnees.notifications;
  if (!Array.isArray(brut)) {
    throw new ErreurApi('Réponse notifications inattendue du serveur');
  }
  return brut.map(lireNotification).filter((n): n is NotificationServeur => n !== null);
}

export async function obtenirNotification(id: number): Promise<NotificationServeur> {
  const donnees = await appelProtege(`/notifications/${id}`);
  const notification = lireNotification(donnees.notification);
  if (!notification) throw new ErreurApi('Réponse notification inattendue du serveur');
  return notification;
}

export async function marquerNotificationLue(id: number): Promise<void> {
  await appelProtege(`/notifications/${id}`, { method: 'PUT' });
}

// Marque la notification comme « déjà présentée » par la notification système.
// Route dédiée : contrairement à `PUT /notifications/{id}`, elle ne touche PAS
// au champ `state` (lu/non lu) que la Poste gère seule à l'ouverture.
// Sans session, le dernier id connecté persistant autorise le même appel.
export async function marquerNotificationFetchee(id: number): Promise<void> {
  const connecte = store.getState().utilisateur.apiToken !== null;
  if (connecte) {
    await appelProtege(`/notifications/${id}/fetched`, { method: 'PUT' });
    return;
  }
  const dernierId = await lireDernierIdUser();
  if (dernierId === null) return;
  await appelSansToken(`/notifications/${id}/fetched`, {
    method: 'PUT',
    iduser: dernierId,
  });
}

// Tâche en arrière-plan : jamais de token, même si une session est hydratée.
// Le header `datas` ne porte que `iduser` : le serveur ne renvoie donc aucun
// nouveau token et ne consomme pas la chaîne de rotation en cours.
export async function listerNotificationsSansToken(
  idUser: number,
): Promise<NotificationServeur[]> {
  const donnees = await appelSansToken('/notifications', { iduser: idUser });
  const brut = donnees.notifications;
  if (!Array.isArray(brut)) {
    throw new ErreurApi('Réponse notifications inattendue du serveur');
  }
  return brut.map(lireNotification).filter((n): n is NotificationServeur => n !== null);
}

export async function marquerNotificationFetcheeSansToken(
  id: number,
  idUser: number,
): Promise<void> {
  await appelSansToken(`/notifications/${id}/fetched`, {
    method: 'PUT',
    iduser: idUser,
  });
}

export async function obtenirCarteEnAttente(
  carteId: number,
): Promise<CarteTelechargee & { reception?: { state: string; cb: string } }> {
  const donnees = await appelProtege(`/awaiting_cards/${carteId}`);
  const card = texteValeur(donnees, 'card');
  if (!card) throw new ErreurApi('Réponse carte en attente inattendue du serveur');
  const reception = donnees.reception as Record<string, unknown> | undefined;
  return {
    id: nombreValeur(donnees, 'id') ?? carteId,
    cardHash: texteValeur(donnees, 'cardHash') || null,
    cardpower: nombreValeur(donnees, 'cardpower'),
    health: nombreValeur(donnees, 'health'),
    attack: nombreValeur(donnees, 'attack'),
    cardBase64: card,
    reception: reception
      ? { state: texteValeur(reception, 'state'), cb: texteValeur(reception, 'cb') }
      : undefined,
  };
}

export type CarteAcceptee = {
  cardid: number;
  cardBase64: string;
  checksum: string | null;
};

export async function accepterCarteEnAttente(
  carteId: number,
  nom?: string,
): Promise<CarteAcceptee> {
  const donnees = await appelProtege(`/awaiting_cards/${carteId}`, {
    method: 'POST',
    corps: nom ? { name: nom } : {},
  });
  const card = texteValeur(donnees, 'card');
  const cardid = nombreValeur(donnees, 'cardid');
  if (!card || cardid === null) {
    throw new ErreurApi('Réponse d’acceptation inattendue du serveur');
  }
  return { cardid, cardBase64: card, checksum: texteValeur(donnees, 'checksum') || null };
}

export async function refuserCarteEnAttente(carteId: number): Promise<void> {
  await appelProtege(`/awaiting_cards/${carteId}`, { method: 'DELETE' });
}
