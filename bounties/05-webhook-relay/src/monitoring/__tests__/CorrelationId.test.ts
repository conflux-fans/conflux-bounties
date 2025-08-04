import { CorrelationId, correlationIdManager, CorrelationContext } from '../CorrelationId';

describe('CorrelationId', () => {
  beforeEach(() => {
    // Clear any existing correlation ID before each test
    CorrelationId.clear();
  });

  afterEach(() => {
    // Clean up after each test
    CorrelationId.clear();
  });

  describe('generate', () => {
    it('should generate a unique correlation ID', () => {
      const id1 = CorrelationId.generate();
      const id2 = CorrelationId.generate();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    it('should generate IDs with expected format', () => {
      const id = CorrelationId.generate();
      // Should be a UUID-like format (8-4-4-4-12 characters)
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('get', () => {
    it('should return undefined when no correlation ID is set', () => {
      expect(CorrelationId.get()).toBeUndefined();
    });

    it('should return the current correlation ID when set', () => {
      const id = CorrelationId.generate();
      CorrelationId.set(id);
      expect(CorrelationId.get()).toBe(id);
    });
  });

  describe('set', () => {
    it('should set the correlation ID', () => {
      const id = 'test-correlation-id';
      CorrelationId.set(id);
      expect(CorrelationId.get()).toBe(id);
    });

    it('should overwrite existing correlation ID', () => {
      const id1 = 'first-id';
      const id2 = 'second-id';
      
      CorrelationId.set(id1);
      expect(CorrelationId.get()).toBe(id1);
      
      CorrelationId.set(id2);
      expect(CorrelationId.get()).toBe(id2);
    });
  });

  describe('clear', () => {
    it('should clear the correlation ID', () => {
      const id = 'test-correlation-id';
      CorrelationId.set(id);
      expect(CorrelationId.get()).toBe(id);
      
      CorrelationId.clear();
      expect(CorrelationId.get()).toBeUndefined();
    });

    it('should handle clearing when no ID is set', () => {
      expect(CorrelationId.get()).toBeUndefined();
      // Should not throw an error
      expect(() => CorrelationId.clear()).not.toThrow();
      expect(CorrelationId.get()).toBeUndefined();
    });
  });

  describe('withCorrelationId', () => {
    it('should execute function with generated correlation ID', async () => {
      let capturedId: string | undefined;
      
      const result = await CorrelationId.withCorrelationId(async () => {
        capturedId = CorrelationId.get();
        return 'test-result';
      });
      
      expect(result).toBe('test-result');
      expect(capturedId).toBeDefined();
      expect(typeof capturedId).toBe('string');
      // After execution, correlation ID should be cleared
      expect(CorrelationId.get()).toBeUndefined();
    });

    it('should execute function with provided correlation ID', async () => {
      const providedId = 'custom-correlation-id';
      let capturedId: string | undefined;
      
      const result = await CorrelationId.withCorrelationId(async () => {
        capturedId = CorrelationId.get();
        return 'test-result';
      }, providedId);
      
      expect(result).toBe('test-result');
      expect(capturedId).toBe(providedId);
      // After execution, correlation ID should be cleared
      expect(CorrelationId.get()).toBeUndefined();
    });

    it('should handle synchronous functions', async () => {
      let capturedId: string | undefined;
      
      const result = await CorrelationId.withCorrelationId(() => {
        capturedId = CorrelationId.get();
        return 'sync-result';
      });
      
      expect(result).toBe('sync-result');
      expect(capturedId).toBeDefined();
      expect(CorrelationId.get()).toBeUndefined();
    });

    it('should preserve existing correlation ID after execution', async () => {
      const existingId = 'existing-id';
      CorrelationId.set(existingId);
      
      let capturedId: string | undefined;
      await CorrelationId.withCorrelationId(async () => {
        capturedId = CorrelationId.get();
        return 'test';
      });
      
      expect(capturedId).toBeDefined();
      expect(capturedId).not.toBe(existingId);
      // Original ID should be restored
      expect(CorrelationId.get()).toBe(existingId);
    });

    it('should handle function that throws an error', async () => {
      const existingId = 'existing-id';
      CorrelationId.set(existingId);
      
      const error = new Error('Test error');
      await expect(
        CorrelationId.withCorrelationId(async () => {
          throw error;
        })
      ).rejects.toThrow('Test error');
      
      // Original ID should be restored even after error
      expect(CorrelationId.get()).toBe(existingId);
    });

    it('should handle nested withCorrelationId calls', async () => {
      const outerResult = await CorrelationId.withCorrelationId(async () => {
        const outerId = CorrelationId.get();
        
        const innerResult = await CorrelationId.withCorrelationId(async () => {
          const innerId = CorrelationId.get();
          expect(innerId).toBeDefined();
          expect(innerId).not.toBe(outerId);
          return 'inner';
        });
        
        // After inner execution, outer ID should be restored
        expect(CorrelationId.get()).toBe(outerId);
        return innerResult + '-outer';
      });
      
      expect(outerResult).toBe('inner-outer');
      expect(CorrelationId.get()).toBeUndefined();
    });

    it('should handle Promise-returning functions', async () => {
      let capturedId: string | undefined;
      
      const result = await CorrelationId.withCorrelationId(async () => {
        return new Promise<string>((resolve) => {
          setTimeout(() => {
            capturedId = CorrelationId.get();
            resolve('async-result');
          }, 10);
        });
      });
      
      expect(result).toBe('async-result');
      expect(capturedId).toBeDefined();
      expect(CorrelationId.get()).toBeUndefined();
    });
  });

  describe('integration scenarios', () => {
    it('should maintain correlation ID across async operations', async () => {
      const correlationIds: (string | undefined)[] = [];
      
      await CorrelationId.withCorrelationId(async () => {
        correlationIds.push(CorrelationId.get());
        await new Promise(resolve => setTimeout(resolve, 10));
        correlationIds.push(CorrelationId.get());
        await Promise.resolve();
        correlationIds.push(CorrelationId.get());
      });
      
      expect(correlationIds).toHaveLength(3);
      expect(correlationIds[0]).toBeDefined();
      expect(correlationIds[1]).toBe(correlationIds[0]);
      expect(correlationIds[2]).toBe(correlationIds[0]);
    });

    it('should work with multiple concurrent operations', async () => {
      const results = await Promise.all([
        CorrelationId.withCorrelationId(async () => {
          const id = CorrelationId.get();
          await new Promise(resolve => setTimeout(resolve, 20));
          return { id, result: 'first' };
        }),
        CorrelationId.withCorrelationId(async () => {
          const id = CorrelationId.get();
          await new Promise(resolve => setTimeout(resolve, 10));
          return { id, result: 'second' };
        }),
        CorrelationId.withCorrelationId(async () => {
          const id = CorrelationId.get();
          await new Promise(resolve => setTimeout(resolve, 30));
          return { id, result: 'third' };
        })
      ]);
      
      expect(results).toHaveLength(3);
      expect(results[0].id).toBeDefined();
      expect(results[1].id).toBeDefined();
      expect(results[2].id).toBeDefined();
      
      // Each operation should have its own unique correlation ID
      expect(results[0].id).not.toBe(results[1].id);
      expect(results[1].id).not.toBe(results[2].id);
      expect(results[0].id).not.toBe(results[2].id);
      
      expect(results[0].result).toBe('first');
      expect(results[1].result).toBe('second');
      expect(results[2].result).toBe('third');
    });
  });
});

describe('correlationIdManager', () => {
  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      // Access the private CorrelationIdManager class through the module
      const CorrelationIdModule = require('../CorrelationId');
      
      // Get two instances and verify they're the same
      const manager1 = CorrelationIdModule.correlationIdManager;
      const manager2 = CorrelationIdModule.correlationIdManager;
      
      expect(manager1).toBe(manager2);
    });
  });

  describe('generateCorrelationId', () => {
    it('should generate a unique correlation ID', () => {
      const id1 = correlationIdManager.generateCorrelationId();
      const id2 = correlationIdManager.generateCorrelationId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    it('should generate IDs with UUID format', () => {
      const id = correlationIdManager.generateCorrelationId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('run and getContext', () => {
    it('should run callback with correlation context', () => {
      const context: CorrelationContext = {
        correlationId: 'test-correlation-id',
        requestId: 'test-request-id',
        userId: 'test-user-id'
      };

      let capturedContext: CorrelationContext | undefined;
      
      const result = correlationIdManager.run(context, () => {
        capturedContext = correlationIdManager.getContext();
        return 'test-result';
      });

      expect(result).toBe('test-result');
      expect(capturedContext).toEqual(context);
    });

    it('should return undefined context when not in run', () => {
      const context = correlationIdManager.getContext();
      expect(context).toBeUndefined();
    });

    it('should handle nested run calls', () => {
      const outerContext: CorrelationContext = {
        correlationId: 'outer-id',
        requestId: 'outer-request'
      };

      const innerContext: CorrelationContext = {
        correlationId: 'inner-id',
        requestId: 'inner-request'
      };

      const result = correlationIdManager.run(outerContext, () => {
        const outerCaptured = correlationIdManager.getContext();
        expect(outerCaptured).toEqual(outerContext);
        
        const innerResult = correlationIdManager.run(innerContext, () => {
          const innerCaptured = correlationIdManager.getContext();
          expect(innerCaptured).toEqual(innerContext);
          return 'inner';
        });

        // After inner run, outer context should be restored
        const restoredOuter = correlationIdManager.getContext();
        expect(restoredOuter).toEqual(outerContext);
        
        return innerResult + '-outer';
      });

      expect(result).toBe('inner-outer');
    });
  });

  describe('getCorrelationId', () => {
    it('should return correlation ID from context', () => {
      const context: CorrelationContext = {
        correlationId: 'test-correlation-id'
      };

      correlationIdManager.run(context, () => {
        const id = correlationIdManager.getCorrelationId();
        expect(id).toBe('test-correlation-id');
      });
    });

    it('should return undefined when no context', () => {
      const id = correlationIdManager.getCorrelationId();
      expect(id).toBeUndefined();
    });
  });

  describe('setRequestId', () => {
    it('should set request ID in existing context', () => {
      const context: CorrelationContext = {
        correlationId: 'test-correlation-id'
      };

      correlationIdManager.run(context, () => {
        correlationIdManager.setRequestId('new-request-id');
        const updatedContext = correlationIdManager.getContext();
        expect(updatedContext?.requestId).toBe('new-request-id');
        expect(updatedContext?.correlationId).toBe('test-correlation-id');
      });
    });

    it('should handle setting request ID when no context', () => {
      // Should not throw an error
      expect(() => correlationIdManager.setRequestId('test-request-id')).not.toThrow();
    });
  });

  describe('setUserId', () => {
    it('should set user ID in existing context', () => {
      const context: CorrelationContext = {
        correlationId: 'test-correlation-id'
      };

      correlationIdManager.run(context, () => {
        correlationIdManager.setUserId('new-user-id');
        const updatedContext = correlationIdManager.getContext();
        expect(updatedContext?.userId).toBe('new-user-id');
        expect(updatedContext?.correlationId).toBe('test-correlation-id');
      });
    });

    it('should handle setting user ID when no context', () => {
      // Should not throw an error
      expect(() => correlationIdManager.setUserId('test-user-id')).not.toThrow();
    });
  });

  describe('async operations', () => {
    it('should maintain context across async operations', async () => {
      const context: CorrelationContext = {
        correlationId: 'async-test-id',
        requestId: 'async-request-id'
      };

      const result = await new Promise<string>((resolve) => {
        correlationIdManager.run(context, async () => {
          // Simulate async operation
          await new Promise(r => setTimeout(r, 10));
          
          const capturedContext = correlationIdManager.getContext();
          expect(capturedContext).toEqual(context);
          
          resolve('async-result');
        });
      });

      expect(result).toBe('async-result');
    });

    it('should handle concurrent async operations', async () => {
      const contexts = [
        { correlationId: 'id-1', requestId: 'req-1' },
        { correlationId: 'id-2', requestId: 'req-2' },
        { correlationId: 'id-3', requestId: 'req-3' }
      ];

      const results = await Promise.all(
        contexts.map((context, index) =>
          new Promise<{ context: CorrelationContext | undefined; index: number }>((resolve) => {
            correlationIdManager.run(context, async () => {
              await new Promise(r => setTimeout(r, Math.random() * 20));
              const capturedContext = correlationIdManager.getContext();
              resolve({ context: capturedContext, index });
            });
          })
        )
      );

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.context).toEqual(contexts[index]);
        expect(result.index).toBe(index);
      });
    });
  });
});