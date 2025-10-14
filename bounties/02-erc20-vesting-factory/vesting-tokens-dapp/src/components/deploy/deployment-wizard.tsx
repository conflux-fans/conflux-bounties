// src/components/deploy/deployment-wizard.tsx - FIXED IMPORTS
"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { TokenConfigurationStep } from "./steps/token-configuration-step";
import { VestingSchedulesStep } from "./steps/vesting-schedules-step";
import { BeneficiariesStep } from "./steps/beneficiaries-step";
import { ReviewDeployStep } from "./steps/review-deploy-step"; // FIXED: Removed "And"
import { DeploymentSuccessStep } from "./steps/deployment-success-step";
import { useDeploymentStore } from "@/store/deployment-store";
import { useDeployTokenWithVesting } from "@/lib/hooks/useTokenVestingFactory"; // Add this import

const STEPS = [
  {
    id: "token-config",
    title: "Token Configuration",
    description: "Basic token information",
  },
  {
    id: "vesting-schedules",
    title: "Vesting Schedules",
    description: "Configure vesting parameters",
  },
  {
    id: "beneficiaries",
    title: "Beneficiaries",
    description: "Add beneficiaries and allocations",
  },
  {
    id: "review-deploy",
    title: "Review & Deploy",
    description: "Confirm and deploy contracts",
  },
  {
    id: "success",
    title: "Success",
    description: "Deployment completed",
  },
];

export function DeploymentWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const { resetDeployment, isDeploymentComplete, deploymentResult } =
    useDeploymentStore();

  // Import the hook for retry functionality
  const { retryDatabaseSave, isSavingToDatabase } = useDeployTokenWithVesting();

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
    resetDeployment();
    setCurrentStep(0);
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <TokenConfigurationStep onNext={handleNext} />;
      case 1:
        return (
          <VestingSchedulesStep
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        );
      case 2:
        return (
          <BeneficiariesStep onNext={handleNext} onPrevious={handlePrevious} />
        );
      case 3:
        return (
          <ReviewDeployStep // FIXED: Changed from ReviewAndDeployStep
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        );
      case 4:
        return (
          <DeploymentSuccessStep
            deploymentResult={deploymentResult}
            onReset={handleReset}
            retryDatabaseSave={retryDatabaseSave}
            isSavingToDatabase={isSavingToDatabase}
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
            <div>
              <CardTitle className="flex items-center gap-2">
                {isDeploymentComplete && currentStep === 4 && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                Step {currentStep + 1} of {STEPS.length}:{" "}
                {STEPS[currentStep].title}
              </CardTitle>
              <CardDescription>
                {STEPS[currentStep].description}
              </CardDescription>
            </div>
            <Badge variant="secondary">{Math.round(progress)}% Complete</Badge>
          </div>
          <Progress value={progress} className="w-full" />
        </CardHeader>
      </Card>

      {/* Step Navigation */}
      <div className="flex justify-center">
        <div className="flex items-center space-x-4 bg-muted rounded-lg p-2">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  index === currentStep
                    ? "bg-primary text-primary-foreground"
                    : index < currentStep
                    ? "bg-green-500 text-white"
                    : "bg-muted-foreground/20 text-muted-foreground"
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`w-12 h-px mx-2 ${
                    index < currentStep
                      ? "bg-green-500"
                      : "bg-muted-foreground/20"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[600px]">{renderStep()}</div>
    </div>
  );
}
