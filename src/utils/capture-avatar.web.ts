import type { RefObject } from 'react';
import type { ViewInstance } from 'react-native';

// Équivalent web de capture-avatar.ts : on redessine le cadrage dans un
// canvas (clip circulaire) plutôt que d'utiliser react-native-view-shot,
// dont l'implémentation web exige html2canvas-pro et gère mal les SVG.
export async function capturerAvatar(
  _ref: RefObject<ViewInstance | null> | null,
  sourceUri: string,
  zoom: number,
  decalageX: number,
  decalageY: number,
  taille: number,
  tailleCercle: number,
): Promise<string> {
  const image = new Image();
  image.src = sourceUri;
  await new Promise<void>((filtre, remettre) => {
    image.onload = () => filtre();
    image.onerror = () => remettre(new Error('Image d’avatar illisible'));
  });
  const canvas = document.createElement('canvas');
  canvas.width = taille;
  canvas.height = taille;
  const contexte = canvas.getContext('2d');
  if (!contexte) throw new Error('Canvas indisponible pour l’avatar');
  const grandeur = image.naturalWidth;
  const hauteur = image.naturalHeight;
  if (grandeur === 0 || hauteur === 0) throw new Error('Image d’avatar vide');
  // Même géométrie que le SVG de l'éditeur : l'image couvre le carré, zoom
  // centré, puis translation en pixels écran ramenée à la taille finale.
  const rapport = taille / tailleCercle;
  const couverture = Math.max(tailleCercle / grandeur, tailleCercle / hauteur);
  const echelle = couverture * zoom * rapport;
  const largeurDessinee = grandeur * echelle;
  const hauteurDessinee = hauteur * echelle;
  contexte.beginPath();
  contexte.arc(taille / 2, taille / 2, taille / 2, 0, Math.PI * 2);
  contexte.clip();
  contexte.drawImage(
    image,
    taille / 2 + decalageX * rapport - largeurDessinee / 2,
    taille / 2 + decalageY * rapport - hauteurDessinee / 2,
    largeurDessinee,
    hauteurDessinee,
  );
  return canvas.toDataURL('image/png');
}
