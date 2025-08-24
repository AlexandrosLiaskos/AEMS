import { Injectable } from '@nestjs/common';

/**
 * @class DateService
 * @purpose Date and time utilities service
 */
@Injectable()
export class DateService {
  /**
   * @method now
   * @purpose Get current date
   */
  now(): Date {
    return new Date();
  }

  /**
   * @method formatDate
   * @purpose Format date to string
   */
  formatDate(date: Date, format: string = 'YYYY-MM-DD'): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', year.toString())
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  /**
   * @method addDays
   * @purpose Add days to date
   */
  addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * @method isExpired
   * @purpose Check if date is expired
   */
  isExpired(date: Date): boolean {
    return date < new Date();
  }

  /**
   * @method getTimestamp
   * @purpose Get Unix timestamp
   */
  getTimestamp(date?: Date): number {
    return (date || new Date()).getTime();
  }
}