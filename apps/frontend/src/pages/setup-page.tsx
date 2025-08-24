import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { SetupWizardStep } from '@/components/setup/setup-wizard-step';
import { useSetup } from '@/hooks/use-setup';

/**
 * @interface SetupPageProps
 * @purpose Props for setup page component
 */
interface SetupPageProps {}

/**
 * @component SetupPage
 * @purpose Initial application setup wizard page
 */
export const SetupPage: React.FC<SetupPageProps> = () => {
  const navigate = useNavigate();
  const {
    progress,
    currentStepData,
    isLoading,
    error,
    loadProgress,
    validateStep,
    saveStep,
    completeSetup,
  } = useSetup();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepData, setStepData] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Load setup progress on mount
  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  // Update current step when progress loads
  useEffect(() => {
    if (progress) {
      setCurrentStepIndex(progress.currentStep);

      // If setup is already complete, redirect to main app
      if (progress.isComplete) {
        navigate('/dashboard');
      }
    }
  }, [progress, navigate]);

  // Load existing data for current step
  useEffect(() => {
    if (progress?.steps[currentStepIndex]) {
      const step = progress.steps[currentStepIndex];
      const existingData: Record<string, any> = {};

      step.fields.forEach(field => {
        if (field.value !== undefined) {
          existingData[field.name] = field.value;
        }
      });

      setStepData(existingData);
    }
  }, [progress, currentStepIndex]);

  /**
   * @method handleStepDataChange
   * @purpose Handle step data changes
   */
  const handleStepDataChange = (fieldName: string, value: any) => {
    setStepData(prev => ({
      ...prev,
      [fieldName]: value,
    }));

    // Clear validation error for this field
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  /**
   * @method handleValidateStep
   * @purpose Validate current step
   */
  const handleValidateStep = async () => {
    if (!progress?.steps[currentStepIndex]) return false;

    const step = progress.steps[currentStepIndex];
    setIsValidating(true);

    try {
      const validation = await validateStep(step.id, stepData);

      if (validation.isValid) {
        setValidationErrors({});
        return true;
      } else {
        setValidationErrors(validation.errors);
        return false;
      }
    } catch (error) {
      console.error('Step validation failed:', error);
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  /**
   * @method handleNextStep
   * @purpose Move to next step
   */
  const handleNextStep = async () => {
    const isValid = await handleValidateStep();
    if (!isValid) return;

    if (!progress?.steps[currentStepIndex]) return;

    const step = progress.steps[currentStepIndex];

    try {
      await saveStep(step.id, stepData);

      if (currentStepIndex < progress.steps.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
        setStepData({});
        setValidationErrors({});
      }
    } catch (error) {
      console.error('Failed to save step:', error);
    }
  };

  /**
   * @method handlePreviousStep
   * @purpose Move to previous step
   */
  const handlePreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      setValidationErrors({});
    }
  };

  /**
   * @method handleCompleteSetup
   * @purpose Complete the setup process
   */
  const handleCompleteSetup = async () => {
    const isValid = await handleValidateStep();
    if (!isValid) return;

    if (!progress?.steps[currentStepIndex]) return;

    const step = progress.steps[currentStepIndex];
    setIsCompleting(true);

    try {
      // Save final step data
      await saveStep(step.id, stepData);

      // Complete setup
      const result = await completeSetup();

      if (result.success) {
        // Show success message and redirect
        navigate('/dashboard', {
          state: {
            message: 'Setup completed successfully! Welcome to AEMS.'
          }
        });
      }
    } catch (error) {
      console.error('Failed to complete setup:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  // Show loading state
  if (isLoading || !progress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading setup wizard...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStep = progress.steps[currentStepIndex];
  const progressPercentage = ((currentStepIndex + 1) / progress.totalSteps) * 100;
  const isLastStep = currentStepIndex === progress.steps.length - 1;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AEMS Setup Wizard
          </h1>
          <p className="text-gray-600">
            Let's get your Automated Email Management System configured
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Step {currentStepIndex + 1} of {progress.totalSteps}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(progressPercentage)}% Complete
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Current Step */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              {currentStep.isComplete && (
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              )}
              {currentStep.title}
            </CardTitle>
            <CardDescription>{currentStep.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <SetupWizardStep
              step={currentStep}
              data={stepData}
              errors={validationErrors}
              onChange={handleStepDataChange}
            />
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePreviousStep}
            disabled={currentStepIndex === 0}
          >
            Previous
          </Button>

          <div className="flex space-x-2">
            {!isLastStep ? (
              <Button
                onClick={handleNextStep}
                disabled={isValidating}
              >
                {isValidating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Next
              </Button>
            ) : (
              <Button
                onClick={handleCompleteSetup}
                disabled={isCompleting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isCompleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Complete Setup
              </Button>
            )}
          </div>
        </div>

        {/* Step Overview */}
        <div className="mt-12">
          <h3 className="text-lg font-semibold mb-4">Setup Steps</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {progress.steps.map((step, index) => (
              <Card
                key={step.id}
                className={`cursor-pointer transition-colors ${
                  index === currentStepIndex
                    ? 'ring-2 ring-blue-500 bg-blue-50'
                    : step.isComplete
                    ? 'bg-green-50'
                    : 'bg-gray-50'
                }`}
                onClick={() => {
                  if (index < currentStepIndex || step.isComplete) {
                    setCurrentStepIndex(index);
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center">
                    {step.isComplete ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    ) : index === currentStepIndex ? (
                      <div className="h-5 w-5 rounded-full bg-blue-500 mr-2" />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-gray-300 mr-2" />
                    )}
                    <div>
                      <h4 className="font-medium text-sm">{step.title}</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {step.isRequired ? 'Required' : 'Optional'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
