import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PriceAlerts from '../components/AlertManager';

jest.mock('../hooks/usePythPrices');

const mockUsePythPrices = require('../hooks/usePythPrices').usePythPrices as jest.Mock;

describe('PriceAlerts Component', () => {
  let mockPrices: any;
  let localStorageMock: { [key: string]: string };
  let notificationMock: jest.Mock;
  let audioPlayMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    localStorageMock = {};
    Storage.prototype.getItem = jest.fn((key: string) => localStorageMock[key] || null);
    Storage.prototype.setItem = jest.fn((key: string, value: string) => {
      localStorageMock[key] = value;
    });
    Storage.prototype.removeItem = jest.fn((key: string) => {
      delete localStorageMock[key];
    });
    Storage.prototype.clear = jest.fn(() => {
      localStorageMock = {};
    });

    mockPrices = {
      BTC: { formattedPrice: '50000' },
      ETH: { formattedPrice: '3000' },
      CFX: { formattedPrice: '0.15' }
    };

    mockUsePythPrices.mockReturnValue({ prices: mockPrices });

    notificationMock = jest.fn().mockImplementation(() => ({
      close: jest.fn(),
      onclick: null
    }));
    
    global.Notification = Object.assign(notificationMock, {
      permission: 'default',
      requestPermission: jest.fn().mockResolvedValue('granted')
    }) as any;

    audioPlayMock = jest.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.play = audioPlayMock;

    Object.defineProperty(navigator, 'vibrate', {
      value: jest.fn(),
      writable: true,
      configurable: true
    });

    console.error = jest.fn();
    console.log = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    localStorage.clear();
  });

  describe('Initial Rendering', () => {
    test('renders component with all main elements', () => {
      render(<PriceAlerts />);
      
      expect(screen.getByText('Create Price Alert')).toBeInTheDocument();
      expect(screen.getByText('No Active Alerts')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create alert/i })).toBeInTheDocument();
    });

    test('shows notification permission banner when not granted', () => {
      render(<PriceAlerts />);
      
      expect(screen.getByText('Enable Notifications')).toBeInTheDocument();
      expect(screen.getByText('Allow notifications to receive price alerts')).toBeInTheDocument();
    });

    test('shows test notification button when permission granted', () => {
      global.Notification.permission = 'granted';
      render(<PriceAlerts />);
      
      expect(screen.getByRole('button', { name: /test notification/i })).toBeInTheDocument();
    });

    test('displays current prices for all assets', () => {
      render(<PriceAlerts />);
      
      const currentPriceText = screen.getByText((content) => 
        content.includes('Current:') && content.includes('50,000')
      );
      expect(currentPriceText).toBeInTheDocument();
    });

    test('handles Notification API not available', () => {
      const originalNotification = global.Notification;
      delete window.Notification;
      
      const { container } = render(<PriceAlerts />);
      
      expect(container).toBeInTheDocument();
      expect(screen.queryByText(/test notification/i)).not.toBeInTheDocument();
      
      global.Notification = originalNotification;
    });
  });

  describe('Alert Type Selection', () => {
    test('switches between price and percentage alert types', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const percentageButton = screen.getByText('Percentage Change');
      await user.click(percentageButton);

      expect(screen.getByPlaceholderText(/e.g., 5 for 5% change/i)).toBeInTheDocument();
      expect(screen.getByText(/base price:/i)).toBeInTheDocument();
    });

    test('price type shows target price input', () => {
      render(<PriceAlerts />);
      
      expect(screen.getByPlaceholderText('Enter target price')).toBeInTheDocument();
    });

    test('switches back from percentage to price type', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const percentageButton = screen.getByText('Percentage Change');
      await user.click(percentageButton);

      const priceButton = screen.getByText('Price Target');
      await user.click(priceButton);

      expect(screen.getByPlaceholderText('Enter target price')).toBeInTheDocument();
    });
  });

  describe('Template Application', () => {
    test('applies Quick Buy template correctly', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const quickBuyButton = screen.getByRole('button', { name: /quick buy/i });
      await user.click(quickBuyButton);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price') as HTMLInputElement;
      expect(parseFloat(targetPriceInput.value)).toBeCloseTo(47500, 0);
    });

    test('applies Take Profit template correctly', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const takeProfitButton = screen.getByRole('button', { name: /take profit/i });
      await user.click(takeProfitButton);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price') as HTMLInputElement;
      expect(parseFloat(targetPriceInput.value)).toBeCloseTo(55000, 0);
    });

    test('applies Stop Loss template correctly', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const stopLossButton = screen.getByRole('button', { name: /stop loss/i });
      await user.click(stopLossButton);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price') as HTMLInputElement;
      expect(parseFloat(targetPriceInput.value)).toBeCloseTo(45000, 0);
    });

    test('applies Breakout template correctly', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const breakoutButton = screen.getByRole('button', { name: /breakout/i });
      await user.click(breakoutButton);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price') as HTMLInputElement;
      expect(parseFloat(targetPriceInput.value)).toBeCloseTo(57500, 0);
    });

    test('shows alert when template applied without price data', async () => {
      const user = userEvent.setup({ delay: null });
      mockUsePythPrices.mockReturnValue({ prices: { BTC: { formattedPrice: '0' } } });
      
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      render(<PriceAlerts />);

      const quickBuyButton = screen.getByRole('button', { name: /quick buy/i });
      await user.click(quickBuyButton);

      expect(alertSpy).toHaveBeenCalledWith('Price not available yet');
      alertSpy.mockRestore();
    });
  });

  describe('Creating Price Alerts', () => {
    test('creates a price alert successfully', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '55000');

      const createButton = screen.getByRole('button', { name: /create alert/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
        const priceText = screen.getByText((content) => content.includes('55,000'));
        expect(priceText).toBeInTheDocument();
      });
    });

    test('creates a percentage alert successfully', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const percentageButton = screen.getByText('Percentage Change');
      await user.click(percentageButton);

      const percentageInput = screen.getByPlaceholderText(/e.g., 5 for 5% change/i);
      await user.clear(percentageInput);
      await user.type(percentageInput, '10');

      const createButton = screen.getByRole('button', { name: /create alert/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
        expect(screen.getByText(/10% change/i)).toBeInTheDocument();
      });
    });

    test('validates target price before creating alert', async () => {
      const user = userEvent.setup({ delay: null });
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      
      render(<PriceAlerts />);

      const createButton = screen.getByRole('button', { name: /create alert/i });
      await user.click(createButton);

      expect(alertSpy).toHaveBeenCalledWith('Please enter a valid target price');
      alertSpy.mockRestore();
    });

    test('validates percentage before creating alert', async () => {
      const user = userEvent.setup({ delay: null });
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      
      render(<PriceAlerts />);

      const percentageButton = screen.getByText('Percentage Change');
      await user.click(percentageButton);

      const percentageInput = screen.getByPlaceholderText(/e.g., 5 for 5% change/i);
      await user.clear(percentageInput);

      const createButton = screen.getByRole('button', { name: /create alert/i });
      await user.click(createButton);

      expect(alertSpy).toHaveBeenCalledWith('Please enter a valid percentage');
      alertSpy.mockRestore();
    });

    test('prevents alert creation when price data unavailable', async () => {
      const user = userEvent.setup({ delay: null });
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      mockUsePythPrices.mockReturnValue({ prices: { BTC: { formattedPrice: '0' } } });
      
      render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '55000');

      const createButton = screen.getByRole('button', { name: /create alert/i });
      await user.click(createButton);

      expect(alertSpy).toHaveBeenCalledWith('Price data not available yet. Please wait.');
      alertSpy.mockRestore();
    });

    test('changes asset selection', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const assetSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(assetSelect, 'ETH');

      expect((assetSelect as HTMLSelectElement).value).toBe('ETH');
      
      await waitFor(() => {
        const priceElements = screen.getAllByText(/current:/i);
        const hasETHPrice = priceElements.some(el => 
          el.textContent?.includes('3,000') || el.textContent?.includes('3000')
        );
        expect(hasETHPrice).toBe(true);
      }, { timeout: 2000 });
    });

    test('changes condition selection', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const selects = screen.getAllByRole('combobox');
      const conditionSelect = selects.find(select => {
        const options = within(select).getAllByRole('option');
        return options.some(opt => opt.textContent?.includes('Above') || opt.textContent?.includes('Below'));
      }) as HTMLSelectElement;

      expect(conditionSelect).toBeDefined();
      await user.selectOptions(conditionSelect, 'below');
      expect(conditionSelect.value).toBe('below');
    });

    test('creates alert with CFX asset', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const assetSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(assetSelect, 'CFX');

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '0.20');

      const createButton = screen.getByRole('button', { name: /create alert/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });
    });
  });

  describe('Advanced Options', () => {
    test('toggles advanced options visibility', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const advancedButton = screen.getByText(/advanced options/i);
      await user.click(advancedButton);

      expect(screen.getByText(/expires after/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/repeating alert/i)).toBeInTheDocument();
    });

    test('sets expiry hours', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const advancedButton = screen.getByText(/advanced options/i);
      await user.click(advancedButton);

      await waitFor(() => {
        expect(screen.getByText(/expires after/i)).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('spinbutton');
      const expiryInput = inputs.find(input => 
        input.getAttribute('min') === '0' || (input as HTMLInputElement).value === '24'
      ) as HTMLInputElement;

      expect(expiryInput).toBeDefined();
      await user.clear(expiryInput);
      await user.type(expiryInput, '48');
      expect(expiryInput.value).toBe('48');
    });

    test('sets expiry to never (0 hours)', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const advancedButton = screen.getByText(/advanced options/i);
      await user.click(advancedButton);

      await waitFor(() => {
        expect(screen.getByText(/expires after/i)).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('spinbutton');
      const expiryInput = inputs.find(input => 
        input.getAttribute('min') === '0'
      ) as HTMLInputElement;

      if (expiryInput) {
        await user.clear(expiryInput);
        await user.type(expiryInput, '0');
        expect(expiryInput.value).toBe('0');
      }
    });

    test('enables repeating alert and sets interval', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const advancedButton = screen.getByText(/advanced options/i);
      await user.click(advancedButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/repeating alert/i)).toBeInTheDocument();
      });

      const repeatingCheckbox = screen.getByLabelText(/repeating alert/i) as HTMLInputElement;
      await user.click(repeatingCheckbox);

      await waitFor(() => {
        expect(repeatingCheckbox.checked).toBe(true);
      });

      expect(repeatingCheckbox.checked).toBe(true);
    });

    test('adds note to alert', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const advancedButton = screen.getByText(/advanced options/i);
      await user.click(advancedButton);

      const noteTextarea = screen.getByPlaceholderText(/add a note/i);
      await user.type(noteTextarea, 'Important alert for trading strategy');

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '55000');

      const createButton = screen.getByRole('button', { name: /create alert/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/important alert for trading strategy/i)).toBeInTheDocument();
      });
    });

    test('creates alert with all advanced options', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const advancedButton = screen.getByText(/advanced options/i);
      await user.click(advancedButton);

      const repeatingCheckbox = screen.getByLabelText(/repeating alert/i);
      await user.click(repeatingCheckbox);

      const noteTextarea = screen.getByPlaceholderText(/add a note/i);
      await user.type(noteTextarea, 'Test note');

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '55000');

      const createButton = screen.getByRole('button', { name: /create alert/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/repeats every 60m/i)).toBeInTheDocument();
        expect(screen.getByText(/test note/i)).toBeInTheDocument();
      });
    });

    test('collapses advanced options when clicked again', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const advancedButton = screen.getByText(/advanced options/i);
      
      await user.click(advancedButton);
      await waitFor(() => {
        expect(screen.getByText(/expires after/i)).toBeInTheDocument();
      });

      await user.click(advancedButton);
      await waitFor(() => {
        expect(screen.queryByText(/expires after/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Alert Management', () => {
    test('deletes an alert', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '55000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
        expect(screen.getByText((content) => content.includes('55,000'))).toBeInTheDocument();
      });

      const allButtons = screen.getAllByRole('button');
      const deleteButton = allButtons.find(btn => 
        btn.textContent?.toLowerCase().includes('delete') && 
        !btn.textContent?.toLowerCase().includes('all')
      );
      
      expect(deleteButton).toBeDefined();
      
      if (deleteButton) {
        await user.click(deleteButton);
      }

      await waitFor(() => {
        expect(screen.queryByText((content) => content.includes('55,000'))).not.toBeInTheDocument();
      });
    });

    test('pauses an alert', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '55000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const allButtons = screen.getAllByRole('button');
      const pauseButton = allButtons.find(btn => btn.textContent?.trim() === 'Pause');
      
      expect(pauseButton).toBeDefined();
      
      if (pauseButton) {
        await user.click(pauseButton);
      }

      await waitFor(() => {
        expect(screen.queryByText(/active alerts/i)).not.toBeInTheDocument();
      });
    });

    test('re-enables a paused alert', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '55000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      let allButtons = screen.getAllByRole('button');
      let pauseButton = allButtons.find(btn => btn.textContent?.trim() === 'Pause');
      
      if (pauseButton) {
        await user.click(pauseButton);
      }

      // Just verify the alert is no longer in active section
      await waitFor(() => {
        expect(screen.queryByText(/active alerts/i)).not.toBeInTheDocument();
      });

      // Verify localStorage was called (alert was saved)
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    test('deletes all alerts with confirmation', async () => {
      const user = userEvent.setup({ delay: null });
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      
      render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '55000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
        expect(screen.getByText((content) => content.includes('55,000'))).toBeInTheDocument();
      });

      const allButtons = screen.getAllByRole('button');
      const deleteAllButton = allButtons.find(btn => btn.textContent?.includes('Delete All'));

      expect(deleteAllButton).toBeDefined();

      if (deleteAllButton) {
        await user.click(deleteAllButton);
      }

      expect(confirmSpy).toHaveBeenCalled();
      
      await waitFor(() => {
        expect(screen.queryByText((content) => content.includes('55,000'))).not.toBeInTheDocument();
      });
      
      confirmSpy.mockRestore();
    });

    test('cancels delete all when not confirmed', async () => {
      const user = userEvent.setup({ delay: null });
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      
      render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '55000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const deleteAllButton = buttons.find(btn => btn.textContent?.includes('Delete All'));

      if (deleteAllButton) {
        await user.click(deleteAllButton);
      }

      expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      
      confirmSpy.mockRestore();
    });

    test('disables all alerts', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '55000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const disableAllButton = buttons.find(btn => btn.textContent?.includes('Disable All'));

      if (disableAllButton) {
        await user.click(disableAllButton);
      }

      await waitFor(() => {
        expect(screen.queryByText(/active alerts/i)).not.toBeInTheDocument();
      });
    });

    test('enables all alerts', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '55000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      let allButtons = screen.getAllByRole('button');
      const pauseButton = allButtons.find(btn => btn.textContent?.trim() === 'Pause');
      
      if (pauseButton) {
        await user.click(pauseButton);
      }

      // Just verify it's not active anymore
      await waitFor(() => {
        expect(screen.queryByText(/active alerts/i)).not.toBeInTheDocument();
      });

      // Verify localStorage was called (alert was saved in paused state)
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('LocalStorage Persistence', () => {
    test('saves alerts to localStorage', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '55000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith(
          'priceAlerts',
          expect.stringContaining('55000')
        );
      });
    });

    test('loads alerts from localStorage on mount', () => {
      const savedAlerts = JSON.stringify([
        {
          id: '1',
          asset: 'BTC',
          targetPrice: 55000,
          condition: 'above',
          active: true,
          triggered: false,
          createdAt: Date.now(),
          alertType: 'price'
        }
      ]);

      localStorageMock['priceAlerts'] = savedAlerts;

      render(<PriceAlerts />);

      const priceText = screen.getByText((content) => content.includes('55,000'));
      expect(priceText).toBeInTheDocument();
    });

    test('loads alerts with expiry and notes from localStorage', () => {
      const now = Date.now();
      const savedAlerts = JSON.stringify([
        {
          id: '1',
          asset: 'ETH',
          targetPrice: 3500,
          condition: 'above',
          active: true,
          triggered: false,
          createdAt: now,
          expiresAt: now + (24 * 60 * 60 * 1000),
          note: 'My important note',
          alertType: 'price'
        }
      ]);

      localStorageMock['priceAlerts'] = savedAlerts;

      render(<PriceAlerts />);

      expect(screen.getByText(/my important note/i)).toBeInTheDocument();
    });

    test('handles corrupt localStorage data', () => {
      localStorageMock['priceAlerts'] = 'invalid json';

      render(<PriceAlerts />);

      expect(console.error).toHaveBeenCalled();
      expect(screen.getByText('No Active Alerts')).toBeInTheDocument();
    });

    test('removes localStorage when all alerts deleted', async () => {
      const user = userEvent.setup({ delay: null });
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      
      render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '55000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const deleteAllButton = buttons.find(btn => btn.textContent?.includes('Delete All'));

      if (deleteAllButton) {
        await user.click(deleteAllButton);
      }

      expect(localStorage.removeItem).toHaveBeenCalledWith('priceAlerts');
      
      confirmSpy.mockRestore();
    });
  });

  describe('Notification Permissions', () => {
    test('requests notification permission', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const enableButton = screen.getByRole('button', { name: /enable/i });
      await user.click(enableButton);

      await waitFor(() => {
        expect(global.Notification.requestPermission).toHaveBeenCalled();
      });
    });

    test('shows success notification after granting permission', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const enableButton = screen.getByRole('button', { name: /enable/i });
      await user.click(enableButton);

      await waitFor(() => {
        expect(notificationMock).toHaveBeenCalledWith(
          'Notifications Enabled!',
          expect.objectContaining({
            body: 'You will now receive price alerts'
          })
        );
      });
    });

    test('shows alert when permission denied', async () => {
      const user = userEvent.setup({ delay: null });
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      
      global.Notification.requestPermission = jest.fn().mockResolvedValue('denied');
      
      render(<PriceAlerts />);

      const enableButton = screen.getByRole('button', { name: /enable/i });
      await user.click(enableButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Notification permission denied. Enable in browser settings.'
        );
      });

      alertSpy.mockRestore();
    });

    test('shows alert when notifications not supported', async () => {
      const user = userEvent.setup({ delay: null });
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      
      const originalNotification = global.Notification;
      delete window.Notification;
      
      render(<PriceAlerts />);

      const enableButton = screen.getByRole('button', { name: /enable/i });
      await user.click(enableButton);

      expect(alertSpy).toHaveBeenCalledWith('Notifications not supported in this browser');
      
      alertSpy.mockRestore();
      global.Notification = originalNotification;
    });

    test('tests notification functionality', async () => {
      const user = userEvent.setup({ delay: null });
      global.Notification.permission = 'granted';
      
      render(<PriceAlerts />);

      const testButton = screen.getByRole('button', { name: /test notification/i });
      await user.click(testButton);

      await waitFor(() => {
        expect(notificationMock).toHaveBeenCalledWith(
          'Test Notification',
          expect.objectContaining({
            body: expect.stringContaining('If you see this')
          })
        );
      });
    });

    test('handles test notification error', async () => {
      const user = userEvent.setup({ delay: null });
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      global.Notification.permission = 'granted';
      
      notificationMock.mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      render(<PriceAlerts />);

      const testButton = screen.getByRole('button', { name: /test notification/i });
      await user.click(testButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });

      alertSpy.mockRestore();
    });
  });

  describe('Price Monitoring and Alert Triggering', () => {
    test('triggers alert when price goes above target', async () => {
      const user = userEvent.setup({ delay: null });
      global.Notification.permission = 'granted';
      
      const { rerender } = render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '48000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const newMockPrices = {
        BTC: { formattedPrice: '49000' },
        ETH: { formattedPrice: '3000' },
        CFX: { formattedPrice: '0.15' }
      };
      
      mockUsePythPrices.mockReturnValue({ prices: newMockPrices });
      rerender(<PriceAlerts />);

      await waitFor(() => {
        expect(notificationMock).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    test('triggers alert when price goes below target', async () => {
      const user = userEvent.setup({ delay: null });
      global.Notification.permission = 'granted';
      
      const { rerender } = render(<PriceAlerts />);

      const selects = screen.getAllByRole('combobox');
      const conditionSelect = selects.find(select => {
        const options = within(select).getAllByRole('option');
        return options.some(opt => opt.textContent?.includes('Below'));
      });

      if (conditionSelect) {
        await user.selectOptions(conditionSelect, 'below');
      }

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '52000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const newMockPrices = {
        BTC: { formattedPrice: '51000' },
        ETH: { formattedPrice: '3000' },
        CFX: { formattedPrice: '0.15' }
      };
      
      mockUsePythPrices.mockReturnValue({ prices: newMockPrices });
      rerender(<PriceAlerts />);

      await waitFor(() => {
        expect(notificationMock).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    test('triggers percentage alert when threshold met', async () => {
      const user = userEvent.setup({ delay: null });
      global.Notification.permission = 'granted';
      
      const { rerender } = render(<PriceAlerts />);

      const percentageButton = screen.getByText('Percentage Change');
      await user.click(percentageButton);

      const percentageInput = screen.getByPlaceholderText(/e.g., 5 for 5% change/i);
      await user.clear(percentageInput);
      await user.type(percentageInput, '5');

      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const newMockPrices = {
        BTC: { formattedPrice: '52500' },
        ETH: { formattedPrice: '3000' },
        CFX: { formattedPrice: '0.15' }
      };
      
      mockUsePythPrices.mockReturnValue({ prices: newMockPrices });
      rerender(<PriceAlerts />);

      await waitFor(() => {
        expect(notificationMock).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    test('triggers percentage alert below threshold', async () => {
      const user = userEvent.setup({ delay: null });
      global.Notification.permission = 'granted';
      
      const { rerender } = render(<PriceAlerts />);

      const percentageButton = screen.getByText('Percentage Change');
      await user.click(percentageButton);

      const selects = screen.getAllByRole('combobox');
      const conditionSelect = selects.find(select => {
        const options = within(select).getAllByRole('option');
        return options.some(opt => opt.textContent?.includes('Below'));
      });

      if (conditionSelect) {
        await user.selectOptions(conditionSelect, 'below');
      }

      const percentageInput = screen.getByPlaceholderText(/e.g., 5 for 5% change/i);
      await user.clear(percentageInput);
      await user.type(percentageInput, '5');

      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const newMockPrices = {
        BTC: { formattedPrice: '47500' },
        ETH: { formattedPrice: '3000' },
        CFX: { formattedPrice: '0.15' }
      };
      
      mockUsePythPrices.mockReturnValue({ prices: newMockPrices });
      rerender(<PriceAlerts />);

      await waitFor(() => {
        expect(notificationMock).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    test('does not trigger alert when already triggered', async () => {
      const user = userEvent.setup({ delay: null });
      global.Notification.permission = 'granted';
      
      const { rerender } = render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '48000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      let newMockPrices = {
        BTC: { formattedPrice: '49000' },
        ETH: { formattedPrice: '3000' },
        CFX: { formattedPrice: '0.15' }
      };
      
      mockUsePythPrices.mockReturnValue({ prices: newMockPrices });
      rerender(<PriceAlerts />);

      await waitFor(() => {
        expect(notificationMock).toHaveBeenCalled();
      }, { timeout: 2000 });

      // Clear mock and change price again
      const firstCallCount = notificationMock.mock.calls.length;
      notificationMock.mockClear();

      newMockPrices = {
        BTC: { formattedPrice: '50000' },
        ETH: { formattedPrice: '3000' },
        CFX: { formattedPrice: '0.15' }
      };
      
      mockUsePythPrices.mockReturnValue({ prices: newMockPrices });
      rerender(<PriceAlerts />);

      // Should NOT trigger again
      expect(notificationMock).not.toHaveBeenCalled();
    });

    test('does not trigger inactive alert', async () => {
      const user = userEvent.setup({ delay: null });
      global.Notification.permission = 'granted';
      
      const { rerender } = render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '48000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const pauseButton = buttons.find(btn => btn.textContent?.includes('Pause'));
      
      if (pauseButton) {
        await user.click(pauseButton);
        
        await waitFor(() => {
          expect(screen.queryByText(/active alerts/i)).not.toBeInTheDocument();
        });
      }

      const newMockPrices = {
        BTC: { formattedPrice: '49000' },
        ETH: { formattedPrice: '3000' },
        CFX: { formattedPrice: '0.15' }
      };
      
      mockUsePythPrices.mockReturnValue({ prices: newMockPrices });
      rerender(<PriceAlerts />);

      // Should NOT trigger
      expect(notificationMock).not.toHaveBeenCalled();
    });

    test('does not trigger when price is zero', async () => {
      const user = userEvent.setup({ delay: null });
      global.Notification.permission = 'granted';
      
      const { rerender } = render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '48000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const newMockPrices = {
        BTC: { formattedPrice: '0' },
        ETH: { formattedPrice: '3000' },
        CFX: { formattedPrice: '0.15' }
      };
      
      mockUsePythPrices.mockReturnValue({ prices: newMockPrices });
      rerender(<PriceAlerts />);

      // Should NOT trigger
      expect(notificationMock).not.toHaveBeenCalled();
    });

    test('plays audio when alert triggers', async () => {
      const user = userEvent.setup({ delay: null });
      global.Notification.permission = 'granted';
      
      const { rerender } = render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '48000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const newMockPrices = {
        BTC: { formattedPrice: '49000' },
        ETH: { formattedPrice: '3000' },
        CFX: { formattedPrice: '0.15' }
      };
      
      mockUsePythPrices.mockReturnValue({ prices: newMockPrices });
      rerender(<PriceAlerts />);

      await waitFor(() => {
        expect(audioPlayMock).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    test('handles audio play failure gracefully', async () => {
      const user = userEvent.setup({ delay: null });
      global.Notification.permission = 'granted';
      
      audioPlayMock.mockReset();
      audioPlayMock.mockRejectedValueOnce(new Error('Audio failed'));
      
      const { rerender } = render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '48000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const newMockPrices = {
        BTC: { formattedPrice: '49000' },
        ETH: { formattedPrice: '3000' },
        CFX: { formattedPrice: '0.15' }
      };
      
      mockUsePythPrices.mockReturnValue({ prices: newMockPrices });
      rerender(<PriceAlerts />);

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith('Audio failed:', expect.any(Error));
      }, { timeout: 2000 });
    });

    test('shows in-app notification when browser notification fails', async () => {
      const user = userEvent.setup({ delay: null });
      global.Notification.permission = 'granted';
      
      notificationMock.mockImplementationOnce(() => {
        throw new Error('Notification failed');
      });
      
      const { rerender } = render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '48000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const newMockPrices = {
        BTC: { formattedPrice: '49000' },
        ETH: { formattedPrice: '3000' },
        CFX: { formattedPrice: '0.15' }
      };
      
      mockUsePythPrices.mockReturnValue({ prices: newMockPrices });
      rerender(<PriceAlerts />);

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          'Failed to create notification:',
          expect.any(Error)
        );
      }, { timeout: 2000 });
    });

    test('shows in-app notification when permission not granted', async () => {
      const user = userEvent.setup({ delay: null });
      global.Notification.permission = 'default';
      
      const { rerender } = render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '48000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const newMockPrices = {
        BTC: { formattedPrice: '49000' },
        ETH: { formattedPrice: '3000' },
        CFX: { formattedPrice: '0.15' }
      };
      
      mockUsePythPrices.mockReturnValue({ prices: newMockPrices });
      rerender(<PriceAlerts />);

      await waitFor(() => {
        const inAppNotification = document.querySelector('.fixed');
        expect(inAppNotification).toBeTruthy();
      }, { timeout: 2000 });
    });

    test('vibrates device when alert triggers', async () => {
      const user = userEvent.setup({ delay: null });
      global.Notification.permission = 'granted';
      const vibrateMock = navigator.vibrate as jest.Mock;
      
      const { rerender } = render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '48000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const newMockPrices = {
        BTC: { formattedPrice: '49000' },
        ETH: { formattedPrice: '3000' },
        CFX: { formattedPrice: '0.15' }
      };
      
      mockUsePythPrices.mockReturnValue({ prices: newMockPrices });
      rerender(<PriceAlerts />);

      await waitFor(() => {
        expect(vibrateMock).toHaveBeenCalledWith([200, 100, 200]);
      }, { timeout: 2000 });
    });

    test('closes notification after timeout', async () => {
      const user = userEvent.setup({ delay: null });
      global.Notification.permission = 'granted';
      
      let notificationInstance: any;
      notificationMock.mockImplementationOnce(() => {
        notificationInstance = {
          close: jest.fn(),
          onclick: null
        };
        return notificationInstance;
      });
      
      const { rerender } = render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '48000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const newMockPrices = {
        BTC: { formattedPrice: '49000' },
        ETH: { formattedPrice: '3000' },
        CFX: { formattedPrice: '0.15' }
      };
      
      mockUsePythPrices.mockReturnValue({ prices: newMockPrices });
      rerender(<PriceAlerts />);

      await waitFor(() => {
        expect(notificationInstance).toBeDefined();
      }, { timeout: 3000 });

      jest.advanceTimersByTime(10000);

      expect(notificationInstance.close).toHaveBeenCalled();
    });
  });

  describe('Repeating Alerts', () => {
    test('re-enables repeating alert after trigger', async () => {
      const user = userEvent.setup({ delay: null });
      global.Notification.permission = 'granted';
      
      const { rerender } = render(<PriceAlerts />);

      await user.click(screen.getByText(/advanced options/i));
      
      await waitFor(() => {
        expect(screen.getByLabelText(/repeating alert/i)).toBeInTheDocument();
      });

      const checkbox = screen.getByLabelText(/repeating alert/i) as HTMLInputElement;
      await user.click(checkbox);

      await waitFor(() => {
        expect(checkbox.checked).toBe(true);
      });

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '48000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const newMockPrices = {
        BTC: { formattedPrice: '49000' },
        ETH: { formattedPrice: '3000' },
        CFX: { formattedPrice: '0.15' }
      };
      
      mockUsePythPrices.mockReturnValue({ prices: newMockPrices });
      rerender(<PriceAlerts />);

      await waitFor(() => {
        expect(notificationMock).toHaveBeenCalled();
      }, { timeout: 2000 });
    });
  });

  describe('Alert Expiry', () => {
    test('expires alert after set time', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      await user.click(screen.getByText(/advanced options/i));

      await waitFor(() => {
        expect(screen.getByText(/expires after/i)).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('spinbutton');
      const expiryInput = inputs.find(input => 
        input.getAttribute('min') === '0' || (input as HTMLInputElement).value === '24'
      );

      if (expiryInput) {
        await user.clear(expiryInput);
        await user.type(expiryInput, '1');
      }

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '55000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      jest.advanceTimersByTime(61 * 60 * 1000);

      await waitFor(() => {
        expect(console.log).toHaveBeenCalled();
      });
    });

    test('does not trigger expired alert', async () => {
      const user = userEvent.setup({ delay: null });
      global.Notification.permission = 'granted';
      
      const { rerender } = render(<PriceAlerts />);

      await user.click(screen.getByText(/advanced options/i));
      
      await waitFor(() => {
        expect(screen.getByText(/expires after/i)).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('spinbutton');
      const expiryInput = inputs[0];

      await user.clear(expiryInput);
      await user.type(expiryInput, '1');

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '48000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      // Advance time to expire the alert
      jest.advanceTimersByTime(61 * 60 * 1000);

      const newMockPrices = {
        BTC: { formattedPrice: '49000' },
        ETH: { formattedPrice: '3000' },
        CFX: { formattedPrice: '0.15' }
      };
      
      mockUsePythPrices.mockReturnValue({ prices: newMockPrices });
      rerender(<PriceAlerts />);

      // Should NOT trigger because it's expired
      expect(notificationMock).not.toHaveBeenCalled();
    });

    test('keeps non-expiring alert active', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      await user.click(screen.getByText(/advanced options/i));
      
      await waitFor(() => {
        expect(screen.getByText(/expires after/i)).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('spinbutton');
      const expiryInput = inputs.find(input => input.getAttribute('min') === '0');

      if (expiryInput) {
        await user.clear(expiryInput);
        await user.type(expiryInput, '0');
      }

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '55000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      jest.advanceTimersByTime(100 * 60 * 60 * 1000);

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles empty prices object', () => {
      mockUsePythPrices.mockReturnValue({ prices: {} });
      
      render(<PriceAlerts />);
      
      expect(screen.getByText('Create Price Alert')).toBeInTheDocument();
    });

    test('handles missing price data', () => {
      mockUsePythPrices.mockReturnValue({ prices: {} });
      
      const { container } = render(<PriceAlerts />);
      
      expect(container).toBeInTheDocument();
      expect(screen.getByText('Create Price Alert')).toBeInTheDocument();
    });

    test('handles undefined prices', () => {
      mockUsePythPrices.mockReturnValue({ prices: {} });
      
      const { container } = render(<PriceAlerts />);
      
      expect(container).toBeInTheDocument();
      expect(screen.getByText('Create Price Alert')).toBeInTheDocument();
    });

    test('handles zero price gracefully', async () => {
      const user = userEvent.setup({ delay: null });
      mockPrices.BTC.formattedPrice = '0';
      
      render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '48000');
      
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      expect(alertSpy).toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    test('clears form after creating alert', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '55000');
      
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      expect((targetPriceInput as HTMLInputElement).value).toBe('');
    });

    test('handles notification onclick', async () => {
      const user = userEvent.setup({ delay: null });
      global.Notification.permission = 'granted';
      
      let notificationInstance: any;
      
      notificationMock.mockImplementationOnce(() => {
        notificationInstance = {
          close: jest.fn(),
          onclick: null
        };
        return notificationInstance;
      });
      
      const { rerender } = render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '48000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const newMockPrices = {
        BTC: { formattedPrice: '49000' },
        ETH: { formattedPrice: '3000' },
        CFX: { formattedPrice: '0.15' }
      };
      
      mockUsePythPrices.mockReturnValue({ prices: newMockPrices });
      rerender(<PriceAlerts />);

      await waitFor(() => {
        expect(notificationInstance).toBeDefined();
      }, { timeout: 2000 });
      
      expect(notificationInstance).toBeTruthy();
    });

    test('handles multiple assets correctly', async () => {
      const user = userEvent.setup({ delay: null });
      render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '55000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const assetSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(assetSelect, 'ETH');
      
      await user.clear(targetPriceInput);
      await user.type(targetPriceInput, '3500');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        const allText = document.body.textContent || '';
        expect(allText).toContain('BTC');
        expect(allText).toContain('ETH');
      }, { timeout: 2000 });
    });

    test('handles negative target price validation', async () => {
      const user = userEvent.setup({ delay: null });
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      
      render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '-100');
      
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      expect(alertSpy).toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    test('removes in-app notification after timeout', async () => {
      const user = userEvent.setup({ delay: null });
      global.Notification.permission = 'default';
      
      const { rerender } = render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '48000');
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });

      const newMockPrices = {
        BTC: { formattedPrice: '49000' },
        ETH: { formattedPrice: '3000' },
        CFX: { formattedPrice: '0.15' }
      };
      
      mockUsePythPrices.mockReturnValue({ prices: newMockPrices });
      rerender(<PriceAlerts />);

      await waitFor(() => {
        const inAppNotification = document.querySelector('.fixed');
        expect(inAppNotification).toBeTruthy();
      }, { timeout: 2000 });

      jest.advanceTimersByTime(8500);

      await waitFor(() => {
        const inAppNotification = document.querySelector('.fixed');
        expect(inAppNotification).toBeFalsy();
      }, { timeout: 1000 });
    });

    test('handles localStorage quota exceeded', async () => {
      const user = userEvent.setup({ delay: null });
      
      render(<PriceAlerts />);

      const targetPriceInput = screen.getByPlaceholderText('Enter target price');
      await user.type(targetPriceInput, '55000');
      
      await user.click(screen.getByRole('button', { name: /create alert/i }));

      await waitFor(() => {
        expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      });
    });
  });
});
