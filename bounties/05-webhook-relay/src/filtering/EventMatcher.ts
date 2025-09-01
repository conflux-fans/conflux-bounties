// EventMatcher implementation
import type { BlockchainEvent, EventFilters } from '../types';
import type { IEventMatcher, IFilterEngine, IFilterValidator } from './interfaces';
import { FilterEngine } from './FilterEngine';
import { FilterValidator } from './FilterValidator';

export class EventMatcher implements IEventMatcher {
  private readonly filterEngine: IFilterEngine;
  private readonly filterValidator: IFilterValidator;

  constructor(
    filterEngine?: IFilterEngine,
    filterValidator?: IFilterValidator
  ) {
    this.filterEngine = filterEngine || new FilterEngine();
    this.filterValidator = filterValidator || new FilterValidator();
  }

  /**
   * Checks if an event matches the subscription filters
   * @param event The blockchain event to match
   * @param filters The subscription filters to apply
   * @returns true if the event matches all filters, false otherwise
   */
  matchesSubscription(event: BlockchainEvent, filters: EventFilters): boolean {
    // Validate the event first
    if (!this.isValidEvent(event)) {
      return false;
    }

    // Validate the filters
    const validationResult = this.filterValidator.validateFilters(filters);
    if (!validationResult.isValid) {
      // Log validation errors in a real implementation
      console.warn('Invalid filters provided:', validationResult.errors);
      return false;
    }

    // Use the filter engine to evaluate the filters
    return this.filterEngine.evaluateFilters(event, filters);
  }

  /**
   * Validates that an event has all required fields
   * @param event The event to validate
   * @returns true if valid, false otherwise
   */
  private isValidEvent(event: BlockchainEvent): boolean {
    if (!event || typeof event !== 'object') {
      return false;
    }

    // Check required fields
    const requiredFields = [
      'contractAddress',
      'eventName',
      'blockNumber',
      'transactionHash',
      'logIndex',
      'args',
      'timestamp'
    ];

    for (const field of requiredFields) {
      if (!(field in event)) {
        return false;
      }
    }

    // Validate field types
    if (typeof event.contractAddress !== 'string' ||
        typeof event.eventName !== 'string' ||
        typeof event.blockNumber !== 'number' ||
        typeof event.transactionHash !== 'string' ||
        typeof event.logIndex !== 'number' ||
        typeof event.args !== 'object' ||
        !(event.timestamp instanceof Date)) {
      return false;
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(event.contractAddress)) {
      return false;
    }

    // Validate transaction hash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(event.transactionHash)) {
      return false;
    }

    // Validate non-negative numbers
    if (event.blockNumber < 0 || event.logIndex < 0) {
      return false;
    }

    return true;
  }
}