import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

interface CorrelationContext {
  correlationId: string;
  requestId?: string;
  userId?: string;
}

class CorrelationIdManager {
  private static instance: CorrelationIdManager;
  private asyncLocalStorage: AsyncLocalStorage<CorrelationContext>;

  private constructor() {
    this.asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();
  }

  static getInstance(): CorrelationIdManager {
    if (!CorrelationIdManager.instance) {
      CorrelationIdManager.instance = new CorrelationIdManager();
    }
    return CorrelationIdManager.instance;
  }

  generateCorrelationId(): string {
    return uuidv4();
  }

  run<T>(context: CorrelationContext, callback: () => T): T {
    return this.asyncLocalStorage.run(context, callback);
  }

  getContext(): CorrelationContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  getCorrelationId(): string | undefined {
    const context = this.getContext();
    return context?.correlationId;
  }

  setRequestId(requestId: string): void {
    const context = this.getContext();
    if (context) {
      context.requestId = requestId;
    }
  }

  setUserId(userId: string): void {
    const context = this.getContext();
    if (context) {
      context.userId = userId;
    }
  }
}

export const correlationIdManager = CorrelationIdManager.getInstance();
export { CorrelationContext };