// src/components/batch/steps/batch-configuration-step.tsx
"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useBatchDeploymentStore } from "@/store/batch-deployment-store";
import {
  Upload,
  FileText,
  Users,
  ArrowRight,
  Download,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import Papa from "papaparse";

// Generate simple temporary IDs for frontend state
let tempIdCounter = 0;
const generateTempId = () => `temp_${Date.now()}_${++tempIdCounter}`;

const configSchema = z.object({
  inputMethod: z.enum(["manual", "csv"]),
});

type ConfigForm = z.infer<typeof configSchema>;

interface BatchConfigurationStepProps {
  onNext: () => void;
}

export function BatchConfigurationStep({
  onNext,
}: BatchConfigurationStepProps) {
  const {
    inputMethod,
    setInputMethod,
    csvData,
    setCsvData,
    setTokenConfigs,
    setVestingSchedules,
    setBeneficiaries,
  } = useBatchDeploymentStore();

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ConfigForm>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      inputMethod: inputMethod,
    },
  });

  const handleMethodChange = (method: "manual" | "csv") => {
    setInputMethod(method);
    form.setValue("inputMethod", method);

    // Clear CSV data when switching to manual
    if (method === "manual") {
      setCsvData([]);
      setCsvFile(null);
      setCsvError(null);
      setCsvPreview([]);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setCsvError(null);
    setIsProcessing(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        setIsProcessing(false);

        if (results.errors.length > 0) {
          setCsvError(`CSV parsing error: ${results.errors[0].message}`);
          return;
        }

        // Validate required columns
        const requiredColumns = [
          "tokenName",
          "tokenSymbol",
          "totalSupply",
          "beneficiaryAddress",
          "beneficiaryAmount",
          "vestingCategory",
          "cliffMonths",
          "vestingMonths",
        ];

        const headers = Object.keys(results.data[0] || {});
        const missingColumns = requiredColumns.filter(
          (col) => !headers.includes(col)
        );

        if (missingColumns.length > 0) {
          setCsvError(`Missing required columns: ${missingColumns.join(", ")}`);
          return;
        }

        setCsvData(results.data as any[]);
        setCsvPreview(results.data.slice(0, 5) as any[]);

        // Process CSV data into store format
        processCsvData(results.data as any[]);
      },
      error: (error) => {
        setIsProcessing(false);
        setCsvError(`File reading error: ${error.message}`);
      },
    });
  };

  const processCsvData = (data: any[]) => {
    const tokens = new Map();
    const schedules: any[] = [];
    const beneficiaries: any[] = [];

    data.forEach((row, index) => {
      const tokenKey = `${row.tokenName}-${row.tokenSymbol}`;

      // Process token config
      if (!tokens.has(tokenKey)) {
        tokens.set(tokenKey, {
          id: generateTempId(), // Use temp ID instead of tokenKey
          name: row.tokenName,
          symbol: row.tokenSymbol,
          totalSupply: row.totalSupply.toString(),
          decimals: row.decimals || 18,
          description: row.description || "",
          website: row.website || "",
          logo: row.logo || "",
        });
      }

      const token = tokens.get(tokenKey);
      const tokenId = token.id;

      // Process vesting schedule
      const scheduleKey = `${tokenKey}-${row.vestingCategory}`;
      const existingSchedule = schedules.find((s) => s.id === scheduleKey);

      if (!existingSchedule) {
        schedules.push({
          id: generateTempId(), // Use temp ID instead of scheduleKey
          tokenId: tokenId,
          category: row.vestingCategory,
          cliffMonths: parseInt(row.cliffMonths) || 0,
          vestingMonths: parseInt(row.vestingMonths) || 12,
          revocable: row.revocable === true || row.revocable === "true",
        });
      }

      // Process beneficiary
      beneficiaries.push({
        id: generateTempId(), // Use temp ID
        tokenId: tokenId,
        address: row.beneficiaryAddress,
        amount: row.beneficiaryAmount.toString(),
        category: row.vestingCategory,
      });
    });

    setTokenConfigs(Array.from(tokens.values()));
    setVestingSchedules(schedules);
    setBeneficiaries(beneficiaries);
  };

  const downloadTemplate = () => {
    const template = [
      {
        tokenName: "Example Token",
        tokenSymbol: "EXT",
        totalSupply: "1000000",
        decimals: 18,
        description: "Example token description",
        website: "https://example.com",
        logo: "https://example.com/logo.png",
        beneficiaryAddress: "0x1234567890123456789012345678901234567890",
        beneficiaryAmount: "10000",
        vestingCategory: "Team",
        cliffMonths: 6,
        vestingMonths: 24,
        revocable: true,
      },
      {
        tokenName: "Example Token",
        tokenSymbol: "EXT",
        totalSupply: "1000000",
        decimals: 18,
        description: "",
        website: "",
        logo: "",
        beneficiaryAddress: "0x0987654321098765432109876543210987654321",
        beneficiaryAmount: "5000",
        vestingCategory: "Advisors",
        cliffMonths: 3,
        vestingMonths: 12,
        revocable: false,
      },
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "batch-deployment-template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const onSubmit = (data: ConfigForm) => {
    if (data.inputMethod === "csv" && csvData.length === 0) {
      setCsvError("Please upload a valid CSV file");
      return;
    }
    onNext();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Configuration Method
        </CardTitle>
        <CardDescription>
          Choose how you want to configure your batch deployment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="inputMethod"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Input Method</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={handleMethodChange}
                      value={field.value}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="manual" id="manual" />
                        <Label htmlFor="manual" className="cursor-pointer">
                          <Card className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <Users className="h-8 w-8 text-blue-500" />
                              <div>
                                <h3 className="font-medium">
                                  Manual Configuration
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  Configure tokens and beneficiaries manually
                                </p>
                              </div>
                            </div>
                          </Card>
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="csv" id="csv" />
                        <Label htmlFor="csv" className="cursor-pointer">
                          <Card className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <FileText className="h-8 w-8 text-green-500" />
                              <div>
                                <h3 className="font-medium">CSV Import</h3>
                                <p className="text-sm text-muted-foreground">
                                  Import configuration from CSV file
                                </p>
                              </div>
                            </div>
                          </Card>
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {inputMethod === "csv" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>CSV File Upload</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={downloadTemplate}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Template
                  </Button>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <Label htmlFor="csv-upload" className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-gray-900">
                          Upload CSV file
                        </span>
                      </Label>
                      <Input
                        id="csv-upload"
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Select a CSV file with token and vesting configurations
                      </p>
                    </div>
                  </div>
                </div>

                {isProcessing && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Processing CSV file...</AlertDescription>
                  </Alert>
                )}

                {csvError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{csvError}</AlertDescription>
                  </Alert>
                )}

                {csvFile && !csvError && !isProcessing && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Successfully loaded {csvData.length} records from{" "}
                      {csvFile.name}
                    </AlertDescription>
                  </Alert>
                )}

                {csvPreview.length > 0 && (
                  <div className="space-y-2">
                    <Label>Preview (first 5 rows)</Label>
                    <div className="border rounded-md overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {Object.keys(csvPreview[0])
                              .slice(0, 6)
                              .map((header) => (
                                <th
                                  key={header}
                                  className="px-3 py-2 text-left font-medium"
                                >
                                  {header}
                                </th>
                              ))}
                            {Object.keys(csvPreview[0]).length > 6 && (
                              <th className="px-3 py-2 text-left font-medium">
                                +{Object.keys(csvPreview[0]).length - 6} more
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.map((row, index) => (
                            <tr key={index} className="border-t">
                              {Object.values(row)
                                .slice(0, 6)
                                .map((value: any, i) => (
                                  <td key={i} className="px-3 py-2">
                                    {typeof value === "string" &&
                                    value.length > 20
                                      ? `${value.substring(0, 20)}...`
                                      : String(value)}
                                  </td>
                                ))}
                              {Object.values(row).length > 6 && (
                                <td className="px-3 py-2 text-gray-500">...</td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Required CSV Columns</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      "tokenName",
                      "tokenSymbol",
                      "totalSupply",
                      "beneficiaryAddress",
                      "beneficiaryAmount",
                      "vestingCategory",
                      "cliffMonths",
                      "vestingMonths",
                    ].map((column) => (
                      <Badge
                        key={column}
                        variant="outline"
                        className="justify-center"
                      >
                        {column}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Optional: decimals, description, website, logo, revocable
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-6">
              <Button
                type="submit"
                className="flex items-center gap-2"
                disabled={inputMethod === "csv" && csvData.length === 0}
              >
                Continue to Token Configuration
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
