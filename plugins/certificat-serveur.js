// Config plugin « certificat serveur de développement » (exigence 2026-11-15).
//
// Le serveur pyCodebara2 de développement est exposé en HTTPS sur
// https://champix.freeboxos.fr:50443 avec un certificat AUTO-SIGNÉ (RSA 4096,
// 10 ans, cf. scripts/generer-certificats.sh — cert.pem/key.pem à la racine du
// projet). Ce plugin embarque le certificat dans les builds natives pour que
// les appels HTTPS ne soient pas bloqués :
//
//  Android : cert.pem copié dans res/raw/cert_serveur.pem et déclaré comme
//    ANCRE DE CONFIANCE pour le domaine (res/xml/network_security_config.xml +
//    attribut android:networkSecurityConfig dans le manifeste). Le reste du
//    trafic garde le comportement dev (cleartext autorisé, ancres système).
//  iOS : cert.pem copié dans le bundle (Resources, cert_serveur.cer) +
//    NSPinnedDomains sur le domaine (épinglage au certificat racine). Le
//    certificat doit AUSSI être installé comme profil de confiance sur les
//    appareils de dev (champix-dev.mobileconfig — URLSession système exige une
//    racine de confiance, impossible à déclarer depuis un plist seul).
//
// CNG : le plugin s'exécute à chaque prebuild (expo run / eas build) — après
// une régénération du certificat, la prochaine build l'embarque, rien à
// déplacer à la main.
const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
  IOSConfig,
} = require('expo/config-plugins');

// Hôte du serveur de développement (émettre/régénérer avec le même). IP littérale
// pour éviter tout problème de résolution DNS côté client mobile (Android).
const DOMAINE = '82.65.35.66';
// Nom de ressource Android (aapt2 : [a-z0-9_] uniquement).
const RESSOURCE = 'cert_serveur';

// cert.pem à la racine du projet — généré par scripts/generer-certificats.sh.
function lireCertificat(racineProjet) {
  const source = path.join(racineProjet, 'cert.pem');
  if (!fs.existsSync(source)) {
    throw new Error(
      'cert.pem absent à la racine du projet — lance `scripts/generer-certificats.sh` avant de builder.',
    );
  }
  return fs.readFileSync(source);
}

// ─── Android : ancre de confiance réseau ─────────────────────────────────────
const avecAndroid = (config) => {
  config = withAndroidManifest(config, (c) => {
    const application = c.modResults.manifest.application[0].$;
    application['android:networkSecurityConfig'] = '@xml/network_security_config';
    return c;
  });
  config = withDangerousMod(config, [
    'android',
    (c) => {
      const certificat = lireCertificat(c.modRequest.projectRoot);
      const natif = c.modRequest.platformProjectRoot; // <projet>/android
      const rawDir = path.join(natif, 'app/src/main/res/raw');
      const xmlDir = path.join(natif, 'app/src/main/res/xml');
      fs.mkdirSync(rawDir, { recursive: true });
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(rawDir, `${RESSOURCE}.pem`), certificat);
      fs.writeFileSync(
        path.join(xmlDir, 'network_security_config.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<!-- Serveur de développement auto-signé (cf. plugins/certificat-serveur.js) -->
<network-security-config>
    <!-- Hôte dev (${DOMAINE}) : notre certificat est ancre de confiance. -->
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="false">${DOMAINE}</domain>
        <trust-anchors>
            <certificates src="@raw/${RESSOURCE}" />
            <certificates src="system" />
        </trust-anchors>
    </domain-config>
    <!-- Repli : comportement dev conservé pour le reste du trafic. Notre certificat
         est aussi ancre de confiance pour couvrir le cas où l'hôte est une IP
         littérale (Android ne fait pas toujours correspondre une IP à un
         domain-config). -->
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="@raw/${RESSOURCE}" />
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`,
      );
      return c;
    },
  ]);
  return config;
};

// ─── iOS : certificat dans le bundle + épinglage ─────────────────────────────
const avecIos = (config) => {
  config = withInfoPlist(config, (c) => {
    // Épinglage du domaine au certificat racine embarqué/installé (iOS 14+).
    // Nécessite le profil champix-dev.mobileconfig installé sur l'appareil
    // (URLSession ne fait confiance à une racine auto-signée que si elle est
    // déclarée au niveau système).
    c.modResults.NSPinnedDomains = {
      [DOMAINE]: {
        NSIncludesSubdomains: false,
        NSPinnedCA: true,
      },
    };
    return c;
  });
  config = withDangerousMod(config, [
    'ios',
    (c) => {
      const certificat = lireCertificat(c.modRequest.projectRoot);
      const dossierApp = IOSConfig.Paths.getSourceRoot(c.modRequest.projectRoot);
      fs.writeFileSync(path.join(dossierApp, `${RESSOURCE}.cer`), certificat);
      return c;
    },
  ]);
  config = withXcodeProject(config, (c) => {
    const projet = c.modResults;
    const dossierApp = IOSConfig.Paths.getSourceRoot(c.modRequest.projectRoot);
    IOSConfig.XcodeUtils.ensureGroupRecursively(projet, 'Resources');
    IOSConfig.XcodeUtils.addResourceFileToGroup({
      filepath: path.relative(c.modRequest.platformProjectRoot, path.join(dossierApp, `${RESSOURCE}.cer`)),
      groupName: 'Resources',
      project: projet,
      isBuildFile: true,
      verbose: false,
    });
    return c;
  });
  return config;
};

module.exports = (config) => {
  config = avecAndroid(config);
  config = avecIos(config);
  return config;
};
