import { Scalar, CustomScalar } from '@nestjs/graphql';
import { ValueNode, Kind } from 'graphql';

/**
 * @class DateTimeScalar
 * @purpose Custom GraphQL scalar for DateTime handling
 */
@Scalar('DateTime', () => Date)
export class DateTimeScalar implements CustomScalar<string, Date> {
  description = 'Date custom scalar type';

  /**
   * @method parseValue
   * @purpose Parse value from client (variables)
   */
  parseValue(value: string): Date {
    if (typeof value !== 'string') {
      throw new Error('DateTime must be a string');
    }

    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid DateTime format');
    }

    return date;
  }

  /**
   * @method serialize
   * @purpose Serialize value to send to client
   */
  serialize(value: Date | string): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'string') {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid DateTime format');
      }
      return date.toISOString();
    }

    throw new Error('DateTime must be a Date object or string');
  }

  /**
   * @method parseLiteral
   * @purpose Parse literal value from query
   */
  parseLiteral(ast: ValueNode): Date {
    if (ast.kind !== Kind.STRING) {
      throw new Error('DateTime must be a string literal');
    }

    const date = new Date(ast.value);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid DateTime format');
    }

    return date;
  }
}