import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ErrorHandlerService } from '../services/error-handler.service';

/**
 * @class ErrorHandlingInterceptor
 * @purpose Interceptor for handling errors in controllers
 */
@Injectable()
export class ErrorHandlingInterceptor implements NestInterceptor {
  constructor(private errorHandler: ErrorHandlerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      catchError(error => {
        // Extract context from request
        const errorContext = {
          userId: user?.id,
          operation: `${request.method} ${request.url}`,
          resource: this.extractResourceFromUrl(request.url),
          metadata: {
            userAgent: request.headers['user-agent'],
            ip: request.ip,
            requestId: request.headers['x-request-id'],
          },
        };

        // Handle error asynchronously (don't block response)
        this.errorHandler.handleError(error, errorContext, {
          shouldLog: true,
          shouldNotify: false, // Don't notify for controller errors (handled by global filter)
        }).catch(handlingError => {
          console.error('Error in error handler:', handlingError);
        });

        return throwError(() => error);
      })
    );
  }

  /**
   * @method extractResourceFromUrl
   * @purpose Extract resource name from URL
   */
  private extractResourceFromUrl(url: string): string {
    const pathParts = url.split('/').filter(part => part && !part.match(/^\d+$/));
    return pathParts[pathParts.length - 1] || 'unknown';
  }
}