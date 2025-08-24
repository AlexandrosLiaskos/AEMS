import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

// Services
import { LoggerService } from '../../../common/services/logger.service';

/**
 * @interface CompletionRequest
 * @purpose OpenAI completion request interface
 */
export interface CompletionRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  user?: string;
}

/**
 * @interface CompletionResponse
 * @purpose OpenAI completion response interface
 */
export interface CompletionResponse {
  content: string;
  finishReason: string;
  tokensUsed: number;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  model: string;
  requestId: string;
}

/**
 * @interface ChatMessage
 * @purpose Chat message interface
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * @interface ChatCompletionRequest
 * @purpose Chat completion request interface
 */
export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  user?: string;
}

/**
 * @class OpenAIService
 * @purpose OpenAI API integration service
 */
@Injectable()
export class OpenAIService {
  private readonly openai: OpenAI;
  private readonly defaultModel: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  // Token pricing (per 1K tokens) - update these based on current OpenAI pricing
  private readonly tokenPricing = {
    'gpt-3.5-turbo': { prompt: 0.0015, completion: 0.002 },
    'gpt-3.5-turbo-16k': { prompt: 0.003, completion: 0.004 },
    'gpt-4': { prompt: 0.03, completion: 0.06 },
    'gpt-4-32k': { prompt: 0.06, completion: 0.12 },
  };

  constructor(
    private configService: ConfigService,
    private logger: LoggerService
  ) {
    const apiKey = this.configService.get<string>('ai.openaiApiKey');
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.openai = new OpenAI({
      apiKey,
      timeout: this.configService.get<number>('ai.openaiTimeout', 30000),
      maxRetries: this.configService.get<number>('ai.openaiMaxRetries', 3),
    });

    this.defaultModel = this.configService.get<string>('ai.openaiModel', 'gpt-3.5-turbo');
    this.maxTokens = this.configService.get<number>('ai.openaiMaxTokens', 1000);
    this.temperature = this.configService.get<number>('ai.openaiTemperature', 0.3);
    this.timeout = this.configService.get<number>('ai.openaiTimeout', 30000);
    this.maxRetries = this.configService.get<number>('ai.openaiMaxRetries', 3);
    this.retryDelay = this.configService.get<number>('ai.openaiRetryDelay', 2000);
  }

  /**
   * @method complete
   * @purpose Generate text completion using OpenAI
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();

    try {
      const model = request.model || this.defaultModel;
      
      this.logger.debug(
        `Starting OpenAI completion with model ${model}`,
        'OpenAIService',
        { model, promptLength: request.prompt.length }
      );

      // Convert to chat format for newer models
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: request.prompt,
        },
      ];

      const response = await this.chatCompletion({
        messages,
        model,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        topP: request.topP,
        frequencyPenalty: request.frequencyPenalty,
        presencePenalty: request.presencePenalty,
        stop: request.stop,
        user: request.user,
      });

      const duration = Date.now() - startTime;
      
      this.logger.debug(
        `OpenAI completion completed in ${duration}ms`,
        'OpenAIService',
        {
          model,
          tokensUsed: response.tokensUsed,
          cost: response.cost,
          duration,
        }
      );

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error(
        `OpenAI completion failed after ${duration}ms`,
        error.stack,
        'OpenAIService',
        { model: request.model || this.defaultModel }
      );

      throw this.handleOpenAIError(error);
    }
  }

  /**
   * @method chatCompletion
   * @purpose Generate chat completion using OpenAI
   */
  async chatCompletion(request: ChatCompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();
    let retryCount = 0;

    while (retryCount <= this.maxRetries) {
      try {
        const model = request.model || this.defaultModel;
        
        const completion = await this.openai.chat.completions.create({
          model,
          messages: request.messages,
          max_tokens: request.maxTokens || this.maxTokens,
          temperature: request.temperature ?? this.temperature,
          top_p: request.topP,
          frequency_penalty: request.frequencyPenalty,
          presence_penalty: request.presencePenalty,
          stop: request.stop,
          user: request.user,
        });

        const choice = completion.choices[0];
        if (!choice || !choice.message) {
          throw new Error('No completion choice returned');
        }

        const tokensUsed = completion.usage?.total_tokens || 0;
        const promptTokens = completion.usage?.prompt_tokens || 0;
        const completionTokens = completion.usage?.completion_tokens || 0;
        const cost = this.calculateCost(model, promptTokens, completionTokens);

        const response: CompletionResponse = {
          content: choice.message.content || '',
          finishReason: choice.finish_reason || 'unknown',
          tokensUsed,
          promptTokens,
          completionTokens,
          cost,
          model,
          requestId: completion.id,
        };

        const duration = Date.now() - startTime;
        
        this.logger.debug(
          `OpenAI chat completion successful`,
          'OpenAIService',
          {
            model,
            tokensUsed,
            cost,
            duration,
            retryCount,
          }
        );

        return response;
      } catch (error) {
        retryCount++;
        
        if (retryCount > this.maxRetries) {
          const duration = Date.now() - startTime;
          
          this.logger.error(
            `OpenAI chat completion failed after ${retryCount - 1} retries`,
            error.stack,
            'OpenAIService',
            { duration, retryCount: retryCount - 1 }
          );

          throw this.handleOpenAIError(error);
        }

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw this.handleOpenAIError(error);
        }

        // Wait before retry with exponential backoff
        const delay = this.retryDelay * Math.pow(2, retryCount - 1);
        await this.delay(delay);

        this.logger.warn(
          `OpenAI request failed, retrying (${retryCount}/${this.maxRetries})`,
          'OpenAIService',
          { error: error.message, delay }
        );
      }
    }

    throw new Error('Maximum retries exceeded');
  }

  /**
   * @method validateModel
   * @purpose Validate if model is supported
   */
  validateModel(model: string): boolean {
    const supportedModels = [
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k',
      'gpt-4',
      'gpt-4-32k',
      'gpt-4-turbo-preview',
    ];

    return supportedModels.includes(model);
  }

  /**
   * @method estimateCost
   * @purpose Estimate cost for a request
   */
  estimateCost(model: string, promptTokens: number, maxCompletionTokens: number): number {
    return this.calculateCost(model, promptTokens, maxCompletionTokens);
  }

  /**
   * @method countTokens
   * @purpose Estimate token count for text (approximate)
   */
  countTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    // This is an approximation; for exact counts, use tiktoken library
    return Math.ceil(text.length / 4);
  }

  /**
   * @method getModelLimits
   * @purpose Get model token limits
   */
  getModelLimits(model: string): { maxTokens: number; contextWindow: number } {
    const limits = {
      'gpt-3.5-turbo': { maxTokens: 4096, contextWindow: 4096 },
      'gpt-3.5-turbo-16k': { maxTokens: 16384, contextWindow: 16384 },
      'gpt-4': { maxTokens: 8192, contextWindow: 8192 },
      'gpt-4-32k': { maxTokens: 32768, contextWindow: 32768 },
      'gpt-4-turbo-preview': { maxTokens: 128000, contextWindow: 128000 },
    };

    return limits[model] || limits['gpt-3.5-turbo'];
  }

  /**
   * @method calculateCost
   * @purpose Calculate cost based on token usage
   */
  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = this.tokenPricing[model] || this.tokenPricing['gpt-3.5-turbo'];
    
    const promptCost = (promptTokens / 1000) * pricing.prompt;
    const completionCost = (completionTokens / 1000) * pricing.completion;
    
    return promptCost + completionCost;
  }

  /**
   * @method isRetryableError
   * @purpose Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Retry on rate limits, server errors, and network issues
    const retryableStatuses = [429, 500, 502, 503, 504];
    const retryableTypes = ['rate_limit_exceeded', 'server_error', 'timeout'];

    if (error.status && retryableStatuses.includes(error.status)) {
      return true;
    }

    if (error.type && retryableTypes.includes(error.type)) {
      return true;
    }

    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }

    return false;
  }

  /**
   * @method handleOpenAIError
   * @purpose Handle and transform OpenAI errors
   */
  private handleOpenAIError(error: any): Error {
    if (error.status === 401) {
      return new BadRequestException('Invalid OpenAI API key');
    }

    if (error.status === 429) {
      return new BadRequestException('OpenAI rate limit exceeded. Please try again later.');
    }

    if (error.status === 400) {
      return new BadRequestException(`OpenAI API error: ${error.message}`);
    }

    if (error.status >= 500) {
      return new BadRequestException('OpenAI service is temporarily unavailable');
    }

    return new BadRequestException(`OpenAI error: ${error.message}`);
  }

  /**
   * @method delay
   * @purpose Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}