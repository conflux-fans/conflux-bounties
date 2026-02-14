import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import { useFilterStore } from '../stores/filters';

interface DateParams {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

/** Build query params from the global filter store. */
function useDateParams(extra?: Record<string, string | number | undefined>): DateParams & Record<string, string | number | undefined> {
  const { from, to } = useFilterStore();
  return { from, to, ...extra };
}

/** GET /health */
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<{ status: string; lastBlock: number; updatedAt: string }>('/health'),
    refetchInterval: 10_000,
  });
}

/** GET /activity/daily */
export function useDailyActivity() {
  const params = useDateParams({ limit: 365 });
  return useQuery({
    queryKey: ['activity', params],
    queryFn: () => apiFetch<{ data: Array<{ date: string; tx_count: number; active_accounts: number; new_contracts: number; total_gas_used: string }> }>('/activity/daily', params),
  });
}

/** GET /fees/daily */
export function useDailyFees() {
  const params = useDateParams({ limit: 365 });
  return useQuery({
    queryKey: ['fees', params],
    queryFn: () => apiFetch<{ data: Array<{ date: string; avg_gas_price: string; total_burned: string; total_tips: string; tx_count: number }> }>('/fees/daily', params),
  });
}

/** GET /contracts/top */
export function useTopContracts(sort = 'tx_count', order = 'desc') {
  const params = useDateParams({ limit: 50, sort, order });
  return useQuery({
    queryKey: ['contracts-top', params],
    queryFn: () => apiFetch<{ data: Array<{ contract_address: string; tx_count: number; unique_callers: number; gas_used: string; dapp_name?: string; category?: string }> }>('/contracts/top', params as Record<string, string | number | undefined>),
  });
}

/** GET /contracts/:addr/stats */
export function useContractStats(addr: string) {
  const params = useDateParams({ limit: 365 });
  return useQuery({
    queryKey: ['contract-stats', addr, params],
    queryFn: () => apiFetch<{ data: Array<{ date: string; tx_count: number; unique_callers: number; gas_used: string }> }>(`/contracts/${addr}/stats`, params),
    enabled: !!addr,
  });
}

/** GET /tokens */
export function useTokens() {
  const params = useDateParams({ limit: 100 });
  return useQuery({
    queryKey: ['tokens', params],
    queryFn: () => apiFetch<{ data: Array<{ address: string; name: string; symbol: string; decimals: number; transfer_count: number; holder_count: number }> }>('/tokens', params),
  });
}

/** GET /tokens/:addr/holders */
export function useTokenHolders(addr: string) {
  return useQuery({
    queryKey: ['token-holders', addr],
    queryFn: () => apiFetch<{ data: Array<{ holder_address: string; balance: string }> }>(`/tokens/${addr}/holders`, { limit: 20 }),
    enabled: !!addr,
  });
}

/** GET /tokens/:addr/stats */
export function useTokenStats(addr: string) {
  const params = useDateParams({ limit: 365 });
  return useQuery({
    queryKey: ['token-stats', addr, params],
    queryFn: () => apiFetch<{ data: Array<{ date: string; transfer_count: number; volume: string }> }>(`/tokens/${addr}/stats`, params),
    enabled: !!addr,
  });
}

/** GET /dapps/leaderboard */
export function useDappLeaderboard(category?: string) {
  const params = useDateParams({ limit: 50, category });
  return useQuery({
    queryKey: ['dapps', params],
    queryFn: () => apiFetch<{ data: Array<{ dapp_name: string; category: string; tx_count: number; gas_used: string; unique_callers: number }> }>('/dapps/leaderboard', params as Record<string, string | number | undefined>),
  });
}

/** GET /network/overview */
export function useNetworkOverview() {
  return useQuery({
    queryKey: ['network-overview'],
    queryFn: () => apiFetch<{ latestBlock: number; tps: number; totalTransactions: number; avgBlockTime: number }>('/network/overview'),
    refetchInterval: 15_000,
  });
}

/** GET /transactions/stats */
export function useTransactionStats() {
  const params = useDateParams();
  return useQuery({
    queryKey: ['tx-stats', params],
    queryFn: () => apiFetch<{ totalSuccess: number; totalFailure: number; successRate: number }>('/transactions/stats', params),
  });
}

/** GET /shares/:slug */
export function useSharedView(slug: string) {
  return useQuery({
    queryKey: ['share', slug],
    queryFn: () => apiFetch<{ slug: string; config: Record<string, unknown> }>(`/shares/${slug}`),
    enabled: !!slug,
  });
}
