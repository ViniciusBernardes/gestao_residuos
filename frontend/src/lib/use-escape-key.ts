import { useEffect } from 'react';

/** Chama `onEscape` quando Escape é pressionado e `active` é true (ex.: modal aberto). */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    function onDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onEscape();
    }
    document.addEventListener('keydown', onDown);
    return () => document.removeEventListener('keydown', onDown);
  }, [active, onEscape]);
}
