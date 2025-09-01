// FilterValidator implementation
import type { EventFilters, FilterExpression } from '../types';
import type { ValidationResult, ValidationError } from '../types/common';
import type { IFilterValidator } from './interfaces';

export class FilterValidator implements IFilterValidator {
  private readonly VALID_OPERATORS = ['eq', 'ne', 'gt', 'lt', 'in', 'contains'];
  private readonly VALID_EVENT_FIELDS = [
    'contractAddress',
    'eventName', 
    'blockNumber',
    'transactionHash',
    'logIndex',
    'timestamp'
  ];

  /**
   * Validates a complete set of event filters
   * @param filters The filters to validate
   * @returns Validation result with any errors found
   */
  validateFilters(filters: EventFilters): ValidationResult {
    const errors: ValidationError[] = [];

    if (!filters || typeof filters !== 'object') {
      errors.push({
        field: 'filters',
        message: 'Filters must be a valid object',
        value: filters
      });
      return { isValid: false, errors };
    }

    // Validate each filter entry
    for (const [paramName, filterValue] of Object.entries(filters)) {
      const paramErrors = this.validateFilterParam(paramName, filterValue);
      errors.push(...paramErrors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates a single filter parameter
   * @param paramName The parameter name
   * @param filterValue The filter value or expression
   * @returns Array of validation errors
   */
  private validateFilterParam(
    paramName: string,
    filterValue: string | number | string[] | FilterExpression
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate parameter name
    if (!this.isValidParameterName(paramName)) {
      errors.push({
        field: paramName,
        message: 'Invalid parameter name. Must be a valid event field or start with "args."',
        value: paramName
      });
    }

    // Validate filter value
    if (filterValue === null || filterValue === undefined) {
      errors.push({
        field: paramName,
        message: 'Filter value cannot be null or undefined',
        value: filterValue
      });
      return errors;
    }

    // Handle different filter value types
    if (typeof filterValue === 'string' || typeof filterValue === 'number') {
      // Simple equality filters are always valid
      return errors;
    }

    if (Array.isArray(filterValue)) {
      const arrayErrors = this.validateArrayFilter(paramName, filterValue);
      errors.push(...arrayErrors);
      return errors;
    }

    if (this.isFilterExpression(filterValue)) {
      const expressionResult = this.validateFilterExpression(filterValue);
      if (!expressionResult.isValid) {
        errors.push(...expressionResult.errors.map(error => ({
          ...error,
          field: `${paramName}.${error.field}`
        })));
      }
      return errors;
    }

    errors.push({
      field: paramName,
      message: 'Invalid filter value type. Must be string, number, array, or FilterExpression',
      value: filterValue
    });

    return errors;
  }

  /**
   * Validates a filter expression
   * @param expression The filter expression to validate
   * @returns Validation result
   */
  validateFilterExpression(expression: FilterExpression): ValidationResult {
    const errors: ValidationError[] = [];

    if (!expression || typeof expression !== 'object') {
      errors.push({
        field: 'expression',
        message: 'Filter expression must be a valid object',
        value: expression
      });
      return { isValid: false, errors };
    }

    // Validate operator
    if (!expression.operator) {
      errors.push({
        field: 'operator',
        message: 'Filter expression must have an operator',
        value: expression.operator
      });
    } else if (!this.VALID_OPERATORS.includes(expression.operator)) {
      errors.push({
        field: 'operator',
        message: `Invalid operator. Must be one of: ${this.VALID_OPERATORS.join(', ')}`,
        value: expression.operator
      });
    }

    // Validate value
    if (expression.value === undefined) {
      errors.push({
        field: 'value',
        message: 'Filter expression must have a value',
        value: expression.value
      });
    } else {
      const valueErrors = this.validateFilterValue(expression.operator, expression.value);
      errors.push(...valueErrors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates a filter value based on the operator
   * @param operator The filter operator
   * @param value The filter value
   * @returns Array of validation errors
   */
  private validateFilterValue(operator: string, value: any): ValidationError[] {
    const errors: ValidationError[] = [];

    switch (operator) {
      case 'eq':
      case 'ne':
        // Any value type is valid for equality operators
        break;

      case 'gt':
      case 'lt':
        if (!this.isComparableValue(value)) {
          errors.push({
            field: 'value',
            message: 'Value for gt/lt operators must be a number, string, or BigNumber',
            value
          });
        }
        break;

      case 'in':
        if (!Array.isArray(value)) {
          errors.push({
            field: 'value',
            message: 'Value for "in" operator must be an array',
            value
          });
        } else if (value.length === 0) {
          errors.push({
            field: 'value',
            message: 'Array for "in" operator cannot be empty',
            value
          });
        }
        break;

      case 'contains':
        if (typeof value !== 'string' && !Array.isArray(value)) {
          errors.push({
            field: 'value',
            message: 'Value for "contains" operator must be a string or array',
            value
          });
        }
        break;
    }

    return errors;
  }

  /**
   * Validates an array filter (implicit 'in' operation)
   * @param paramName The parameter name
   * @param filterArray The filter array
   * @returns Array of validation errors
   */
  private validateArrayFilter(paramName: string, filterArray: any[]): ValidationError[] {
    const errors: ValidationError[] = [];

    if (filterArray.length === 0) {
      errors.push({
        field: paramName,
        message: 'Filter array cannot be empty',
        value: filterArray
      });
    }

    // Validate that all array elements are of compatible types
    const types = new Set(filterArray.map(item => typeof item));
    if (types.size > 1 && !(types.has('string') && types.has('number'))) {
      errors.push({
        field: paramName,
        message: 'All elements in filter array must be of the same type (or string/number mix)',
        value: filterArray
      });
    }

    return errors;
  }

  /**
   * Checks if a parameter name is valid
   * @param paramName The parameter name to validate
   * @returns true if valid, false otherwise
   */
  private isValidParameterName(paramName: string): boolean {
    if (!paramName || typeof paramName !== 'string') {
      return false;
    }

    // Check if it's a valid event field
    if (this.VALID_EVENT_FIELDS.includes(paramName)) {
      return true;
    }

    // Check if it's an args field (starts with 'args.')
    if (paramName.startsWith('args.')) {
      const argName = paramName.substring(5);
      return argName.length > 0 && this.isValidArgName(argName);
    }

    // For backward compatibility, allow direct arg names
    return this.isValidArgName(paramName);
  }

  /**
   * Checks if an argument name is valid
   * @param argName The argument name to validate
   * @returns true if valid, false otherwise
   */
  private isValidArgName(argName: string): boolean {
    // Allow alphanumeric characters, underscores, and dots for nested access
    return /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(argName);
  }

  /**
   * Checks if a value can be used in comparison operations
   * @param value The value to check
   * @returns true if comparable, false otherwise
   */
  private isComparableValue(value: any): boolean {
    return (
      typeof value === 'number' ||
      typeof value === 'string' ||
      typeof value === 'bigint' ||
      this.isBigNumber(value)
    );
  }

  /**
   * Checks if a value is a BigNumber-like object
   * @param value The value to check
   * @returns true if it's a BigNumber, false otherwise
   */
  private isBigNumber(value: any): boolean {
    return value && (
      typeof value.toString === 'function' && 
      (value._isBigNumber || value._hex !== undefined)
    );
  }

  /**
   * Checks if a value is a filter expression
   * @param value The value to check
   * @returns true if it's a FilterExpression, false otherwise
   */
  private isFilterExpression(value: any): value is FilterExpression {
    return value && typeof value === 'object' && 'operator' in value && 'value' in value;
  }
}