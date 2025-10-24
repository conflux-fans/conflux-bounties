export interface PriceData {
  id: string;
  price: string;
  confidence: string;
  expo: number;
  publishTime: number;
  formattedPrice: string;
}

export interface Bet {
  id: number;
  bettor: string;
  priceId: string;
  amount: string;
  targetPrice: string;
  predictAbove: boolean;
  resolutionTime: number;
  resolved: boolean;
  won: boolean;
}

export interface Position {
  id: number;
  borrower: string;
  collateralPriceId: string;
  borrowPriceId: string;
  collateralAmount: string;
  borrowAmount: string;
  openTime: number;
  active: boolean;
  healthRatio?: number;
  collateralValue?: string;
  borrowValue?: string;
}

export interface Alert {
  id: string;
  asset: string;
  targetPrice: number;
  condition: 'above' | 'below';
  active: boolean;
  createdAt: number;
}