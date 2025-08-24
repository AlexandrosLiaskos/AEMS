import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EnvironmentInitializerService } from '../services/environment-initializer.service';
import { EnvironmentService } from '../services/environment.service';

/**
 * @decorator RequireSetup
 * @purpose Decorator to mark routes that require setup completion
 */
export const RequireSetup = () => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata('require-setup', true, descriptor.value);
    } else {
      Reflect.defineMetadata('require-setup', true, target);
    }
  };
};

/**
 * @decorator AllowIncompleteSetup
 * @purpose Decorator to mark routes that can be accessed even if setup is incomplete
 */
export const AllowIncompleteSetup = () => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata('allow-incomplete-setup', true, descriptor.value);
    } else {
      Reflect.defineMetadata('allow-incomplete-setup', true, target);
    }
  };
};

/**
 * @class SetupCompleteGuard
 * @purpose Guard to ensure setup is complete before accessing protected routes
 */
@Injectable()
export class SetupCompleteGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private environmentInitializer: EnvironmentInitializerService,
    private environmentService: EnvironmentService
  ) {}

  /**
   * @method canActivate
   * @purpose Check if setup is complete or route allows incomplete setup
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const controller = context.getClass();

    // Check if route explicitly allows incomplete setup
    const allowIncompleteSetup = 
      this.reflector.get<boolean>('allow-incomplete-setup', handler) ||
      this.reflector.get<boolean>('allow-incomplete-setup', controller);

    if (allowIncompleteSetup) {
      return true;
    }

    // Check if route explicitly requires setup
    const requireSetup = 
      this.reflector.get<boolean>('require-setup', handler) ||
      this.reflector.get<boolean>('require-setup', controller);

    // If not explicitly marked, allow access (default behavior)
    if (!requireSetup) {
      return true;
    }

    // Check if initialization is complete
    if (!this.environmentInitializer.isInitializationComplete()) {
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Application is still initializing. Please wait a moment and try again.',
          error: 'Initialization In Progress',
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    // Check if setup is complete
    try {
      const setupStatus = await this.environmentService.checkSetupStatus();
      
      if (!setupStatus.isComplete) {
        // Add setup status to request for potential use in error handling
        request.setupStatus = setupStatus;
        
        throw new HttpException(
          {
            statusCode: HttpStatus.PRECONDITION_REQUIRED,
            message: 'Initial setup is required before accessing this resource.',
            error: 'Setup Required',
            setupRequired: true,
            missingFields: setupStatus.missingRequiredFields,
            setupUrl: '/setup',
          },
          HttpStatus.PRECONDITION_REQUIRED
        );
      }

      return true;

    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to verify setup status',
          error: 'Setup Verification Failed',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}