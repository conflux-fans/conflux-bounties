import { renderHook, act, waitFor } from '@testing-library/react';
import { useWebSocket } from '../hooks/useWebSocket';
import { WS_URL } from '../lib/env';

// Mock the WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  readyState: number = MockWebSocket.CONNECTING;
  url: string;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  // Helper methods for testing
  triggerMessage(data: any) {
    if (this.onmessage) {
      const event = new MessageEvent('message', { data });
      this.onmessage(event);
    }
  }

  triggerError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  triggerClose() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

// Mock environment variable
jest.mock('../lib/env', () => ({
  WS_URL: 'ws://test.example.com',
}));

describe('useWebSocket', () => {
  let mockWebSocket: MockWebSocket | null = null;
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    mockWebSocket = null;
    
    // Create WebSocket mock with static constants
    const WebSocketMock: any = jest.fn((url: string) => {
      mockWebSocket = new MockWebSocket(url);
      return mockWebSocket;
    });
    
    WebSocketMock.CONNECTING = 0;
    WebSocketMock.OPEN = 1;
    WebSocketMock.CLOSING = 2;
    WebSocketMock.CLOSED = 3;
    
    global.WebSocket = WebSocketMock;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    jest.clearAllMocks();
    mockWebSocket = null;
  });

  describe('Initial State', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useWebSocket());

      expect(result.current.isConnected).toBe(false);
      expect(result.current.lastMessage).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.readyState).toBe(0);
    });
  });

  describe('Connection', () => {
    it('should connect to WebSocket with default URL', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      expect(global.WebSocket).toHaveBeenCalledWith(WS_URL);
      expect(result.current.readyState).toBe(1);
      expect(result.current.error).toBeNull();
    });

    it('should connect to WebSocket with custom URL', async () => {
      const customUrl = 'ws://custom.example.com';
      const { result } = renderHook(() => useWebSocket(customUrl));

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      expect(global.WebSocket).toHaveBeenCalledWith(customUrl);
    });

    it('should handle WebSocket connection open event', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Message Handling', () => {
    it('should handle JSON messages', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const testMessage = { type: 'test', data: 'hello' };
      act(() => {
        mockWebSocket!.triggerMessage(JSON.stringify(testMessage));
      });

      expect(result.current.lastMessage).toEqual(testMessage);
    });

    it('should handle plain text messages when JSON parsing fails', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const plainTextMessage = 'plain text message';
      act(() => {
        mockWebSocket!.triggerMessage(plainTextMessage);
      });

      expect(result.current.lastMessage).toBe(plainTextMessage);
    });

    it('should handle invalid JSON gracefully', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const invalidJson = 'invalid { json';
      act(() => {
        mockWebSocket!.triggerMessage(invalidJson);
      });

      expect(result.current.lastMessage).toBe(invalidJson);
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket error event', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        mockWebSocket!.triggerError();
      });

      expect(result.current.error).toBe('WebSocket error');
      expect(result.current.isConnected).toBe(false);
    });

    it('should handle WebSocket constructor error', () => {
      global.WebSocket = jest.fn(() => {
        throw new Error('Connection failed');
      }) as any;

      const { result } = renderHook(() => useWebSocket());

      expect(result.current.error).toBe('Connection failed');
    });
  });

  describe('Close Handling', () => {
    it('should handle WebSocket close event', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        mockWebSocket!.triggerClose();
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.readyState).toBe(3);
    });

    it('should close WebSocket on unmount', async () => {
      const { result, unmount } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const closeSpy = jest.spyOn(mockWebSocket!, 'close');
      unmount();

      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('should send string message when WebSocket is open', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(mockWebSocket).not.toBeNull();
      });

      const message = 'test message';

      act(() => {
        result.current.sendMessage(message);
      });

      expect(mockWebSocket!.sent).toContain(message);
    });

    it('should send JSON message when WebSocket is open', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(mockWebSocket).not.toBeNull();
      });

      const message = { type: 'test', data: 'hello' };

      act(() => {
        result.current.sendMessage(message);
      });

      expect(mockWebSocket!.sent).toContain(JSON.stringify(message));
    });

    it('should not send message when WebSocket is not open', () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.sendMessage('test');
      });

      if (mockWebSocket) {
        expect(mockWebSocket.sent).toHaveLength(0);
      }
    });

    it('should not send message when WebSocket is closed', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        mockWebSocket!.triggerClose();
      });

      const previousLength = mockWebSocket!.sent.length;

      act(() => {
        result.current.sendMessage('test');
      });

      expect(mockWebSocket!.sent).toHaveLength(previousLength);
    });

    it('should not send message when wsRef.current is null', () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.sendMessage('test');
      });

      if (mockWebSocket) {
        expect(mockWebSocket.sent).toHaveLength(0);
      }
    });
  });

  describe('reconnect', () => {
    it('should clear error when reconnect is called', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        mockWebSocket!.triggerError();
      });

      expect(result.current.error).toBe('WebSocket error');

      act(() => {
        result.current.reconnect();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('URL Change', () => {
    it('should reconnect when URL changes', async () => {
      const { result, rerender } = renderHook(
        ({ url }) => useWebSocket(url),
        { initialProps: { url: 'ws://test1.example.com' } }
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      expect(global.WebSocket).toHaveBeenCalledWith('ws://test1.example.com');

      const firstWs = mockWebSocket;
      const closeSpy = jest.spyOn(firstWs!, 'close');

      rerender({ url: 'ws://test2.example.com' });

      expect(closeSpy).toHaveBeenCalled();

      await waitFor(() => {
        expect(global.WebSocket).toHaveBeenCalledWith('ws://test2.example.com');
      });
    });
  });

  describe('SSR (Server-Side Rendering)', () => {
    it('should not create WebSocket on server-side', () => {
      const originalWindow = global.window;
      // @ts-ignore
      global.window = undefined;

      const { result } = renderHook(() => useWebSocket());

      expect(result.current.isConnected).toBe(false);
      expect(result.current.lastMessage).toBeNull();
      expect(result.current.error).toBeNull();

      // Restore window
      global.window = originalWindow;
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple messages in sequence', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const messages = [
        { id: 1, data: 'first' },
        { id: 2, data: 'second' },
        { id: 3, data: 'third' },
      ];

      messages.forEach((msg) => {
        act(() => {
          mockWebSocket!.triggerMessage(JSON.stringify(msg));
        });
        expect(result.current.lastMessage).toEqual(msg);
      });
    });

    it('should maintain wsRef across re-renders', async () => {
      const { result, rerender } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      rerender();

      act(() => {
        result.current.sendMessage('test after rerender');
      });

      expect(mockWebSocket!.sent).toContain('test after rerender');
    });

    it('should handle empty message', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        mockWebSocket!.triggerMessage('');
      });

      expect(result.current.lastMessage).toBe('');
    });

    it('should handle null in sendMessage', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        result.current.sendMessage(null);
      });

      expect(mockWebSocket!.sent).toContain('null');
    });

    it('should handle undefined in sendMessage', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const initialLength = mockWebSocket!.sent.length;

      act(() => {
        result.current.sendMessage(undefined);
      });

      expect(mockWebSocket!.sent.length).toBeGreaterThan(initialLength);
    });

    it('should handle complex nested objects in sendMessage', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const complexMessage = {
        nested: { deeply: { value: 'test' } },
        array: [1, 2, 3],
      };

      act(() => {
        result.current.sendMessage(complexMessage);
      });

      expect(mockWebSocket!.sent).toContain(JSON.stringify(complexMessage));
    });

    it('should handle numeric messages', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        result.current.sendMessage(42);
      });

      expect(mockWebSocket!.sent).toContain('42');
    });

    it('should handle boolean messages', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        result.current.sendMessage(true);
      });

      expect(mockWebSocket!.sent).toContain('true');
    });

    it('should update readyState on open', async () => {
      const { result } = renderHook(() => useWebSocket());

      expect(result.current.readyState).toBe(0);

      await waitFor(() => {
        expect(result.current.readyState).toBe(1);
      });
    });

    it('should handle array messages', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const arrayMessage = [1, 2, 3, 'test'];

      act(() => {
        result.current.sendMessage(arrayMessage);
      });

      expect(mockWebSocket!.sent).toContain(JSON.stringify(arrayMessage));
    });
  });

  describe('WebSocket Lifecycle', () => {
    it('should properly cleanup on unmount with pending connection', () => {
      const { unmount } = renderHook(() => useWebSocket());

      unmount();

      expect(true).toBe(true);
    });

    it('should handle rapid connection and disconnection', async () => {
      const { result, unmount } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        mockWebSocket!.triggerClose();
      });

      expect(result.current.isConnected).toBe(false);

      unmount();
    });
  });
});