// Filtering system interfaces
import type { BlockchainEvent, EventFilters, FilterExpression } from '../types';
import type { ValidationResult } from '../types/common';

export interface IFilterEngine {
  evaluateFilters(event: BlockchainEvent, filters: EventFilters): boolean;
}

export interface IFilterValidator {
  validateFilters(filters: EventFilters): ValidationResult;
  validateFilterExpression(expression: FilterExpression): ValidationResult;
}

export interface IEventMatcher {
  matchesSubscription(event: BlockchainEvent, filters: EventFilters): boolean;
}

export interface FilterContext {
  event: BlockchainEvent;
  paramName: string;
  paramValue: any;
}