// FilterValidator unit tests
import { FilterValidator } from '../FilterValidator';
import type { EventFilters, FilterExpression } from '../../types';

describe('FilterValidator', () => {
  let validator: FilterValidator;

  beforeEach(() => {
    validator = new FilterValidator();
  });

  describe('validateFilters', () => {
    it('should validate empty filters', () => {
      const result = validator.validateFilters({});
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null/undefined filters', () => {
      const nullResult = validator.validateFilters(null as any);
      expect(nullResult.isValid).toBe(false);
      expect(nullResult.errors[0]?.message).toContain('must be a valid object');

      const undefinedResult = validator.validateFilters(undefined as any);
      expect(undefinedResult.isValid).toBe(false);
      expect(undefinedResult.errors[0]?.message).toContain('must be a valid object');
    });

    it('should validate simple string filters', () => {
      const filters: EventFilters = {
        eventName: 'Transfer',
        contractAddress: '0x1234567890123456789012345678901234567890'
      };
      const result = validator.validateFilters(filters);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate simple number filters', () => {
      const filters: EventFilters = {
        blockNumber: 12345,
        logIndex: 0
      };
      const result = validator.validateFilters(filters);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate array filters', () => {
      const filters: EventFilters = {
        eventName: ['Transfer', 'Approval'],
        blockNumber: ['12345', '12346', '12347']
      };
      const result = validator.validateFilters(filters);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate args filters', () => {
      const filters: EventFilters = {
        from: '0x1111111111111111111111111111111111111111',
        'args.to': '0x2222222222222222222222222222222222222222',
        'args.amount': '1000000000000000000'
      };
      const result = validator.validateFilters(filters);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate nested args filters', () => {
      const filters: EventFilters = {
        'args.metadata.name': 'Test Token',
        'args.nested.deep.value': 123
      };
      const result = validator.validateFilters(filters);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid parameter names', () => {
      const filters: EventFilters = {
        '': 'value',
        '123invalid': 'value',
        'invalid-name': 'value'
      };
      const result = validator.validateFilters(filters);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors.every(e => e.message.includes('Invalid parameter name'))).toBe(true);
    });

    it('should reject null/undefined filter values', () => {
      const filters: EventFilters = {
        eventName: null as any,
        blockNumber: undefined as any
      };
      const result = validator.validateFilters(filters);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors.every(e => e.message.includes('cannot be null or undefined'))).toBe(true);
    });

    it('should reject empty arrays', () => {
      const filters: EventFilters = {
        eventName: []
      };
      const result = validator.validateFilters(filters);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.message).toContain('cannot be empty');
    });

    it('should reject mixed-type arrays (except string/number)', () => {
      const filters: EventFilters = {
        mixedArray: ['string', true, {}] as any
      };
      const result = validator.validateFilters(filters);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.message).toContain('same type');
    });

    it('should allow string/number mixed arrays', () => {
      const filters: EventFilters = {
        mixedArray: ['string', '123', 'another']
      };
      const result = validator.validateFilters(filters);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid filter value types', () => {
      const filters: EventFilters = {
        eventName: { invalid: 'object' } as any,
        blockNumber: true as any
      };
      const result = validator.validateFilters(filters);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateFilterExpression', () => {
    it('should validate valid filter expressions', () => {
      const expressions: FilterExpression[] = [
        { operator: 'eq', value: 'test' },
        { operator: 'ne', value: 123 },
        { operator: 'gt', value: 100 },
        { operator: 'lt', value: 200 },
        { operator: 'in', value: ['a', 'b', 'c'] },
        { operator: 'contains', value: 'substring' }
      ];

      expressions.forEach(expr => {
        const result = validator.validateFilterExpression(expr);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject null/undefined expressions', () => {
      const nullResult = validator.validateFilterExpression(null as any);
      expect(nullResult.isValid).toBe(false);
      expect(nullResult.errors[0]?.message).toContain('must be a valid object');

      const undefinedResult = validator.validateFilterExpression(undefined as any);
      expect(undefinedResult.isValid).toBe(false);
      expect(undefinedResult.errors[0]?.message).toContain('must be a valid object');
    });

    it('should reject expressions without operator', () => {
      const expr = { value: 'test' } as any;
      const result = validator.validateFilterExpression(expr);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'operator')).toBe(true);
    });

    it('should reject expressions with invalid operators', () => {
      const expr = { operator: 'invalid', value: 'test' } as any;
      const result = validator.validateFilterExpression(expr);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'operator' && e.message.includes('Invalid operator'))).toBe(true);
    });

    it('should reject expressions without value', () => {
      const expr = { operator: 'eq' } as any;
      const result = validator.validateFilterExpression(expr);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'value')).toBe(true);
    });

    it('should validate gt/lt operators require comparable values', () => {
      const validExpr = { operator: 'gt' as const, value: 123 };
      const validResult = validator.validateFilterExpression(validExpr);
      expect(validResult.isValid).toBe(true);

      const invalidExpr = { operator: 'gt' as const, value: {} };
      const invalidResult = validator.validateFilterExpression(invalidExpr);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.some(e => e.message.includes('number, string, or BigNumber'))).toBe(true);
    });

    it('should validate in operator requires array', () => {
      const validExpr = { operator: 'in' as const, value: ['a', 'b'] };
      const validResult = validator.validateFilterExpression(validExpr);
      expect(validResult.isValid).toBe(true);

      const invalidExpr = { operator: 'in' as const, value: 'not-array' };
      const invalidResult = validator.validateFilterExpression(invalidExpr);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.some(e => e.message.includes('must be an array'))).toBe(true);
    });

    it('should validate in operator rejects empty arrays', () => {
      const expr = { operator: 'in' as const, value: [] };
      const result = validator.validateFilterExpression(expr);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('cannot be empty'))).toBe(true);
    });

    it('should validate contains operator requires string or array', () => {
      const validStringExpr = { operator: 'contains' as const, value: 'substring' };
      const validStringResult = validator.validateFilterExpression(validStringExpr);
      expect(validStringResult.isValid).toBe(true);

      const validArrayExpr = { operator: 'contains' as const, value: ['item'] };
      const validArrayResult = validator.validateFilterExpression(validArrayExpr);
      expect(validArrayResult.isValid).toBe(true);

      const invalidExpr = { operator: 'contains' as const, value: 123 };
      const invalidResult = validator.validateFilterExpression(invalidExpr);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.some(e => e.message.includes('string or array'))).toBe(true);
    });
  });

  describe('parameter name validation', () => {
    it('should accept valid event field names', () => {
      const validFields = [
        'contractAddress',
        'eventName',
        'blockNumber',
        'transactionHash',
        'logIndex',
        'timestamp'
      ];

      validFields.forEach(field => {
        const filters: EventFilters = { [field]: 'test' };
        const result = validator.validateFilters(filters);
        expect(result.isValid).toBe(true);
      });
    });

    it('should accept args-prefixed field names', () => {
      const validArgsFields = [
        'args.from',
        'args.to',
        'args.amount',
        'args.metadata.name',
        'args.nested.deep.value'
      ];

      validArgsFields.forEach(field => {
        const filters: EventFilters = { [field]: 'test' };
        const result = validator.validateFilters(filters);
        expect(result.isValid).toBe(true);
      });
    });

    it('should accept direct arg names for backward compatibility', () => {
      const validArgNames = [
        'from',
        'to',
        'amount',
        'tokenId',
        'user_address',
        'token_amount'
      ];

      validArgNames.forEach(field => {
        const filters: EventFilters = { [field]: 'test' };
        const result = validator.validateFilters(filters);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject invalid parameter names', () => {
      const invalidFields = [
        '',
        '123invalid',
        'invalid-name',
        'invalid space',
        'invalid@symbol',
        'args.',
        'args.123invalid'
      ];

      invalidFields.forEach(field => {
        const filters: EventFilters = { [field]: 'test' };
        const result = validator.validateFilters(filters);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.message.includes('Invalid parameter name'))).toBe(true);
      });
    });
  });
});