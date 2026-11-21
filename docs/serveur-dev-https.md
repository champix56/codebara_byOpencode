# Serveur de développement HTTPS auto-signé (exigence 2026-11-15)

Le serveur pyCodebara2 de développement est exposé sur
**https://82.65.35.66** (port 443) avec un certificat **auto-signé**
(plateforme de dev — le client web n'en a pas besoin ; il appelle le serveur
par l'URL de `EXPO_PUBLIC_SERVER_URL`, inchangée). Le listener HTTP écoute sur
le port 80.

## Certificat

- `scripts/generer-certificats.sh [domaine]` (défaut `champix.freeboxos.fr`) :
  RSA 4096, 10 ans, SAN domaine seul, `basicConstraints CA:TRUE` (racine **et**
  feuille), `keyUsage` + `extendedKeyUsage serverAuth` — génère :
  - `cert.pem` + `key.pem` **à la racine du projet** → à copier sur le **serveur
    Python** (contexte SSL : `load_cert_chain('cert.pem', 'key.pem')`, port 443) ;
  - `champix-dev.mobileconfig` — profil de confiance **iOS** à installer **une
    fois par appareil de dev** (URLSession exige une racine de confiance au
    niveau système ; une exception ATS ne suffit pas).
- `cert.pem` / `key.pem` / `*.mobileconfig` sont dans `.gitignore` (sensibles,
  jamais versionnés).

## Intégration app — `plugins/certificat-serveur.js` (config plugin, CNG)

Le plugin s'exécute à chaque prebuild (`expo run` / `eas build`) — le plugin lit
`cert.pem` **à ce moment-là**, donc après une régénération, la prochaine build
embarque le nouveau certificat sans rien déplacer :

- **Android** : copie `res/raw/cert_serveur.pem` + `res/xml/network_security_config.xml`
  (le domaine devient ancre de confiance, ancres système conservées, cleartext
  conservé pour le reste du trafic dev) + attribut
  `android:networkSecurityConfig` dans le manifeste. Les appels `fetch` passent
  sur toutes les versions d'Android (modèle NSC inchangé jusqu'à Android 16).
- **iOS** : copie `cert_serveur.cer` dans le bundle (Resources, déclaré dans le
  projet Xcode) + **`NSPinnedDomains`** sur le domaine (épinglage racine,
  iOS 14+). Sans profil `mobileconfig` installé sur l'appareil : la connexion
  reste bloquée par URLSession (contrainte iOS, voulu).
- **Rotation** : régénérer = rebuild native obligatoire (l'ancienne app est
  épinglée à l'ancien certificat — comportement voulu).

## Vérifications en place

- Serveur : `openssl s_client -connect 82.65.35.66:443 -CAfile cert.pem` →
  `Verify return code: 0` (TLS 1.3) ;
  `curl --cacert cert.pem https://82.65.35.66/` → HTTP 200.
- APK : `unzip -l <apk> | grep cert_serveur` — les APK antérieurs au plugin ne
  l'ont pas (TLS bloqué) ; celles construites après le prebuild l'embarquent.

## Notes

- Le serveur écoute en **IPv4 uniquement** (`0.0.0.0`) sur les ports 443/80.
- Le certificat est émis pour l'IP littérale **82.65.35.66** (SAN `IP:82.65.35.66`)
  pour éviter tout problème de résolution DNS côté client mobile (Android). La
  base d'adresse du client est donc `https://82.65.35.66` (`EXPO_PUBLIC_SERVER_URL`),
  modifiable au chargement sur mobile via le champ « Adresse du serveur ».
- Sur Android, le certificat est déclaré comme ancre de confiance à la fois pour
  le domaine `82.65.35.66` et en `base-config` (repli pour le cas où Android ne
  fait pas correspondre une IP littérale à un `domain-config`).
- Le certificat et le plugin natif n'ont **rien** à voir avec le symptôme IPv6 :
  ils sont identiques dans les deux builds (vérifié sur `codEBara.0.0.13.apk`).