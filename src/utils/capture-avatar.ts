import type { RefObject } from 'react';
import type { ViewInstance } from 'react-native';
import { captureRef } from 'react-native-view-shot';

// Capture du cercle SVG affiché par l'éditeur (natif). Le masque ClipPath
// rend les coins transparents ; view-shot redimensionne directement en PNG
// 150×150 — la taille stockée côté serveur est donc identique sur toutes les
// plateformes. Variante web : capture-avatar.web.ts (canvas, sans view-shot).
export async function capturerAvatar(
  ref: RefObject<ViewInstance | null> | null,
  _sourceUri: string,
  _zoom: number,
  _decalageX: number,
  _decalageY: number,
  taille: number,
  _tailleCercle: number,
): Promise<string> {
  if (!ref?.current) {
    throw new Error('Aperçu d’avatar indisponible');
  }
  return captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'data-uri',
    width: taille,
    height: taille,
  });
}
