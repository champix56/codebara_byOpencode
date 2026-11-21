#!/usr/bin/env bash
#
# Génère (ou régénère) le certificat auto-signé du serveur pyCodebara2 de
# développement exposé en HTTPS (https://<domaine>:50443), et le place partout
# où il est nécessaire :
#
#   1) ./cert.pem + ./key.pem            — à copier sur le serveur Python (root)
#   2) ./champix-dev.mobileconfig        — profil de confiance iOS (à installer
#     une fois par iPhone/iPad de dev : Réglages → profil téléchargé → installer)
#   3) intégration app : le config plugin `plugins/certificat-serveur.js` lit
#     ./cert.pem AU MOMENT DU PREBUILD (eas build / expo run) — aucun fichier
#     natif à déplacer : la prochaine build Android/iOS l'embarque d'elle-même
#     (Android : trust anchor via network_security_config ; iOS : profils +
#     NSPinnedDomains).
#
# Usage : scripts/generer-certificats.sh [domaine]   (défaut : champix.freeboxos.fr)
# Sensible : cert.pem/key.pem sont dans .gitignore — ne jamais les versionner.

set -euo pipefail

DOMAINE="${1:-champix.freeboxos.fr}"

# SAN : DNS: pour un nom de domaine, IP: pour une adresse IP (évite les
# problèmes de résolution DNS côté client mobile, ex. Android).
if [[ "$DOMAINE" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  SAN="IP:${DOMAINE}"
else
  SAN="DNS:${DOMAINE}"
fi
DUREE_JOURS=3650 # 10 ans — plateforme de développement
RACINE="$(cd "$(dirname "$0")/.." && pwd)"

cd "$RACINE"

echo "→ Génération RSA 4096 (${DUREE_JOURS} jours) pour ${DOMAINE}…"
openssl req -x509 -newkey rsa:4096 -sha256 -nodes \
  -days "$DUREE_JOURS" \
  -keyout key.pem -out cert.pem \
  -subj "/CN=${DOMAINE}/O=CodEbara (dev)" \
  -addext "subjectAltName=${SAN}" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,keyCertSign,cRLSign,digitalSignature" \
  -addext "extendedKeyUsage=serverAuth"

# ── Profil de confiance iOS (com.apple.security.root) ────────────────────────
# Le certificat est à la fois racine (CA:TRUE) et feuille (serverAuth) : installé
# comme racine de confiance, il rend le serveur fiable pour URLSession (fetch).
echo "→ Profil iOS champix-dev.mobileconfig…"
openssl x509 -in cert.pem -outform der -out /tmp/cert.der 2>/dev/null
base64 -w 0 /tmp/cert.der > /tmp/cert.b64 2>/dev/null || base64 /tmp/cert.der | tr -d '\n' > /tmp/cert.b64
rm -f /tmp/cert.der
UUID1="$(openssl rand -hex 4)-$(openssl rand -hex 2)-$(openssl rand -hex 2)-$(openssl rand -hex 2)-$(openssl rand -hex 6)"
UUID2="$(openssl rand -hex 4)-$(openssl rand -hex 2)-$(openssl rand -hex 2)-$(openssl rand -hex 2)-$(openssl rand -hex 6)"
cat > champix-dev.mobileconfig <<PROFILE
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadDisplayName</key>
  <string>CodEbara dev — ${DOMAINE}</string>
  <key>PayloadIdentifier</key>
  <string>com.codebara.dev.${UUID1}</string>
  <key>PayloadOrganization</key>
  <string>CodEbara (dev)</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${UUID2}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadDisplayName</key>
      <string>Racine CodEbara dev — ${DOMAINE}</string>
      <key>PayloadIdentifier</key>
      <string>com.codebara.dev.root</string>
      <key>PayloadType</key>
      <string>com.apple.security.root</string>
      <key>PayloadUUID</key>
      <string>${UUID1}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadContent</key>
      <data>$(cat /tmp/cert.b64)</data>
    </dict>
  </array>
</dict>
</plist>
PROFILE
rm -f /tmp/cert.b64

echo
echo "✔ Terminé — fichiers générés à la racine du projet :"
ls -l cert.pem key.pem champix-dev.mobileconfig
echo
echo "Empreinte SHA-256 du certificat :"
openssl x509 -in cert.pem -noout -fingerprint -sha256
echo "Valide jusqu'au :"
openssl x509 -in cert.pem -noout -enddate
echo
echo "↳ Serveur : copier cert.pem + key.pem dans le répertoire du serveur Python."
echo "↳ iOS : envoyer champix-dev.mobileconfig aux appareils de dev et l'installer."
echo "↳ Android/iOS app : rien à faire — la prochaine build embarque cert.pem (plugin)."
