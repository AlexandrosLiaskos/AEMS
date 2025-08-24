import { Test, TestingModule } from '@nestjs/testing';
import { ErrorHandlerService, ErrorContext, ErrorHandlingOptions } from '../error-handler.service';
import { LoggerService } from '../logger.service';
import { EventService } from '../event.service';
import { 
  ValidationError, 
  ExternalServiceError, 
  DatabaseError,
  GmailApiError,
  OpenAIApiError 
} from '../../errors/custom-errors';

describe('ErrorHandlerService', () => {
  let service: ErrorHandlerService;
  let loggerService: jest.Mocked<LoggerService>;
  let eventService: jest.Mocked<EventService>;

  beforeEach(async () => {
    const mockLoggerService = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    };

    const mockEventService = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErrorHandlerService,
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: EventService, useValue: mockEventService },
      ],
    }).compile();

    service = module.get<ErrorHandlerService>(ErrorHandlerService);
    loggerService = module.get(LoggerService);
    eventService = module.get(EventService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleError', () => {
    it('should handle error with default options', async () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        userId: 'user-123',
        operation: 'test-operation',
      };

      await service.handleError(error, context);

      expect(loggerService.error).toHaveBeenCalled();
      expect(eventService.emit).toHaveBeenCalledWith('error.occurred', expect.any(Object));
    });

    it('should not log when shouldLog is false', async () => {
      const error = new Error('Test error');
      const context: ErrorContext = { userId: 'user-123' };
      const options: ErrorHandlingOptions = { shouldLog: false };

      await service.handleError(error, context, options);

      expect(loggerService.error).not.toHaveBeenCalled();
      expect(eventService.emit).toHaveBeenCalled();
    });

    it('should emit notification when shouldNotify is true', async () => {
      const error = new Error('Test error');
      const context: ErrorContext = { userId: 'user-123' };
      const options: ErrorHandlingOptions = { shouldNotify: true };

      await service.handleError(error, context, options);

      expect(eventService.emit).toHaveBeenCalledWith('user.notification', expect.any(Object));
    });
  });

  describe('handleAsyncError', () => {
    it('should execute operation successfully', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const context: ErrorContext = { userId: 'user-123' };

      const result = await service.handleAsyncError(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should handle error and return fallback value', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));
      const context: ErrorContext = { userId: 'user-123' };
      const options: ErrorHandlingOptions = { fallbackValue: 'fallback' };

      const result = await service.handleAsyncError(operation, context, options);

      expect(result).toBe('fallback');
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should throw error when no fallback value', async () => {
      const error = new Error('Test error');
      const operation = jest.fn().mockRejectedValue(error);
      const context: ErrorContext = { userId: 'user-123' };

      await expect(service.handleAsyncError(operation, context)).rejects.toThrow(error);
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const context: ErrorContext = { userId: 'user-123' };

      const result = await service.withRetry(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new ExternalServiceError('Test', 'Temporary error'))
        .mockResolvedValue('success');
      
      const context: ErrorContext = { userId: 'user-123' };

      const result = await service.withRetry(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(loggerService.warn).toHaveBeenCalled();
    });

    it('should not retry on non-retryable error', async () => {
      const error = new ValidationError('Invalid input');
      const operation = jest.fn().mockRejectedValue(error);
      const context: ErrorContext = { userId: 'user-123' };

      await expect(service.withRetry(operation, context)).rejects.toThrow(error);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries and throw error', async () => {
      const error = new ExternalServiceError('Test', 'Persistent error');
      const operation = jest.fn().mockRejectedValue(error);
      const context: ErrorContext = { userId: 'user-123' };
      const retryConfig = { maxAttempts: 2 };

      await expect(service.withRetry(operation, context, retryConfig)).rejects.toThrow(error);
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('wrapExternalService', () => {
    it('should wrap successful external service call', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const context: ErrorContext = { userId: 'user-123' };

      const result = await service.wrapExternalService('TestService', operation, context);

      expect(result).toBe('success');
    });

    it('should convert error to ExternalServiceError', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Service error'));
      const context: ErrorContext = { userId: 'user-123' };

      await expect(
        service.wrapExternalService('TestService', operation, context)
      ).rejects.toThrow(ExternalServiceError);
    });
  });

  describe('wrapGmailApi', () => {
    it('should convert to GmailApiError', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Gmail error'));
      const context: ErrorContext = { userId: 'user-123' };

      await expect(
        service.wrapGmailApi(operation, context)
      ).rejects.toThrow(GmailApiError);
    });
  });

  describe('wrapOpenAIApi', () => {
    it('should convert to OpenAIApiError', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('OpenAI error'));
      const context: ErrorContext = { userId: 'user-123' };

      await expect(
        service.wrapOpenAIApi(operation, context)
      ).rejects.toThrow(OpenAIApiError);
    });
  });

  describe('wrapDatabaseOperation', () => {
    it('should convert to DatabaseError', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('DB error'));
      const context: ErrorContext = { userId: 'user-123' };

      await expect(
        service.wrapDatabaseOperation('SELECT', operation, context)
      ).rejects.toThrow(DatabaseError);
    });
  });

  describe('getErrorStats', () => {
    it('should return error statistics', () => {
      const stats = service.getErrorStats();

      expect(stats).toHaveProperty('totalErrors');
      expect(stats).toHaveProperty('errorsByType');
      expect(stats).toHaveProperty('recentErrors');
      expect(typeof stats.totalErrors).toBe('number');
    });
  });
});