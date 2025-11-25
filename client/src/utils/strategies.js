/**
 * Trading Strategies
 * 
 * Definiert verschiedene Trading-Strategien für Filterung und Empfehlungen
 */

/**
 * Strategy Definitions
 */
export const STRATEGIES = {
  CONSERVATIVE: {
    id: 'conservative',
    name: 'Konservativ',
    description: 'Nur Strong Buy, hoher Score (≥60)',
    icon: '🛡️'
  },
  AGGRESSIVE: {
    id: 'aggressive',
    name: 'Aggressiv',
    description: 'Buy & Strong Buy, mittlerer Score (≥50)',
    icon: '⚡'
  },
  MOMENTUM: {
    id: 'momentum',
    name: 'Momentum',
    description: 'Fokus auf Volumen & positive Änderungen',
    icon: '📈'
  }
};

/**
 * Filter Coin basierend auf Strategy
 * 
 * @param {Object} coin - Coin object mit price, change24h, volume24h
 * @param {Object} analysis - Analysis object mit recommendations
 * @param {string} strategy - Strategy ID ('conservative', 'aggressive', 'momentum')
 * @returns {boolean} true wenn Coin der Strategy entspricht
 */
export function matchesStrategy(coin, analysis, strategy) {
  if (!analysis || !analysis.recommendations) {
    return false;
  }

  const recommendation = analysis.recommendations.recommendation;
  const score = analysis.recommendations.score || 0;

  switch (strategy) {
    case 'conservative':
      // Nur STRONG_BUY mit Score >= 60
      return recommendation === 'STRONG_BUY' && score >= 60;

    case 'aggressive':
      // BUY oder STRONG_BUY mit Score >= 50
      return (recommendation === 'BUY' || recommendation === 'STRONG_BUY') && score >= 50;

    case 'momentum':
      // Fokus auf Volumen und positive Änderungen
      // Mindestens eines der folgenden:
      // - Hohes Volumen (Top 20%) UND positive Änderung
      // - Sehr hohe positive Änderung (>5%)
      // - STRONG_BUY mit hohem Volumen
      const hasHighVolume = coin.volume24h && coin.volume24h > 0; // Will be compared relatively
      const hasPositiveChange = coin.change24h > 0;
      const hasStrongMomentum = coin.change24h > 5;
      const isStrongBuy = recommendation === 'STRONG_BUY' || recommendation === 'BUY';
      
      return (
        (hasPositiveChange && isStrongBuy && score >= 45) ||
        hasStrongMomentum ||
        (hasHighVolume && hasPositiveChange && score >= 50)
      );

    default:
      return true; // Kein Filter
  }
}

/**
 * Sortiere Coins basierend auf Strategy
 * 
 * @param {Array} coins - Array von Coins
 * @param {Object} analyses - Analyses mapping (symbol -> analysis)
 * @param {string} strategy - Strategy ID
 * @returns {Array} Sortiertes Array
 */
export function sortByStrategy(coins, analyses, strategy) {
  const sorted = [...coins];

  switch (strategy) {
    case 'conservative':
      // Sortiere nach Score (höchster zuerst)
      return sorted.sort((a, b) => {
        const scoreA = analyses[a.symbol]?.recommendations?.score || 0;
        const scoreB = analyses[b.symbol]?.recommendations?.score || 0;
        return scoreB - scoreA;
      });

    case 'aggressive':
      // Sortiere nach Score, dann nach Recommendation (STRONG_BUY bevorzugt)
      return sorted.sort((a, b) => {
        const recA = analyses[a.symbol]?.recommendations;
        const recB = analyses[b.symbol]?.recommendations;
        
        if (!recA || !recB) return 0;
        
        const scoreA = recA.score || 0;
        const scoreB = recB.score || 0;
        
        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }
        
        // Bei gleichem Score: STRONG_BUY bevorzugen
        if (recA.recommendation === 'STRONG_BUY' && recB.recommendation !== 'STRONG_BUY') {
          return -1;
        }
        if (recB.recommendation === 'STRONG_BUY' && recA.recommendation !== 'STRONG_BUY') {
          return 1;
        }
        
        return 0;
      });

    case 'momentum':
      // Sortiere nach Volumen * Change (Momentum-Indikator)
      return sorted.sort((a, b) => {
        const momentumA = (a.volume24h || 0) * (a.change24h || 0);
        const momentumB = (b.volume24h || 0) * (b.change24h || 0);
        return momentumB - momentumA;
      });

    default:
      return sorted;
  }
}

/**
 * Filter Coins basierend auf Recommendation Type
 * 
 * @param {Object} coin - Coin object
 * @param {Object} analysis - Analysis object
 * @param {Array} allowedRecommendations - Array von erlaubten Recommendations
 * @returns {boolean}
 */
export function matchesRecommendationFilter(coin, analysis, allowedRecommendations) {
  if (!analysis || !analysis.recommendations) {
    return false;
  }
  
  if (!allowedRecommendations || allowedRecommendations.length === 0) {
    return true; // Kein Filter
  }
  
  return allowedRecommendations.includes(analysis.recommendations.recommendation);
}

/**
 * Filter Coins basierend auf Score Range
 * 
 * @param {Object} coin - Coin object
 * @param {Object} analysis - Analysis object
 * @param {number} minScore - Minimum Score
 * @param {number} maxScore - Maximum Score
 * @returns {boolean}
 */
export function matchesScoreRange(coin, analysis, minScore, maxScore) {
  if (!analysis || !analysis.recommendations) {
    return false;
  }
  
  const score = analysis.recommendations.score || 0;
  
  if (minScore !== null && minScore !== undefined && score < minScore) {
    return false;
  }
  
  if (maxScore !== null && maxScore !== undefined && score > maxScore) {
    return false;
  }
  
  return true;
}

