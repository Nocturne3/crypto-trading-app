import { useEffect, useRef } from 'react';

/**
 * Custom Hook für Polling (periodische API-Aufrufe)
 * 
 * Dieser Hook führt eine Funktion in regelmäßigen Abständen aus.
 * Nützlich für Live-Updates von Preisen und Analysen.
 * 
 * @param {Function} callback - Funktion die aufgerufen werden soll
 * @param {number} interval - Interval in Millisekunden (z.B. 60000 für 1 Minute)
 * @param {boolean} immediate - Ob Callback sofort ausgeführt werden soll
 * 
 * @example
 * usePolling(() => {
 *   fetchPrices();
 * }, 60000); // Alle 60 Sekunden
 */
export function usePolling(callback, interval = 60000, immediate = true) {
  const callbackRef = useRef(callback);
  const intervalRef = useRef(null);

  // Aktualisiere Callback-Referenz wenn sich Callback ändert
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    // Führe Callback sofort aus wenn gewünscht
    if (immediate) {
      callbackRef.current();
    }

    // Setze Interval
    intervalRef.current = setInterval(() => {
      callbackRef.current();
    }, interval);

    // Cleanup: Stoppe Interval beim Unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [interval, immediate]);
}

