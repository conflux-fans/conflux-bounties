// src/store/batch-deployment-store.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface BatchTokenConfig {
  id: string; // Temporary local ID for frontend state management
  name: string;
  symbol: string;
  totalSupply: string;
  decimals: number;
  description?: string;
  website?: string;
  logo?: string;
}

export interface BatchVestingSchedule {
  id: string; // Temporary local ID for frontend state management
  tokenId: string;
  category: string;
  cliffMonths: number;
  vestingMonths: number;
  revocable: boolean;
}

export interface BatchBeneficiary {
  id: string; // Temporary local ID for frontend state management
  tokenId: string;
  address: string;
  amount: string;
  category: string;
}

export interface BatchDeploymentResult {
  batchId: string;
  tokens: Array<{
    address: string;
    name: string;
    symbol: string;
  }>;
  vestingContracts: string[][];
  transactionHash: string;
  deployedAt: Date;
  databaseSaved: boolean;
}

export type BatchInputMethod = "manual" | "csv";

interface BatchDeploymentState {
  // Input method
  inputMethod: BatchInputMethod;
  setInputMethod: (method: BatchInputMethod) => void;

  // CSV data
  csvData: any[];
  setCsvData: (data: any[]) => void;

  // Token configurations
  tokenConfigs: BatchTokenConfig[];
  setTokenConfigs: (configs: BatchTokenConfig[]) => void;
  addTokenConfig: (config: BatchTokenConfig) => void;
  updateTokenConfig: (id: string, config: Partial<BatchTokenConfig>) => void;
  removeTokenConfig: (id: string) => void;

  // Vesting schedules
  vestingSchedules: BatchVestingSchedule[];
  setVestingSchedules: (schedules: BatchVestingSchedule[]) => void;
  addVestingSchedule: (schedule: BatchVestingSchedule) => void;
  updateVestingSchedule: (
    id: string,
    schedule: Partial<BatchVestingSchedule>
  ) => void;
  removeVestingSchedule: (id: string) => void;

  // Beneficiaries
  beneficiaries: BatchBeneficiary[];
  setBeneficiaries: (beneficiaries: BatchBeneficiary[]) => void;
  addBeneficiary: (beneficiary: BatchBeneficiary) => void;
  updateBeneficiary: (
    id: string,
    beneficiary: Partial<BatchBeneficiary>
  ) => void;
  removeBeneficiary: (id: string) => void;

  // Deployment result
  batchDeploymentResult: BatchDeploymentResult | null;
  setBatchDeploymentResult: (result: BatchDeploymentResult | null) => void;

  // Complete deployment status
  isBatchDeploymentComplete: boolean;
  setIsBatchDeploymentComplete: (complete: boolean) => void;

  // Reset function
  resetBatchDeployment: () => void;

  // Helper functions
  getTokensByCategory: (category: string) => BatchTokenConfig[];
  getVestingSchedulesByToken: (tokenId: string) => BatchVestingSchedule[];
  getBeneficiariesByToken: (tokenId: string) => BatchBeneficiary[];
  validateBatchConfiguration: () => { isValid: boolean; errors: string[] };
}

const initialState = {
  inputMethod: "manual" as BatchInputMethod,
  csvData: [],
  tokenConfigs: [],
  vestingSchedules: [],
  beneficiaries: [],
  batchDeploymentResult: null,
  isBatchDeploymentComplete: false,
};

export const useBatchDeploymentStore = create<BatchDeploymentState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Input method
      setInputMethod: (method) => set({ inputMethod: method }),

      // CSV data
      setCsvData: (data) => set({ csvData: data }),

      // Token configurations
      setTokenConfigs: (configs) => set({ tokenConfigs: configs }),
      addTokenConfig: (config) =>
        set((state) => ({
          tokenConfigs: [...state.tokenConfigs, config],
        })),
      updateTokenConfig: (id, config) =>
        set((state) => ({
          tokenConfigs: state.tokenConfigs.map((t) =>
            t.id === id ? { ...t, ...config } : t
          ),
        })),
      removeTokenConfig: (id) =>
        set((state) => ({
          tokenConfigs: state.tokenConfigs.filter((t) => t.id !== id),
          vestingSchedules: state.vestingSchedules.filter(
            (v) => v.tokenId !== id
          ),
          beneficiaries: state.beneficiaries.filter((b) => b.tokenId !== id),
        })),

      // Vesting schedules
      setVestingSchedules: (schedules) => set({ vestingSchedules: schedules }),
      addVestingSchedule: (schedule) =>
        set((state) => ({
          vestingSchedules: [...state.vestingSchedules, schedule],
        })),
      updateVestingSchedule: (id, schedule) =>
        set((state) => ({
          vestingSchedules: state.vestingSchedules.map((v) =>
            v.id === id ? { ...v, ...schedule } : v
          ),
        })),
      removeVestingSchedule: (id) =>
        set((state) => ({
          vestingSchedules: state.vestingSchedules.filter((v) => v.id !== id),
        })),

      // Beneficiaries
      setBeneficiaries: (beneficiaries) => set({ beneficiaries }),
      addBeneficiary: (beneficiary) =>
        set((state) => ({
          beneficiaries: [...state.beneficiaries, beneficiary],
        })),
      updateBeneficiary: (id, beneficiary) =>
        set((state) => ({
          beneficiaries: state.beneficiaries.map((b) =>
            b.id === id ? { ...b, ...beneficiary } : b
          ),
        })),
      removeBeneficiary: (id) =>
        set((state) => ({
          beneficiaries: state.beneficiaries.filter((b) => b.id !== id),
        })),

      // Deployment result
      setBatchDeploymentResult: (result) =>
        set({ batchDeploymentResult: result }),
      setIsBatchDeploymentComplete: (complete) =>
        set({ isBatchDeploymentComplete: complete }),

      // Reset function
      resetBatchDeployment: () => set(initialState),

      // Helper functions
      getTokensByCategory: (category) => {
        const state = get();
        return state.tokenConfigs.filter((token) =>
          state.vestingSchedules.some(
            (schedule) =>
              schedule.tokenId === token.id && schedule.category === category
          )
        );
      },

      getVestingSchedulesByToken: (tokenId) => {
        const state = get();
        return state.vestingSchedules.filter(
          (schedule) => schedule.tokenId === tokenId
        );
      },

      getBeneficiariesByToken: (tokenId) => {
        const state = get();
        return state.beneficiaries.filter(
          (beneficiary) => beneficiary.tokenId === tokenId
        );
      },

      validateBatchConfiguration: () => {
        const state = get();
        const errors: string[] = [];

        // Validate tokens
        if (state.tokenConfigs.length === 0) {
          errors.push("At least one token configuration is required");
        }

        state.tokenConfigs.forEach((token, index) => {
          if (!token.name) errors.push(`Token ${index + 1}: Name is required`);
          if (!token.symbol)
            errors.push(`Token ${index + 1}: Symbol is required`);
          if (!token.totalSupply || parseFloat(token.totalSupply) <= 0) {
            errors.push(`Token ${index + 1}: Valid total supply is required`);
          }
        });

        // Validate vesting schedules
        state.tokenConfigs.forEach((token) => {
          const schedules = state.vestingSchedules.filter(
            (s) => s.tokenId === token.id
          );
          if (schedules.length === 0) {
            errors.push(
              `Token ${token.name}: At least one vesting schedule is required`
            );
          }
        });

        // Validate beneficiaries
        state.tokenConfigs.forEach((token) => {
          const tokenBeneficiaries = state.beneficiaries.filter(
            (b) => b.tokenId === token.id
          );
          if (tokenBeneficiaries.length === 0) {
            errors.push(
              `Token ${token.name}: At least one beneficiary is required`
            );
          }

          tokenBeneficiaries.forEach((beneficiary, index) => {
            if (!beneficiary.address || !beneficiary.address.startsWith("0x")) {
              errors.push(
                `Token ${token.name}, Beneficiary ${
                  index + 1
                }: Valid address is required`
              );
            }
            if (!beneficiary.amount || parseFloat(beneficiary.amount) <= 0) {
              errors.push(
                `Token ${token.name}, Beneficiary ${
                  index + 1
                }: Valid amount is required`
              );
            }
          });
        });

        return {
          isValid: errors.length === 0,
          errors,
        };
      },
    }),
    {
      name: "batch-deployment-store",
    }
  )
);
