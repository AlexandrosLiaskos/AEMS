import { Scalar, CustomScalar } from '@nestjs/graphql';
import { ValueNode, Kind } from 'graphql';

/**
 * @class JSONScalar
 * @purpose Custom GraphQL scalar for JSON handling
 */
@Scalar('JSON')
export class JSONScalar implements CustomScalar<any, any> {
  description = 'JSON custom scalar type';

  /**
   * @method parseValue
   * @purpose Parse value from client (variables)
   */
  parseValue(value: any): any {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        throw new Error('Invalid JSON format');
      }
    }

    return value;
  }

  /**
   * @method serialize
   * @purpose Serialize value to send to client
   */
  serialize(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'object') {
      try {
        // Ensure the object can be serialized
        JSON.stringify(value);
        return value;
      } catch (error) {
        throw new Error('Cannot serialize circular JSON');
      }
    }

    return value;
  }

  /**
   * @method parseLiteral
   * @purpose Parse literal value from query
   */
  parseLiteral(ast: ValueNode): any {
    switch (ast.kind) {
      case Kind.STRING:
        try {
          return JSON.parse(ast.value);
        } catch (error) {
          return ast.value;
        }
      case Kind.INT:
        return parseInt(ast.value, 10);
      case Kind.FLOAT:
        return parseFloat(ast.value);
      case Kind.BOOLEAN:
        return ast.value;
      case Kind.NULL:
        return null;
      case Kind.OBJECT:
        return this.parseObject(ast);
      case Kind.LIST:
        return ast.values.map(value => this.parseLiteral(value));
      default:
        throw new Error(`Unsupported literal type: ${ast.kind}`);
    }
  }

  /**
   * @method parseObject
   * @purpose Parse object literal
   */
  private parseObject(ast: any): any {
    const result = {};
    
    ast.fields.forEach((field: any) => {
      result[field.name.value] = this.parseLiteral(field.value);
    });

    return result;
  }
}