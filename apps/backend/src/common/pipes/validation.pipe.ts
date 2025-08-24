import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { ValidationError } from '../errors/custom-errors';

/**
 * @class CustomValidationPipe
 * @purpose Enhanced validation pipe with custom error handling
 */
@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToClass(metatype, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validateCustomDecorators: true,
    });

    if (errors.length > 0) {
      const validationErrors = this.formatErrors(errors);
      throw new ValidationError('Validation failed', { validationErrors });
    }

    return object;
  }

  /**
   * @method toValidate
   * @purpose Check if type should be validated
   */
  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  /**
   * @method formatErrors
   * @purpose Format validation errors
   */
  private formatErrors(errors: any[]): Array<{
    field: string;
    value: any;
    constraints: Record<string, string>;
    children?: any[];
  }> {
    return errors.map(error => ({
      field: error.property,
      value: error.value,
      constraints: error.constraints || {},
      children: error.children?.length > 0 ? this.formatErrors(error.children) : undefined,
    }));
  }
}