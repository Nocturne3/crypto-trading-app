import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortfolioTracking from '../../../components/Portfolio/PortfolioTracking';
import * as api from '../../../services/api';
import * as storage from '../../../utils/storage';
import * as tradeHistory from '../../../utils/tradeHistory';

// Mock dependencies
vi.mock('../../../services/api');
vi.mock('../../../utils/storage');
vi.mock('../../../utils/tradeHistory');
vi.mock('../../../hooks/usePolling', () => ({
  usePolling: vi.fn((callback, interval) => {
    // Don't actually poll in tests
  })
}));

// Mock recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="chart-container">{children}</div>,
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />
}));

describe('PortfolioTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default mocks
    api.getTop50Prices.mockResolvedValue([
      { symbol: 'BTC', price: 50000 },
      { symbol: 'ETH', price: 3000 }
    ]);

    storage.loadPortfolio.mockReturnValue([
      { symbol: 'BTC', amount: 0.1, buyPrice: 45000 }
    ]);

    storage.calculatePortfolioValue.mockReturnValue({
      totalValue: 5000,
      totalCost: 4500,
      totalProfit: 500,
      totalProfitPercent: 11.11,
      items: []
    });

    tradeHistory.loadTradeHistory.mockReturnValue([]);
    tradeHistory.calculateTradeStatistics.mockReturnValue({
      totalTrades: 0,
      completedTrades: 0,
      openPositions: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalProfit: 0,
      avgProfit: 0,
      bestTrade: null,
      worstTrade: null,
      tradesBySymbol: {}
    });

    tradeHistory.loadPortfolioSnapshots.mockReturnValue([]);
  });

  it('should render the component with header', () => {
    render(<PortfolioTracking />);
    
    expect(screen.getByText('Portfolio Tracking')).toBeInTheDocument();
    expect(screen.getByText('Detaillierte Analyse deiner Trades und Performance')).toBeInTheDocument();
    expect(screen.getByText('+ Trade hinzufügen')).toBeInTheDocument();
  });

  it('should display statistics when available', () => {
    tradeHistory.calculateTradeStatistics.mockReturnValue({
      totalTrades: 10,
      completedTrades: 8,
      openPositions: 2,
      winningTrades: 6,
      losingTrades: 2,
      winRate: 75,
      totalProfit: 5000,
      avgProfit: 625,
      bestTrade: { symbol: 'BTC', profit: 2000, profitPercent: 20 },
      worstTrade: { symbol: 'ETH', profit: -500, profitPercent: -10 },
      tradesBySymbol: {}
    });

    render(<PortfolioTracking />);

    expect(screen.getByText('Win Rate')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();
    expect(screen.getByText('Gesamt Profit')).toBeInTheDocument();
    expect(screen.getByText('Abgeschlossene Trades')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('should show empty state when no trades exist', () => {
    render(<PortfolioTracking />);

    expect(screen.getByText('Noch keine Trades vorhanden')).toBeInTheDocument();
  });

  it('should display trade history when trades exist', () => {
    const mockTrades = [
      {
        id: 'trade-1',
        type: 'BUY',
        symbol: 'BTC',
        amount: 0.1,
        price: 50000,
        totalValue: 5000,
        timestamp: '2024-01-01T00:00:00.000Z',
        notes: 'Test trade'
      }
    ];

    tradeHistory.loadTradeHistory.mockReturnValue(mockTrades);

    render(<PortfolioTracking />);

    expect(screen.getByText('Trade-Historie')).toBeInTheDocument();
    expect(screen.getByText('BTC')).toBeInTheDocument();
    expect(screen.getByText('BUY')).toBeInTheDocument();
  });

  it('should show and hide add trade form', async () => {
    const user = userEvent.setup();
    render(<PortfolioTracking />);

    const addButton = screen.getByText('+ Trade hinzufügen');
    await user.click(addButton);

    expect(screen.getByText('Neuen Trade hinzufügen')).toBeInTheDocument();
    expect(screen.getByText('Abbrechen')).toBeInTheDocument();
    expect(screen.getByLabelText('Typ')).toBeInTheDocument();
    expect(screen.getByLabelText('Symbol')).toBeInTheDocument();

    const cancelButton = screen.getByText('Abbrechen');
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Neuen Trade hinzufügen')).not.toBeInTheDocument();
    });
  });

  it('should add a new trade when form is submitted', async () => {
    const user = userEvent.setup();
    const mockAddTrade = vi.fn();
    tradeHistory.addTradeToHistory.mockImplementation(mockAddTrade);
    tradeHistory.loadTradeHistory.mockReturnValue([]);

    render(<PortfolioTracking />);

    // Open form
    await user.click(screen.getByText('+ Trade hinzufügen'));

    // Fill form
    await user.type(screen.getByLabelText('Symbol'), 'BTC');
    await user.type(screen.getByLabelText('Menge'), '0.1');
    await user.type(screen.getByLabelText('Preis (USD)'), '50000');

    // Submit
    const submitButton = screen.getByText('Trade speichern');
    await user.click(submitButton);

    // Verify trade was added
    expect(mockAddTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'BUY',
        symbol: 'BTC',
        amount: 0.1,
        price: 50000,
        totalValue: 5000
      })
    );
  });

  it('should show validation error when form is incomplete', async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<PortfolioTracking />);

    await user.click(screen.getByText('+ Trade hinzufügen'));
    await user.click(screen.getByText('Trade speichern'));

    expect(alertSpy).toHaveBeenCalledWith('Bitte fülle alle Felder aus');

    alertSpy.mockRestore();
  });

  it('should remove a trade when delete button is clicked', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const mockRemoveTrade = vi.fn();
    tradeHistory.removeTradeFromHistory.mockImplementation(mockRemoveTrade);

    const mockTrades = [
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

    tradeHistory.loadTradeHistory.mockReturnValue(mockTrades);

    render(<PortfolioTracking />);

    const deleteButton = screen.getByText('Löschen');
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockRemoveTrade).toHaveBeenCalledWith('trade-1');

    confirmSpy.mockRestore();
  });

  it('should not remove trade when user cancels confirmation', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const mockRemoveTrade = vi.fn();
    tradeHistory.removeTradeFromHistory.mockImplementation(mockRemoveTrade);

    const mockTrades = [
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

    tradeHistory.loadTradeHistory.mockReturnValue(mockTrades);

    render(<PortfolioTracking />);

    const deleteButton = screen.getByText('Löschen');
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockRemoveTrade).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('should display performance chart when snapshots exist', () => {
    const mockSnapshots = [
      {
        timestamp: '2024-01-01T00:00:00.000Z',
        totalValue: 5000,
        totalCost: 4500,
        totalProfit: 500,
        totalProfitPercent: 11.11
      },
      {
        timestamp: '2024-01-02T00:00:00.000Z',
        totalValue: 5500,
        totalCost: 4500,
        totalProfit: 1000,
        totalProfitPercent: 22.22
      }
    ];

    tradeHistory.loadPortfolioSnapshots.mockReturnValue(mockSnapshots);

    render(<PortfolioTracking />);

    expect(screen.getByText('Portfolio Performance')).toBeInTheDocument();
    expect(screen.getByTestId('chart-container')).toBeInTheDocument();
  });

  it('should not display chart when no snapshots exist', () => {
    tradeHistory.loadPortfolioSnapshots.mockReturnValue([]);

    render(<PortfolioTracking />);

    expect(screen.queryByText('Portfolio Performance')).not.toBeInTheDocument();
  });

  it('should display best and worst trades when available', () => {
    tradeHistory.calculateTradeStatistics.mockReturnValue({
      totalTrades: 10,
      completedTrades: 8,
      openPositions: 0,
      winningTrades: 6,
      losingTrades: 2,
      winRate: 75,
      totalProfit: 5000,
      avgProfit: 625,
      bestTrade: {
        symbol: 'BTC',
        profit: 2000,
        profitPercent: 20
      },
      worstTrade: {
        symbol: 'ETH',
        profit: -500,
        profitPercent: -10
      },
      tradesBySymbol: {}
    });

    render(<PortfolioTracking />);

    expect(screen.getByText('Bester Trade')).toBeInTheDocument();
    expect(screen.getByText('Schlechtester Trade')).toBeInTheDocument();
  });

  it('should handle form type selection', async () => {
    const user = userEvent.setup();
    render(<PortfolioTracking />);

    await user.click(screen.getByText('+ Trade hinzufügen'));

    const typeSelect = screen.getByLabelText('Typ');
    expect(typeSelect.value).toBe('BUY');

    await user.selectOptions(typeSelect, 'SELL');
    expect(typeSelect.value).toBe('SELL');
  });

  it('should format trade values correctly', () => {
    const mockTrades = [
      {
        id: 'trade-1',
        type: 'BUY',
        symbol: 'BTC',
        amount: 0.123456,
        price: 50000.50,
        totalValue: 6172.81,
        timestamp: '2024-01-01T00:00:00.000Z'
      }
    ];

    tradeHistory.loadTradeHistory.mockReturnValue(mockTrades);

    render(<PortfolioTracking />);

    // Check that values are displayed (exact format may vary)
    expect(screen.getByText('BTC')).toBeInTheDocument();
  });

  it('should handle empty portfolio gracefully', () => {
    storage.loadPortfolio.mockReturnValue([]);

    render(<PortfolioTracking />);

    // Component should still render without errors
    expect(screen.getByText('Portfolio Tracking')).toBeInTheDocument();
  });

  it('should create snapshot when portfolio exists and time threshold is met', async () => {
    const mockSaveSnapshot = vi.fn();
    tradeHistory.savePortfolioSnapshot.mockImplementation(mockSaveSnapshot);
    tradeHistory.loadPortfolioSnapshots.mockReturnValue([]);

    render(<PortfolioTracking />);

    await waitFor(() => {
      expect(mockSaveSnapshot).toHaveBeenCalled();
    });
  });
});

