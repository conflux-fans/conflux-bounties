// Thin re-export - implementation lives in @cfxdevkit/sdk/automation.
// The worker injects its pino logger at instantiation (see main.ts).
export {
  DEFAULT_SAFETY_CONFIG,
  SafetyGuard,
} from '@cfxdevkit/sdk/automation';
