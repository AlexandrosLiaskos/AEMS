import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, AlertCircle, Info } from 'lucide-react';
import { useState } from 'react';

/**
 * @interface SetupField
 * @purpose Setup field definition
 */
interface SetupField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'email' | 'url' | 'number' | 'boolean' | 'select' | 'textarea';
  required: boolean;
  placeholder?: string;
  description?: string;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
  options?: Array<{ value: string; label: string }>;
  value?: any;
}

/**
 * @interface SetupWizardStep
 * @purpose Setup wizard step definition
 */
interface SetupWizardStep {
  id: string;
  title: string;
  description: string;
  fields: SetupField[];
  isComplete: boolean;
  isRequired: boolean;
}

/**
 * @interface SetupWizardStepProps
 * @purpose Props for setup wizard step component
 */
interface SetupWizardStepProps {
  step: SetupWizardStep;
  data: Record<string, any>;
  errors: Record<string, string>;
  onChange: (fieldName: string, value: any) => void;
}

/**
 * @component SetupWizardStep
 * @purpose Render a single setup wizard step with its fields
 */
export const SetupWizardStep: React.FC<SetupWizardStepProps> = ({
  step,
  data,
  errors,
  onChange,
}) => {
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  /**
   * @method togglePasswordVisibility
   * @purpose Toggle password field visibility
   */
  const togglePasswordVisibility = (fieldName: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }));
  };

  /**
   * @method renderField
   * @purpose Render individual form field
   */
  const renderField = (field: SetupField) => {
    const fieldValue = data[field.name] ?? field.value ?? '';
    const hasError = !!errors[field.name];

    const commonProps = {
      id: field.name,
      name: field.name,
      required: field.required,
      className: hasError ? 'border-red-500' : '',
    };

    switch (field.type) {
      case 'text':
      case 'email':
      case 'url':
        return (
          <Input
            {...commonProps}
            type={field.type}
            value={fieldValue}
            placeholder={field.placeholder}
            onChange={(e) => onChange(field.name, e.target.value)}
          />
        );

      case 'password':
        return (
          <div className="relative">
            <Input
              {...commonProps}
              type={showPasswords[field.name] ? 'text' : 'password'}
              value={fieldValue}
              placeholder={field.placeholder}
              onChange={(e) => onChange(field.name, e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => togglePasswordVisibility(field.name)}
            >
              {showPasswords[field.name] ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        );

      case 'number':
        return (
          <Input
            {...commonProps}
            type="number"
            value={fieldValue}
            placeholder={field.placeholder}
            min={field.validation?.min}
            max={field.validation?.max}
            step={field.validation?.min !== undefined && field.validation.min < 1 ? '0.1' : '1'}
            onChange={(e) => onChange(field.name, parseFloat(e.target.value) || 0)}
          />
        );

      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            value={fieldValue}
            placeholder={field.placeholder}
            rows={4}
            onChange={(e) => onChange(field.name, e.target.value)}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.name}
              checked={!!fieldValue}
              onCheckedChange={(checked) => onChange(field.name, checked)}
            />
            <Label
              htmlFor={field.name}
              className="text-sm font-normal cursor-pointer"
            >
              {field.label}
            </Label>
          </div>
        );

      case 'select':
        return (
          <Select
            value={fieldValue}
            onValueChange={(value) => onChange(field.name, value)}
          >
            <SelectTrigger className={hasError ? 'border-red-500' : ''}>
              <SelectValue placeholder={field.placeholder || `Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Special handling for welcome step */}
      {step.id === 'welcome' && (
        <div className="text-center py-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to AEMS
          </h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            The Automated Email Management System will help you organize, classify, and extract data from your emails using AI. 
            This setup wizard will guide you through the initial configuration process.
          </p>
          
          <Alert className="text-left max-w-2xl mx-auto mb-8">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>What you'll need:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>• OpenAI API key for AI processing</li>
                <li>• Google OAuth credentials for Gmail integration</li>
                <li>• About 5-10 minutes to complete the setup</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Special handling for review step */}
      {step.id === 'review' && (
        <div className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please review your configuration before completing the setup. 
              You can modify these settings later through the application settings.
            </AlertDescription>
          </Alert>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Configuration Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>OpenAI API Key:</span>
                <span className="text-green-600">
                  {data.OPENAI_API_KEY ? '✓ Configured' : '✗ Missing'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Google OAuth:</span>
                <span className="text-green-600">
                  {data.GOOGLE_CLIENT_ID && data.GOOGLE_CLIENT_SECRET ? '✓ Configured' : '✗ Missing'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>AI Model:</span>
                <span>{data.OPENAI_MODEL || 'gpt-3.5-turbo'}</span>
              </div>
              <div className="flex justify-between">
                <span>Frontend URL:</span>
                <span>{data.FRONTEND_URL || 'http://localhost:3000'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Render form fields */}
      <div className="space-y-4">
        {step.fields.map((field) => {
          // Skip label for boolean fields as they have their own label
          const showLabel = field.type !== 'boolean';

          return (
            <div key={field.name} className="space-y-2">
              {showLabel && (
                <Label htmlFor={field.name} className="text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
              )}

              {renderField(field)}

              {/* Field description */}
              {field.description && (
                <p className="text-sm text-gray-500">{field.description}</p>
              )}

              {/* Field error */}
              {errors[field.name] && (
                <p className="text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors[field.name]}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Step-specific additional content */}
      {step.id === 'api-keys' && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Getting your API keys:</strong>
            <ul className="mt-2 space-y-1 text-sm">
              <li>
                • <strong>OpenAI:</strong> Visit{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  platform.openai.com/api-keys
                </a>
              </li>
              <li>
                • <strong>Google:</strong> Visit{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Google Cloud Console
                </a>
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};