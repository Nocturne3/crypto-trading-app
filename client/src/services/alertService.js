/**
 * Alert Service - Enhanced Version
 * 
 * Überwacht Watchlist-Coins im Hintergrund und sendet Notifications bei:
 * - Pullback Alert: RSI fällt unter 50 bei bullischem Trend
 * - Entry Quality Alert: Entry Quality springt auf >60
 * - Signal Upgrade: Status wechselt zu "STRONG_BUY_NOW"
 * - Überhitzungs-Warnung: Neue High-Severity Warnung
 * - Multi-TF Alignment: Alle 3 Timeframes werden bullish
 * 
 * Polling: Alle 5 Minuten im Hintergrund
 */

import { loadWatchlist, loadNotificationSettings, loadPortfolio } from '../utils/storage';

const API_BASE = 'http://localhost:5001/api';

// Speichert den letzten bekannten Status pro Coin
let lastKnownStatus = {};

// Speichert ob Alert bereits gesendet wurde (verhindert Spam)
let sentAlerts = {};

// Polling Interval ID
let pollingInterval = null;

/**
 * Initialisiert den Alert Service
 * Startet Background-Polling für Watchlist-Coins
 * 
 * @param {number} intervalMs - Polling-Intervall in ms (default: 5 Minuten)
 */
export function initAlertService(intervalMs = 5 * 60 * 1000) {
  // Stoppe existierendes Polling
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  // Initialer Check
  checkAllAlerts();

  // Starte Background-Polling
  pollingInterval = setInterval(() => {
    checkAllAlerts();
  }, intervalMs);

  console.log(`🔔 Alert Service gestartet (Intervall: ${intervalMs / 1000}s)`);
}

/**
 * Stoppt den Alert Service
 */
export function stopAlertService() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('🔕 Alert Service gestoppt');
  }
}

/**
 * Prüft alle Alerts für Watchlist und Portfolio
 */
async function checkAllAlerts() {
  const settings = loadNotificationSettings();
  
  // Prüfe ob Notifications aktiviert sind
  if (!settings.enabled) {
    return;
  }

  // Prüfe Browser-Permission
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const watchlist = loadWatchlist();
  const portfolio = loadPortfolio();

  // Kombiniere Watchlist und Portfolio-Symbole (unique)
  const symbolsToCheck = [...new Set([
    ...watchlist,
    ...portfolio.map(p => p.symbol)
  ])];

  // Prüfe jeden Coin
  for (const symbol of symbolsToCheck) {
    try {
      await checkCoinAlerts(symbol, settings, watchlist.includes(symbol), portfolio.some(p => p.symbol === symbol));
    } catch (error) {
      console.warn(`Alert check failed for ${symbol}:`, error.message);
    }
  }
}

/**
 * Prüft Alerts für einen einzelnen Coin
 */
async function checkCoinAlerts(symbol, settings, isInWatchlist, isInPortfolio) {
  // Hole aktuelle Analyse
  const response = await fetch(`${API_BASE}/analysis/${symbol}/4h`);
  if (!response.ok) {
    throw new Error(`Analysis fetch failed: ${response.status}`);
  }
  
  const data = await response.json();
  const rec = data.recommendations;
  
  if (!rec) return;

  const lastStatus = lastKnownStatus[symbol] || {};
  const currentStatus = {
    score: rec.score,
    signalStatus: rec.signalStatus,
    entryQuality: rec.entryQuality,
    rsi: rec.indicators?.rsi,
    warnings: rec.warnings || [],
    recommendation: rec.recommendation
  };

  // 1. Pullback Alert (RSI fällt unter 50 bei bullischem Trend)
  if (settings.signals?.PULLBACK !== false) {
    if (
      lastStatus.rsi && lastStatus.rsi >= 50 && 
      currentStatus.rsi < 50 && 
      currentStatus.score >= 55
    ) {
      sendAlert(symbol, 'PULLBACK', {
        title: `🎯 Pullback erkannt: ${symbol}`,
        body: `RSI auf ${currentStatus.rsi.toFixed(1)} gefallen (Score: ${currentStatus.score}). Guter Einstiegspunkt!`,
        tag: `pullback-${symbol}`
      });
    }
  }

  // 2. Entry Quality Alert (springt auf >60)
  if (settings.signals?.ENTRY_QUALITY !== false) {
    if (
      (!lastStatus.entryQuality || lastStatus.entryQuality < 60) && 
      currentStatus.entryQuality >= 60 &&
      currentStatus.score >= 55
    ) {
      sendAlert(symbol, 'ENTRY_QUALITY', {
        title: `✅ Guter Einstieg: ${symbol}`,
        body: `Entry Quality auf ${currentStatus.entryQuality.toFixed(1)} gestiegen. Jetzt könnte ein guter Zeitpunkt sein!`,
        tag: `entry-${symbol}`
      });
    }
  }

  // 3. Signal Upgrade zu STRONG_BUY_NOW
  if (settings.signals?.STRONG_BUY !== false) {
    if (
      lastStatus.signalStatus !== 'STRONG_BUY_NOW' && 
      currentStatus.signalStatus === 'STRONG_BUY_NOW'
    ) {
      sendAlert(symbol, 'STRONG_BUY_NOW', {
        title: `🚀 Jetzt kaufen: ${symbol}`,
        body: `Signal Status: STRONG BUY NOW! Score: ${currentStatus.score}, Entry Quality: ${currentStatus.entryQuality.toFixed(1)}`,
        tag: `strongbuy-${symbol}`
      });
    }
  }

  // 4. Überhitzungs-Warnung (neue High-Severity Warnung)
  if (settings.signals?.OVERHEAT !== false) {
    const lastHighWarnings = (lastStatus.warnings || []).filter(w => w.severity === 'HIGH').map(w => w.type);
    const currentHighWarnings = currentStatus.warnings.filter(w => w.severity === 'HIGH');
    
    const newHighWarnings = currentHighWarnings.filter(w => !lastHighWarnings.includes(w.type));
    
    if (newHighWarnings.length > 0 && isInWatchlist) {
      sendAlert(symbol, 'OVERHEAT', {
        title: `⚠️ Überhitzung: ${symbol}`,
        body: newHighWarnings.map(w => w.message).join('. '),
        tag: `overheat-${symbol}`
      });
    }
  }

  // 5. Signal Downgrade (für Portfolio-Coins)
  if (isInPortfolio && settings.portfolioSellAlerts) {
    if (
      lastStatus.recommendation && 
      ['STRONG_BUY', 'BUY'].includes(lastStatus.recommendation) &&
      ['SELL', 'STRONG_SELL'].includes(currentStatus.recommendation)
    ) {
      sendAlert(symbol, 'PORTFOLIO_SELL', {
        title: `📉 Verkaufssignal: ${symbol}`,
        body: `Signal hat sich von ${lastStatus.recommendation} zu ${currentStatus.recommendation} geändert. Prüfe dein Portfolio!`,
        tag: `sell-${symbol}`
      });
    }
  }

  // Status speichern für nächsten Vergleich
  lastKnownStatus[symbol] = currentStatus;
}

/**
 * Prüft Multi-Timeframe Alignment für einen Coin
 */
async function checkMultiTimeframeAlignment(symbol, settings) {
  if (settings.signals?.MULTI_TF_ALIGNMENT === false) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/multi-timeframe/${symbol}`);
    if (!response.ok) return;
    
    const data = await response.json();
    
    const lastMtf = lastKnownStatus[`${symbol}_mtf`];
    const currentAllBullish = data.summary?.allStrongBuy || data.summary?.allBullish;
    
    // Alert wenn alle Timeframes neu aligned sind
    if (!lastMtf?.allBullish && currentAllBullish) {
      sendAlert(symbol, 'MULTI_TF', {
        title: `📊 Multi-TF Alignment: ${symbol}`,
        body: `Alle Timeframes (1h, 4h, 1d) sind jetzt bullish! Confidence: ${data.summary?.confidence}`,
        tag: `mtf-${symbol}`
      });
    }
    
    lastKnownStatus[`${symbol}_mtf`] = {
      allBullish: currentAllBullish
    };
  } catch (error) {
    console.warn(`Multi-TF check failed for ${symbol}:`, error.message);
  }
}

/**
 * Sendet eine Browser-Notification
 */
function sendAlert(symbol, type, options) {
  const alertKey = `${symbol}-${type}`;
  const now = Date.now();
  
  // Verhindere Alert-Spam (mindestens 30 Minuten zwischen gleichen Alerts)
  if (sentAlerts[alertKey] && now - sentAlerts[alertKey] < 30 * 60 * 1000) {
    return;
  }
  
  try {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: '/favicon.ico',
      tag: options.tag,
      requireInteraction: type === 'STRONG_BUY_NOW' || type === 'PORTFOLIO_SELL',
      silent: false
    });
    
    // Klick-Handler: Öffne App und navigiere zum Coin
    notification.onclick = () => {
      window.focus();
      // Dispatch custom event für Navigation
      window.dispatchEvent(new CustomEvent('alert-click', { 
        detail: { symbol, type } 
      }));
    };
    
    sentAlerts[alertKey] = now;
    console.log(`🔔 Alert gesendet: ${options.title}`);
  } catch (error) {
    console.error('Notification failed:', error);
  }
}

/**
 * Manueller Check für einen einzelnen Coin
 * Kann vom UI aufgerufen werden
 */
export async function checkCoinNow(symbol) {
  const settings = loadNotificationSettings();
  const watchlist = loadWatchlist();
  const portfolio = loadPortfolio();
  
  await checkCoinAlerts(
    symbol, 
    settings, 
    watchlist.includes(symbol), 
    portfolio.some(p => p.symbol === symbol)
  );
  
  await checkMultiTimeframeAlignment(symbol, settings);
}

/**
 * Setzt den Alert-Status zurück (z.B. nach manuellem Reset)
 */
export function resetAlertStatus(symbol) {
  delete lastKnownStatus[symbol];
  delete lastKnownStatus[`${symbol}_mtf`];
  
  // Lösche gesendete Alerts für diesen Coin
  Object.keys(sentAlerts).forEach(key => {
    if (key.startsWith(symbol)) {
      delete sentAlerts[key];
    }
  });
}

/**
 * Gibt den aktuellen Status aller überwachten Coins zurück
 */
export function getAlertStatus() {
  return {
    isRunning: pollingInterval !== null,
    watchedCoins: Object.keys(lastKnownStatus).filter(k => !k.includes('_mtf')),
    lastKnownStatus,
    sentAlerts
  };
}

export default {
  initAlertService,
  stopAlertService,
  checkCoinNow,
  resetAlertStatus,
  getAlertStatus
};
