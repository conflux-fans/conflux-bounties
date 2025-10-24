export interface PriceData {
  symbol: string;
  price: string;
  confidence: string;
  expo: number;
  publishTime: number;
  formattedPrice: string;
}

export interface Alert {
  id: string;
  userAddress: string;
  asset: string;
  targetPrice: number;
  condition: 'above' | 'below';
  active: boolean;
  triggered: boolean;
  createdAt: number;
  triggeredAt?: number;
}

export interface WebSocketMessage {
  type: 'price_update' | 'liquidation_alert' | 'bet_resolved' | 'alert_triggered';
  data: any;
  timestamp: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}