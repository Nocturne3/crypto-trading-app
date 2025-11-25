import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadTradeHistory,
  saveTradeHistory,
  addTradeToHistory,
  removeTradeFromHistory,
  loadPortfolioSnapshots,
  savePortfolioSnapshot,
  calculateTradeStatistics
} from '../../utils/tradeHistory';

describe('tradeHistory utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('loadTradeHistory', () => {
    it('should return empty array when no history exists', () => {
      const history = loadTradeHistory();
      expect(history).toEqual([]);
    });

    it('should load existing trade history from localStorage', () => {
      const mockHistory = [
        {
          id: 'trade-1',
          type: 'BUY',
          symbol: 'BTC',
          amount: 0.1,
          price: 50000,
          totalValue: 5000,
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      ];
      localStorage.setItem('crypto_trade_history', JSON.stringify(mockHistory));
      
      const history = loadTradeHistory();
      expect(history).toEqual(mockHistory);
    });

    it('should return empty array on parse error', () => {
      localStorage.setItem('crypto_trade_history', 'invalid json');
      const history = loadTradeHistory();
      expect(history).toEqual([]);
    });
  });

  describe('saveTradeHistory', () => {
    it('should save trade history to localStorage', () => {
      const mockHistory = [
        {
          id: 'trade-1',
          type: 'BUY',
          symbol: 'BTC',
          amount: 0.1,
          price: 50000,
          totalValue: 5000,
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      ];
      
      saveTradeHistory(mockHistory);
      const stored = JSON.parse(localStorage.getItem('crypto_trade_history'));
      expect(stored).toEqual(mockHistory);
    });
  });

  describe('addTradeToHistory', () => {
    it('should add a new trade to history', () => {
      const trade = {
        type: 'BUY',
        symbol: 'BTC',
        amount: 0.1,
        price: 50000,
        totalValue: 5000
      };

      const history = addTradeToHistory(trade);
      
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        type: 'BUY',
        symbol: 'BTC',
        amount: 0.1,
        price: 50000,
        totalValue: 5000
      });
      expect(history[0].id).toBeDefined();
      expect(history[0].timestamp).toBeDefined();
    });

    it('should sort trades by timestamp (newest first)', () => {
      const trade1 = {
        type: 'BUY',
        symbol: 'BTC',
        amount: 0.1,
        price: 50000,
        totalValue: 5000,
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const trade2 = {
        type: 'SELL',
        symbol: 'BTC',
        amount: 0.1,
        price: 55000,
        totalValue: 5500,
        timestamp: '2024-01-02T00:00:00.000Z'
      };

      addTradeToHistory(trade1);
      addTradeToHistory(trade2);

      const history = loadTradeHistory();
      expect(history).toHaveLength(2);
      expect(history[0].timestamp).toBe('2024-01-02T00:00:00.000Z');
      expect(history[1].timestamp).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should use provided timestamp if given', () => {
      const trade = {
        type: 'BUY',
        symbol: 'BTC',
        amount: 0.1,
        price: 50000,
        totalValue: 5000,
        timestamp: '2024-01-01T12:00:00.000Z'
      };

      const history = addTradeToHistory(trade);
      expect(history[0].timestamp).toBe('2024-01-01T12:00:00.000Z');
    });
  });

  describe('removeTradeFromHistory', () => {
    it('should remove trade by id', () => {
      const trade1 = {
        type: 'BUY',
        symbol: 'BTC',
        amount: 0.1,
        price: 50000,
        totalValue: 5000
      };

      const trade2 = {
        type: 'SELL',
        symbol: 'ETH',
        amount: 1,
        price: 3000,
        totalValue: 3000
      };

      const history1 = addTradeToHistory(trade1);
      const history2 = addTradeToHistory(trade2);

      const tradeId = history1[0].id;
      const updatedHistory = removeTradeFromHistory(tradeId);

      expect(updatedHistory).toHaveLength(1);
      expect(updatedHistory[0].symbol).toBe('ETH');
    });

    it('should return empty array when removing last trade', () => {
      const trade = {
        type: 'BUY',
        symbol: 'BTC',
        amount: 0.1,
        price: 50000,
        totalValue: 5000
      };

      const history = addTradeToHistory(trade);
      const tradeId = history[0].id;
      const updatedHistory = removeTradeFromHistory(tradeId);

      expect(updatedHistory).toEqual([]);
    });
  });

  describe('loadPortfolioSnapshots', () => {
    it('should return empty array when no snapshots exist', () => {
      const snapshots = loadPortfolioSnapshots();
      expect(snapshots).toEqual([]);
    });

    it('should load existing snapshots from localStorage', () => {
      const mockSnapshots = [
        {
          timestamp: '2024-01-01T00:00:00.000Z',
          totalValue: 10000,
          totalCost: 9000,
          totalProfit: 1000,
          totalProfitPercent: 11.11
        }
      ];
      localStorage.setItem('crypto_portfolio_snapshots', JSON.stringify(mockSnapshots));
      
      const snapshots = loadPortfolioSnapshots();
      expect(snapshots).toEqual(mockSnapshots);
    });
  });

  describe('savePortfolioSnapshot', () => {
    it('should save a new snapshot', () => {
      const snapshot = {
        totalValue: 10000,
        totalCost: 9000,
        totalProfit: 1000,
        totalProfitPercent: 11.11
      };

      savePortfolioSnapshot(snapshot);
      const snapshots = loadPortfolioSnapshots();
      
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]).toMatchObject(snapshot);
      expect(snapshots[0].timestamp).toBeDefined();
    });

    it('should limit snapshots to 1000', () => {
      for (let i = 0; i < 1001; i++) {
        savePortfolioSnapshot({
          totalValue: 10000 + i,
          totalCost: 9000,
          totalProfit: 1000,
          totalProfitPercent: 11.11
        });
      }

      const snapshots = loadPortfolioSnapshots();
      expect(snapshots).toHaveLength(1000);
    });

    it('should sort snapshots by timestamp', () => {
      const snapshot1 = {
        totalValue: 10000,
        totalCost: 9000,
        totalProfit: 1000,
        totalProfitPercent: 11.11,
        timestamp: '2024-01-02T00:00:00.000Z'
      };

      const snapshot2 = {
        totalValue: 11000,
        totalCost: 9000,
        totalProfit: 2000,
        totalProfitPercent: 22.22,
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      savePortfolioSnapshot(snapshot1);
      savePortfolioSnapshot(snapshot2);

      const snapshots = loadPortfolioSnapshots();
      expect(snapshots[0].timestamp).toBe('2024-01-01T00:00:00.000Z');
      expect(snapshots[1].timestamp).toBe('2024-01-02T00:00:00.000Z');
    });
  });

  describe('calculateTradeStatistics', () => {
    it('should return zero statistics for empty history', () => {
      const stats = calculateTradeStatistics([]);
      
      expect(stats.totalTrades).toBe(0);
      expect(stats.completedTrades).toBe(0);
      expect(stats.winRate).toBe(0);
      expect(stats.totalProfit).toBe(0);
      expect(stats.avgProfit).toBe(0);
    });

    it('should calculate statistics for completed trades', () => {
      const buyTrade = {
        id: 'trade-1',
        type: 'BUY',
        symbol: 'BTC',
        amount: 0.1,
        price: 50000,
        totalValue: 5000,
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const sellTrade = {
        id: 'trade-2',
        type: 'SELL',
        symbol: 'BTC',
        amount: 0.1,
        price: 55000,
        totalValue: 5500,
        timestamp: '2024-01-02T00:00:00.000Z'
      };

      const history = [buyTrade, sellTrade];
      const stats = calculateTradeStatistics(history);

      expect(stats.totalTrades).toBe(2);
      expect(stats.completedTrades).toBe(1);
      expect(stats.winningTrades).toBe(1);
      expect(stats.losingTrades).toBe(0);
      expect(stats.winRate).toBe(100);
      expect(stats.totalProfit).toBe(500); // (55000 - 50000) * 0.1
      expect(stats.avgProfit).toBe(500);
    });

    it('should handle losing trades', () => {
      const buyTrade = {
        id: 'trade-1',
        type: 'BUY',
        symbol: 'BTC',
        amount: 0.1,
        price: 50000,
        totalValue: 5000,
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const sellTrade = {
        id: 'trade-2',
        type: 'SELL',
        symbol: 'BTC',
        amount: 0.1,
        price: 45000,
        totalValue: 4500,
        timestamp: '2024-01-02T00:00:00.000Z'
      };

      const history = [buyTrade, sellTrade];
      const stats = calculateTradeStatistics(history);

      expect(stats.completedTrades).toBe(1);
      expect(stats.winningTrades).toBe(0);
      expect(stats.losingTrades).toBe(1);
      expect(stats.winRate).toBe(0);
      expect(stats.totalProfit).toBe(-500); // (45000 - 50000) * 0.1
    });

    it('should identify best and worst trades', () => {
      const trades = [
        {
          id: 'trade-1',
          type: 'BUY',
          symbol: 'BTC',
          amount: 0.1,
          price: 50000,
          totalValue: 5000,
          timestamp: '2024-01-01T00:00:00.000Z'
        },
        {
          id: 'trade-2',
          type: 'SELL',
          symbol: 'BTC',
          amount: 0.1,
          price: 60000,
          totalValue: 6000,
          timestamp: '2024-01-02T00:00:00.000Z'
        },
        {
          id: 'trade-3',
          type: 'BUY',
          symbol: 'ETH',
          amount: 1,
          price: 3000,
          totalValue: 3000,
          timestamp: '2024-01-03T00:00:00.000Z'
        },
        {
          id: 'trade-4',
          type: 'SELL',
          symbol: 'ETH',
          amount: 1,
          price: 2500,
          totalValue: 2500,
          timestamp: '2024-01-04T00:00:00.000Z'
        }
      ];

      const stats = calculateTradeStatistics(trades);

      expect(stats.bestTrade).toBeDefined();
      expect(stats.bestTrade.symbol).toBe('BTC');
      expect(stats.bestTrade.profit).toBe(1000); // (60000 - 50000) * 0.1

      expect(stats.worstTrade).toBeDefined();
      expect(stats.worstTrade.symbol).toBe('ETH');
      expect(stats.worstTrade.profit).toBe(-500); // (2500 - 3000) * 1
    });

    it('should handle open positions (unmatched BUY trades)', () => {
      const buyTrade = {
        id: 'trade-1',
        type: 'BUY',
        symbol: 'BTC',
        amount: 0.1,
        price: 50000,
        totalValue: 5000,
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const stats = calculateTradeStatistics([buyTrade]);

      expect(stats.totalTrades).toBe(1);
      expect(stats.completedTrades).toBe(0);
      expect(stats.openPositions).toBe(1);
    });

    it('should use FIFO matching for SELL trades', () => {
      const trades = [
        {
          id: 'trade-1',
          type: 'BUY',
          symbol: 'BTC',
          amount: 0.1,
          price: 50000,
          totalValue: 5000,
          timestamp: '2024-01-01T00:00:00.000Z'
        },
        {
          id: 'trade-2',
          type: 'BUY',
          symbol: 'BTC',
          amount: 0.1,
          price: 55000,
          totalValue: 5500,
          timestamp: '2024-01-02T00:00:00.000Z'
        },
        {
          id: 'trade-3',
          type: 'SELL',
          symbol: 'BTC',
          amount: 0.1,
          price: 60000,
          totalValue: 6000,
          timestamp: '2024-01-03T00:00:00.000Z'
        }
      ];

      const stats = calculateTradeStatistics(trades);

      expect(stats.completedTrades).toBe(1);
      // Should match with first BUY (50000)
      expect(stats.totalProfit).toBe(1000); // (60000 - 50000) * 0.1
      expect(stats.openPositions).toBe(1); // One BUY still unmatched
    });
  });
});

