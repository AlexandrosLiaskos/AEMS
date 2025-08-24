import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserRole, User } from '../../../database/entities/user.entity';
import { LoggerService } from '../../../common/services/logger.service';

/**
 * @decorator Roles
 * @purpose Decorator to specify required roles for a route/resolver
 */
export const Roles = (...roles: UserRole[]) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata('roles', roles, descriptor?.value || target);
  };
};

/**
 * @class RolesGuard
 * @purpose Role-based access control guard
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private logger: LoggerService
  ) {}

  /**
   * @method canActivate
   * @purpose Check if user has required roles
   */
  canActivate(context: ExecutionContext): boolean {
    // Get required roles from metadata
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get user from request
    const user = this.getUser(context);

    if (!user) {
      this.logger.warn('Roles guard: No user found in request', 'RolesGuard');
      throw new ForbiddenException('Authentication required');
    }

    // Check if user has any of the required roles
    const hasRole = requiredRoles.some(role => user.role === role);

    if (!hasRole) {
      this.logger.warn(
        `Access denied: User ${user.id} (${user.role}) attempted to access resource requiring roles: ${requiredRoles.join(', ')}`,
        'RolesGuard',
        {
          userId: user.id,
          userRole: user.role,
          requiredRoles,
          resource: context.getHandler().name,
        }
      );

      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`
      );
    }

    this.logger.debug(
      `Access granted: User ${user.id} (${user.role}) accessing resource requiring roles: ${requiredRoles.join(', ')}`,
      'RolesGuard'
    );

    return true;
  }

  /**
   * @method getUser
   * @purpose Extract user from execution context (supports both HTTP and GraphQL)
   */
  private getUser(context: ExecutionContext): User | null {
    const contextType = context.getType<string>();

    if (contextType === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      return gqlContext.getContext().req.user;
    }

    const request = context.switchToHttp().getRequest();
    return request.user;
  }
}

/**
 * @decorator RequireRoles
 * @purpose Convenience decorator that combines @UseGuards and @Roles
 */
export const RequireRoles = (...roles: UserRole[]) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    // Apply roles metadata
    Roles(...roles)(target, propertyKey, descriptor);
    
    // Note: @UseGuards(RolesGuard) should be applied separately at the class or method level
  };
};

/**
 * @decorator AdminOnly
 * @purpose Convenience decorator for admin-only access
 */
export const AdminOnly = () => RequireRoles(UserRole.ADMIN);

/**
 * @decorator UserOrAdmin
 * @purpose Convenience decorator for user or admin access
 */
export const UserOrAdmin = () => RequireRoles(UserRole.USER, UserRole.ADMIN);