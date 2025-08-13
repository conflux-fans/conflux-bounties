// src/store/deployment-store.ts - UPDATED with matching DeploymentResult interface
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface TokenConfig {
  name: string;
  symbol: string;
  totalSupply: string;
  decimals: number;
  description?: string;
  website?: string;
  logo?: string;
}

export interface VestingSchedule {
  id: string;
  category: string;
  cliffMonths: number;
  vestingMonths: number;
  revocable: boolean;
  description?: string;
}

export interface Beneficiary {
  id: string;
  address: string;
  category: string;
  amount: string;
  name?: string;
  email?: string;
}

// UPDATED: Match the hook's DeploymentResult interface
export interface DeploymentResult {
  tokenAddress: string;
  vestingContracts: string[];
  transactionHash: string;
  deployedAt: Date;
  databaseSaved: boolean; // ADD this property to match the hook
}

interface DeploymentState {
  // Configuration
  tokenConfig: TokenConfig | null;
  vestingSchedules: VestingSchedule[];
  beneficiaries: Beneficiary[];

  // Deployment state
  isDeploying: boolean;
  deploymentResult: DeploymentResult | null;
  deploymentError: string | null;
  isDeploymentComplete: boolean;

  // Actions
  setTokenConfig: (config: TokenConfig) => void;
  addVestingSchedule: (schedule: VestingSchedule) => void;
  updateVestingSchedule: (
    id: string,
    schedule: Partial<VestingSchedule>
  ) => void;
  removeVestingSchedule: (id: string) => void;
  addBeneficiary: (beneficiary: Beneficiary) => void;
  updateBeneficiary: (id: string, beneficiary: Partial<Beneficiary>) => void;
  removeBeneficiary: (id: string) => void;
  setBeneficiaries: (beneficiaries: Beneficiary[]) => void;
  setDeploying: (isDeploying: boolean) => void;
  setDeploymentResult: (result: DeploymentResult) => void;
  setDeploymentError: (error: string | null) => void;
  resetDeployment: () => void;
}

export const useDeploymentStore = create<DeploymentState>()(
  persist(
    (set, get) => ({
      // Initial state
      tokenConfig: null,
      vestingSchedules: [],
      beneficiaries: [],
      isDeploying: false,
      deploymentResult: null,
      deploymentError: null,
      isDeploymentComplete: false,

      // Actions
      setTokenConfig: (config) => set({ tokenConfig: config }),

      addVestingSchedule: (schedule) =>
        set((state) => ({
          vestingSchedules: [...state.vestingSchedules, schedule],
        })),

      updateVestingSchedule: (id, updates) =>
        set((state) => ({
          vestingSchedules: state.vestingSchedules.map((schedule) =>
            schedule.id === id ? { ...schedule, ...updates } : schedule
          ),
        })),

      removeVestingSchedule: (id) =>
        set((state) => ({
          vestingSchedules: state.vestingSchedules.filter(
            (schedule) => schedule.id !== id
          ),
          beneficiaries: state.beneficiaries.filter(
            (beneficiary) => beneficiary.category !== id
          ),
        })),

      addBeneficiary: (beneficiary) =>
        set((state) => ({
          beneficiaries: [...state.beneficiaries, beneficiary],
        })),

      updateBeneficiary: (id, updates) =>
        set((state) => ({
          beneficiaries: state.beneficiaries.map((beneficiary) =>
            beneficiary.id === id ? { ...beneficiary, ...updates } : beneficiary
          ),
        })),

      removeBeneficiary: (id) =>
        set((state) => ({
          beneficiaries: state.beneficiaries.filter(
            (beneficiary) => beneficiary.id !== id
          ),
        })),

      setBeneficiaries: (beneficiaries) => set({ beneficiaries }),

      setDeploying: (isDeploying) => set({ isDeploying }),

      setDeploymentResult: (result) =>
        set({
          deploymentResult: result,
          isDeploymentComplete: true,
          isDeploying: false,
          deploymentError: null,
        }),

      setDeploymentError: (error) =>
        set({
          deploymentError: error,
          isDeploying: false,
        }),

      resetDeployment: () =>
        set({
          tokenConfig: null,
          vestingSchedules: [],
          beneficiaries: [],
          isDeploying: false,
          deploymentResult: null,
          deploymentError: null,
          isDeploymentComplete: false,
        }),
    }),
    {
      name: "deployment-store",
      partialize: (state) => ({
        tokenConfig: state.tokenConfig,
        vestingSchedules: state.vestingSchedules,
        beneficiaries: state.beneficiaries,
      }),
    }
  )
);
