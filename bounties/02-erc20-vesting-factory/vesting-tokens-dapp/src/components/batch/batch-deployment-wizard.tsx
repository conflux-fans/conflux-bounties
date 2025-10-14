// src/components/batch/batch-deployment-wizard.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Upload,
  Users,
} from "lucide-react";
import { BatchConfigurationStep } from "./steps/batch-configuration-step";
import { BatchTokensStep } from "./steps/batch-tokens-step";
import { BatchReviewStep } from "./steps/batch-review-step";
import { BatchSuccessStep } from "./steps/batch-success-step";
import { useBatchDeploymentStore } from "@/store/batch-deployment-store";

const STEPS = [
  {
    id: "batch-config",
    title: "Configuration Method",
    description: "Choose input method",
    icon: Upload,
  },
  {
    id: "batch-tokens",
    title: "Token Configuration",
    description: "Configure tokens and vesting",
    icon: Users,
  },
  {
    id: "batch-review",
    title: "Review & Deploy",
    description: "Confirm batch deployment",
    icon: CheckCircle,
  },
  {
    id: "batch-success",
    title: "Success",
    description: "Deployment completed",
    icon: CheckCircle,
  },
];

export function BatchDeploymentWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const { resetBatchDeployment, batchDeploymentResult } =
    useBatchDeploymentStore();

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleReset = () => {
    resetBatchDeployment();
    setCurrentStep(0);
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <BatchConfigurationStep onNext={handleNext} />;
      case 1:
        return (
          <BatchTokensStep onNext={handleNext} onPrevious={handlePrevious} />
        );
      case 2:
        return (
          <BatchReviewStep onNext={handleNext} onPrevious={handlePrevious} />
        );
      case 3:
        return (
          <BatchSuccessStep
            deploymentResult={batchDeploymentResult}
            onReset={handleReset}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Batch Deployment Progress</CardTitle>
            <Badge variant="outline">{`${currentStep + 1} of ${
              STEPS.length
            }`}</Badge>
          </div>
          <Progress value={progress} className="w-full" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;

              return (
                <div
                  key={step.id}
                  className={`flex flex-col items-center space-y-2 ${
                    isActive
                      ? "text-primary"
                      : isCompleted
                      ? "text-green-600"
                      : "text-muted-foreground"
                  }`}
                >
                  <div
                    className={`p-2 rounded-full border-2 ${
                      isActive
                        ? "border-primary bg-primary/10"
                        : isCompleted
                        ? "border-green-600 bg-green-50"
                        : "border-gray-300"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="text-xs">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      {renderStep()}

      {/* Navigation */}
      {/* {currentStep < STEPS.length - 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                onClick={handleNext}
                disabled={currentStep === STEPS.length - 1}
                className="flex items-center gap-2"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )} */}
    </div>
  );
}
