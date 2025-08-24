import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PromptService, PromptTemplate, PromptContext } from '../prompt.service';
import { LoggerService } from '../../../../common/services/logger.service';

describe('PromptService', () => {
  let service: PromptService;
  let configService: jest.Mocked<ConfigService>;
  let loggerService: jest.Mocked<LoggerService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    const mockLoggerService = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    service = module.get<PromptService>(PromptService);
    configService = module.get(ConfigService);
    loggerService = module.get(LoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialization', () => {
    it('should initialize with default templates', () => {
      const templates = service.listTemplates();
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.id === 'email-classification')).toBe(true);
      expect(templates.some(t => t.id === 'extraction-generic')).toBe(true);
      expect(templates.some(t => t.id === 'extraction-invoice')).toBe(true);
    });

    it('should log initialization', () => {
      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('Initialized'),
        'PromptService'
      );
    });
  });

  describe('getClassificationPrompt', () => {
    it('should generate classification prompt', () => {
      const context: PromptContext = {
        emailSubject: 'Invoice #12345',
        emailFrom: 'billing@company.com',
        emailBody: 'Please find attached invoice for services rendered.',
      };

      const prompt = service.getClassificationPrompt(context);

      expect(prompt).toContain('Invoice #12345');
      expect(prompt).toContain('billing@company.com');
      expect(prompt).toContain('Please find attached invoice');
      expect(prompt).toContain('JSON object');
    });

    it('should handle missing context values', () => {
      const context: PromptContext = {
        emailSubject: 'Test Subject',
        // Missing emailFrom and emailBody
      };

      const prompt = service.getClassificationPrompt(context);

      expect(prompt).toContain('Test Subject');
      expect(prompt).not.toContain('undefined');
      expect(prompt).not.toContain('null');
    });

    it('should throw error if template not found', () => {
      // Mock a service without the classification template
      const emptyService = new PromptService(configService, loggerService);
      (emptyService as any).templates.clear();

      const context: PromptContext = { emailSubject: 'Test' };

      expect(() => emptyService.getClassificationPrompt(context))
        .toThrow('Classification prompt template not found');
    });
  });

  describe('getExtractionPrompt', () => {
    it('should generate extraction prompt for specific category', () => {
      const context: PromptContext = {
        emailSubject: 'Invoice #12345',
        emailFrom: 'billing@company.com',
        emailBody: 'Invoice for $500.00',
      };

      const prompt = service.getExtractionPrompt('invoice', context);

      expect(prompt).toContain('Invoice #12345');
      expect(prompt).toContain('billing@company.com');
      expect(prompt).toContain('Invoice for $500.00');
      expect(prompt).toContain('invoiceNumber');
      expect(prompt).toContain('amount');
    });

    it('should fall back to generic template for unknown category', () => {
      const context: PromptContext = {
        emailSubject: 'Unknown Category Email',
        emailFrom: 'sender@example.com',
        emailBody: 'Some content',
      };

      const prompt = service.getExtractionPrompt('unknown-category', context);

      expect(prompt).toContain('Unknown Category Email');
      expect(prompt).toContain('unknown-category');
      expect(prompt).toContain('Extract structured data');
    });

    it('should throw error if no template found', () => {
      // Mock a service without templates
      const emptyService = new PromptService(configService, loggerService);
      (emptyService as any).templates.clear();

      const context: PromptContext = { emailSubject: 'Test' };

      expect(() => emptyService.getExtractionPrompt('invoice', context))
        .toThrow('Extraction prompt template not found for category: invoice');
    });
  });

  describe('template management', () => {
    it('should add custom template', () => {
      const customTemplate: PromptTemplate = {
        id: 'custom-template',
        name: 'Custom Template',
        description: 'A custom template for testing',
        template: 'Custom prompt with {{variable}}',
        variables: ['variable'],
        category: 'general',
        version: '1.0',
      };

      service.addTemplate(customTemplate);

      const retrieved = service.getTemplate('custom-template');
      expect(retrieved).toEqual(customTemplate);
      expect(loggerService.log).toHaveBeenCalledWith(
        'Added prompt template: custom-template',
        'PromptService'
      );
    });

    it('should get template by ID', () => {
      const template = service.getTemplate('email-classification');
      
      expect(template).toBeDefined();
      expect(template!.id).toBe('email-classification');
      expect(template!.category).toBe('classification');
    });

    it('should return undefined for non-existent template', () => {
      const template = service.getTemplate('non-existent-template');
      expect(template).toBeUndefined();
    });

    it('should list all templates', () => {
      const templates = service.listTemplates();
      
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every(t => t.id && t.name && t.template)).toBe(true);
    });
  });

  describe('template rendering', () => {
    it('should render template with all variables', () => {
      const customTemplate: PromptTemplate = {
        id: 'test-template',
        name: 'Test Template',
        description: 'Test template',
        template: 'Hello {{name}}, your {{item}} costs {{price}}',
        variables: ['name', 'item', 'price'],
        category: 'general',
        version: '1.0',
      };

      service.addTemplate(customTemplate);

      const context: PromptContext = {
        name: 'John',
        item: 'laptop',
        price: '$1000',
      };

      // Access private method for testing
      const rendered = (service as any).renderTemplate(customTemplate, context);

      expect(rendered).toBe('Hello John, your laptop costs $1000');
    });

    it('should handle missing variables gracefully', () => {
      const customTemplate: PromptTemplate = {
        id: 'test-template',
        name: 'Test Template',
        description: 'Test template',
        template: 'Hello {{name}}, your {{item}} costs {{price}}',
        variables: ['name', 'item', 'price'],
        category: 'general',
        version: '1.0',
      };

      service.addTemplate(customTemplate);

      const context: PromptContext = {
        name: 'John',
        // Missing item and price
      };

      const rendered = (service as any).renderTemplate(customTemplate, context);

      expect(rendered).toBe('Hello John, your  costs ');
    });

    it('should handle multiple occurrences of same variable', () => {
      const customTemplate: PromptTemplate = {
        id: 'test-template',
        name: 'Test Template',
        description: 'Test template',
        template: '{{name}} said "Hello {{name}}" to {{name}}',
        variables: ['name'],
        category: 'general',
        version: '1.0',
      };

      service.addTemplate(customTemplate);

      const context: PromptContext = {
        name: 'Alice',
      };

      const rendered = (service as any).renderTemplate(customTemplate, context);

      expect(rendered).toBe('Alice said "Hello Alice" to Alice');
    });

    it('should handle special characters in variables', () => {
      const customTemplate: PromptTemplate = {
        id: 'test-template',
        name: 'Test Template',
        description: 'Test template',
        template: 'Message: {{message}}',
        variables: ['message'],
        category: 'general',
        version: '1.0',
      };

      service.addTemplate(customTemplate);

      const context: PromptContext = {
        message: 'Hello $world! (test) [array]',
      };

      const rendered = (service as any).renderTemplate(customTemplate, context);

      expect(rendered).toBe('Message: Hello $world! (test) [array]');
    });
  });

  describe('edge cases', () => {
    it('should handle empty context', () => {
      const context: PromptContext = {};

      const prompt = service.getClassificationPrompt(context);

      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should handle null and undefined values in context', () => {
      const context: PromptContext = {
        emailSubject: null as any,
        emailFrom: undefined,
        emailBody: 'Valid body',
      };

      const prompt = service.getClassificationPrompt(context);

      expect(prompt).toContain('Valid body');
      expect(prompt).not.toContain('null');
      expect(prompt).not.toContain('undefined');
    });

    it('should handle very long context values', () => {
      const longText = 'A'.repeat(10000);
      const context: PromptContext = {
        emailSubject: 'Test',
        emailFrom: 'test@example.com',
        emailBody: longText,
      };

      const prompt = service.getClassificationPrompt(context);

      expect(prompt).toContain(longText);
      expect(typeof prompt).toBe('string');
    });
  });
});