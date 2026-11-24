# Serveur HTTPS

Le serveur pyCodebara2 est exposé en HTTPS sur **https://codebara.freeboxos.fr**
(port 443). Le certificat est **public** (Let's Encrypt, SAN
`DNS:codebara.freeboxos.fr`) et renouvelé côté serveur : aucune intervention
dans l'app.

## Côté application

- Aucun certificat embarqué, aucun épinglage, aucun profil iOS : les magasins de
  racines du système suffisent (`fetch` / `URLSession`).
- `EXPO_PUBLIC_SERVER_URL` = `https://codebara.freeboxos.fr` (`.env` et EAS env
  pour les builds). Sur mobile, l'adresse reste modifiable à la connexion.
- **Ne jamais utiliser l'IP littérale** (`https://82.65.35.66`) : le SAN ne
  contient que le nom DNS, Android refuserait le TLS.

## Contrainte DNS : IPv4 seulement

Le serveur et la box écoutent en IPv4 (`0.0.0.0`). Le nom
`codebara.freeboxos.fr` ne doit publier **que l'enregistrement A**
(`82.65.35.66`) : pas d'AAAA.

Un AAAA résiduel (ex. `2a01:e0a:f8e:c830::1`) pointe sur une adresse morte.
Android sur réseau mobile privilégie l'IPv6, n'atteint jamais le serveur et
l'app affiche « Serveur injoignable » alors que le WiFi fonctionne. Le
navigateur masque le problème grâce au Happy Eyeballs.

Vérification :

```bash
dig +short AAAA codebara.freeboxos.fr   # doit être vide
curl -4 -sS -o /dev/null -w '%{http_code}\n' https://codebara.freeboxos.fr/  # 200
```

Si l'AAAA persiste : le retirer dans Freebox OS → Dynamic DNS, puis attendre
l'expiration du TTL ou vider le cache DNS du téléphone.
