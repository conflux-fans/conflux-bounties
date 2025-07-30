// FilterEngine implementation
import type { BlockchainEvent, EventFilters, FilterExpression } from '../types';
import type { IFilterEngine } from './interfaces';

export class FilterEngine implements IFilterEngine {
  /**
   * Evaluates all filters against a blockchain event
   * @param event The blockchain event to evaluate
   * @param filters The filters to apply
   * @returns true if the event matches all filters, false otherwise
   */
  evaluateFilters(event: BlockchainEvent, filters: EventFilters): boolean {
    // If no filters are provided, the event matches
    if (!filters || Object.keys(filters).length === 0) {
      return true;
    }

    // All filters must pass for the event to match
    for (const [paramName, filterValue] of Object.entries(filters)) {
      if (!this.evaluateFilter(event, paramName, filterValue)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluates a single filter against an event parameter
   * @param event The blockchain event
   * @param paramName The parameter name to filter on
   * @param filterValue The filter value or expression
   * @returns true if the filter matches, false otherwise
   */
  private evaluateFilter(
    event: BlockchainEvent,
    paramName: string,
    filterValue: string | number | string[] | FilterExpression
  ): boolean {
    const eventValue = this.getEventValue(event, paramName);

    // Handle simple equality filters (string, number, or array)
    if (typeof filterValue === 'string' || typeof filterValue === 'number') {
      return this.evaluateOperator('eq', eventValue, filterValue);
    }

    // Handle array filters (implicit 'in' operation)
    if (Array.isArray(filterValue)) {
      return this.evaluateOperator('in', eventValue, filterValue);
    }

    // Handle complex filter expressions
    if (this.isFilterExpression(filterValue)) {
      return this.evaluateOperator(filterValue.operator, eventValue, filterValue.value);
    }

    return false;
  }

  /**
   * Gets the value from an event for a given parameter name
   * @param event The blockchain event
   * @param paramName The parameter name (supports dot notation)
   * @returns The parameter value
   */
  private getEventValue(event: BlockchainEvent, paramName: string): any {
    // Handle special event properties
    if (paramName === 'contractAddress') return event.contractAddress;
    if (paramName === 'eventName') return event.eventName;
    if (paramName === 'blockNumber') return event.blockNumber;
    if (paramName === 'transactionHash') return event.transactionHash;
    if (paramName === 'logIndex') return event.logIndex;
    if (paramName === 'timestamp') return event.timestamp;

    // Handle event args with dot notation support
    if (paramName.startsWith('args.')) {
      const argName = paramName.substring(5);
      return this.getNestedValue(event.args, argName);
    }

    // Default to args for backward compatibility
    return event.args[paramName];
  }

  /**
   * Gets nested values using dot notation
   * @param obj The object to traverse
   * @param path The dot-separated path
   * @returns The nested value or undefined
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Evaluates a filter operator against two values
   * @param operator The filter operator
   * @param eventValue The value from the event
   * @param filterValue The filter comparison value
   * @returns true if the operation passes, false otherwise
   */
  private evaluateOperator(
    operator: string,
    eventValue: any,
    filterValue: any
  ): boolean {
    switch (operator) {
      case 'eq':
        return this.isEqual(eventValue, filterValue);
      
      case 'ne':
        return !this.isEqual(eventValue, filterValue);
      
      case 'gt':
        return this.isGreaterThan(eventValue, filterValue);
      
      case 'lt':
        return this.isLessThan(eventValue, filterValue);
      
      case 'in':
        return this.isIn(eventValue, filterValue);
      
      case 'contains':
        return this.contains(eventValue, filterValue);
      
      default:
        return false;
    }
  }

  /**
   * Checks if two values are equal (handles different types)
   */
  private isEqual(eventValue: any, filterValue: any): boolean {
    // Handle null/undefined cases
    if (eventValue == null || filterValue == null) {
      return eventValue === filterValue;
    }

    // Handle string comparison (case-insensitive for addresses)
    if (typeof eventValue === 'string' && typeof filterValue === 'string') {
      // Ethereum addresses should be case-insensitive
      if (this.isEthereumAddress(eventValue) || this.isEthereumAddress(filterValue)) {
        return eventValue.toLowerCase() === filterValue.toLowerCase();
      }
      return eventValue === filterValue;
    }

    // Handle BigNumber/BigInt comparison
    if (this.isBigNumber(eventValue) || this.isBigNumber(filterValue)) {
      return this.compareBigNumbers(eventValue, filterValue) === 0;
    }

    return eventValue === filterValue;
  }

  /**
   * Checks if eventValue is greater than filterValue
   */
  private isGreaterThan(eventValue: any, filterValue: any): boolean {
    if (this.isBigNumber(eventValue) || this.isBigNumber(filterValue)) {
      return this.compareBigNumbers(eventValue, filterValue) > 0;
    }
    
    if (typeof eventValue === 'number' && typeof filterValue === 'number') {
      return eventValue > filterValue;
    }
    
    if (typeof eventValue === 'string' && typeof filterValue === 'string') {
      return eventValue > filterValue;
    }
    
    return false;
  }

  /**
   * Checks if eventValue is less than filterValue
   */
  private isLessThan(eventValue: any, filterValue: any): boolean {
    if (this.isBigNumber(eventValue) || this.isBigNumber(filterValue)) {
      return this.compareBigNumbers(eventValue, filterValue) < 0;
    }
    
    if (typeof eventValue === 'number' && typeof filterValue === 'number') {
      return eventValue < filterValue;
    }
    
    if (typeof eventValue === 'string' && typeof filterValue === 'string') {
      return eventValue < filterValue;
    }
    
    return false;
  }

  /**
   * Checks if eventValue is in the filterValue array
   */
  private isIn(eventValue: any, filterValue: any): boolean {
    if (!Array.isArray(filterValue)) {
      return false;
    }
    
    return filterValue.some(item => this.isEqual(eventValue, item));
  }

  /**
   * Checks if eventValue contains filterValue (for strings and arrays)
   */
  private contains(eventValue: any, filterValue: any): boolean {
    if (typeof eventValue === 'string' && typeof filterValue === 'string') {
      return eventValue.toLowerCase().includes(filterValue.toLowerCase());
    }
    
    if (Array.isArray(eventValue)) {
      return eventValue.some(item => this.isEqual(item, filterValue));
    }
    
    return false;
  }

  /**
   * Checks if a value is a filter expression
   */
  private isFilterExpression(value: any): value is FilterExpression {
    return value && typeof value === 'object' && 'operator' in value && 'value' in value;
  }

  /**
   * Checks if a string looks like an Ethereum address
   */
  private isEthereumAddress(value: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(value);
  }

  /**
   * Checks if a value is a BigNumber-like object
   */
  private isBigNumber(value: any): boolean {
    return value && (
      typeof value.toString === 'function' && 
      (value._isBigNumber || value._hex !== undefined || typeof value === 'bigint')
    );
  }

  /**
   * Compares two potentially BigNumber values
   * @returns -1 if a < b, 0 if a === b, 1 if a > b
   */
  private compareBigNumbers(a: any, b: any): number {
    const aStr = this.isBigNumber(a) ? a.toString() : String(a);
    const bStr = this.isBigNumber(b) ? b.toString() : String(b);
    
    const aBig = BigInt(aStr);
    const bBig = BigInt(bStr);
    
    if (aBig < bBig) return -1;
    if (aBig > bBig) return 1;
    return 0;
  }
}