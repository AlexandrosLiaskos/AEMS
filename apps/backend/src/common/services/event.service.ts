import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { LoggerService } from './logger.service';

/**
 * @interface EventData
 * @purpose Event data structure
 */
export interface EventData {
  type: string;
  payload: any;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * @class EventService
 * @purpose Application event management service
 */
@Injectable()
export class EventService {
  private eventEmitter = new EventEmitter();

  constructor(private logger: LoggerService) {
    this.eventEmitter.setMaxListeners(100);
  }

  /**
   * @method emit
   * @purpose Emit an event
   */
  emit(eventName: string, data: Omit<EventData, 'timestamp'>): void {
    const eventData: EventData = {
      ...data,
      timestamp: new Date(),
    };

    this.eventEmitter.emit(eventName, eventData);
    this.logger.debug(`Event emitted: ${eventName}`, 'EventService');
  }

  /**
   * @method on
   * @purpose Listen to an event
   */
  on(eventName: string, listener: (data: EventData) => void): void {
    this.eventEmitter.on(eventName, listener);
  }

  /**
   * @method once
   * @purpose Listen to an event once
   */
  once(eventName: string, listener: (data: EventData) => void): void {
    this.eventEmitter.once(eventName, listener);
  }

  /**
   * @method off
   * @purpose Remove event listener
   */
  off(eventName: string, listener: (data: EventData) => void): void {
    this.eventEmitter.off(eventName, listener);
  }

  /**
   * @method removeAllListeners
   * @purpose Remove all listeners for an event
   */
  removeAllListeners(eventName?: string): void {
    this.eventEmitter.removeAllListeners(eventName);
  }
}