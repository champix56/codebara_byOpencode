import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import type { AppDispatch, EtatRacine } from './store';

// Hooks Redux typés : à utiliser partout à la place de useDispatch/useSelector.
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<EtatRacine> = useSelector;
