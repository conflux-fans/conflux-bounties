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

// Static API for easier usage and testing
export class CorrelationId {
  private static currentId: string | undefined;

  static generate(): string {
    return uuidv4();
  }

  static get(): string | undefined {
    return this.currentId;
  }

  static set(id: string): void {
    this.currentId = id;
  }

  static clear(): void {
    this.currentId = undefined;
  }

  static async withCorrelationId<T>(
    fn: () => T | Promise<T>,
    id?: string
  ): Promise<T> {
    const previousId = this.currentId;
    const correlationId = id || this.generate();
    
    try {
      this.set(correlationId);
      const result = await fn();
      return result;
    } finally {
      if (previousId !== undefined) {
        this.set(previousId);
      } else {
        this.clear();
      }
    }
  }
}

export const correlationIdManager = CorrelationIdManager.getInstance();
export { CorrelationContext };