// src/components/deploy/steps/beneficiaries-step.tsx
"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Papa from "papaparse";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDeploymentStore, Beneficiary } from "@/store/deployment-store";
import {
  Users,
  Upload,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Download,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/lib/hooks/use-toast";

const beneficiarySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  category: z.string().min(1, "Category is required"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .regex(/^\d+(\.\d+)?$/, "Must be a valid number"),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

type BeneficiaryForm = z.infer<typeof beneficiarySchema>;

interface BeneficiariesStepProps {
  onNext: () => void;
  onPrevious: () => void;
}

export function BeneficiariesStep({
  onNext,
  onPrevious,
}: BeneficiariesStepProps) {
  const {
    vestingSchedules,
    beneficiaries,
    addBeneficiary,
    updateBeneficiary,
    removeBeneficiary,
    setBeneficiaries,
    tokenConfig,
  } = useDeploymentStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] =
    useState<Beneficiary | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<BeneficiaryForm>({
    resolver: zodResolver(beneficiarySchema),
    defaultValues: {
      address: "",
      category: "",
      amount: "",
      name: "",
      email: "",
    },
  });

  const onSubmit = (data: BeneficiaryForm) => {
    const beneficiary: Beneficiary = {
      id: editingBeneficiary?.id || crypto.randomUUID(),
      ...data,
    };

    if (editingBeneficiary) {
      updateBeneficiary(editingBeneficiary.id, beneficiary);
    } else {
      addBeneficiary(beneficiary);
    }

    form.reset();
    setEditingBeneficiary(null);
    setIsDialogOpen(false);
    toast({
      title: editingBeneficiary ? "Beneficiary updated" : "Beneficiary added",
      description: `Successfully ${
        editingBeneficiary ? "updated" : "added"
      } beneficiary.`,
    });
  };

  const handleEdit = (beneficiary: Beneficiary) => {
    setEditingBeneficiary(beneficiary);
    form.reset(beneficiary);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    removeBeneficiary(id);
    toast({
      title: "Beneficiary removed",
      description: "Beneficiary has been removed from the list.",
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const newBeneficiaries: Beneficiary[] = [];
          const errors: string[] = [];

          results.data.forEach((row: any, index: number) => {
            const lineNumber = index + 2; // +2 because index starts at 0 and we have a header

            // Validate required fields
            if (!row.address || !row.category || !row.amount) {
              errors.push(
                `Line ${lineNumber}: Missing required fields (address, category, amount)`
              );
              return;
            }

            // Validate Ethereum address
            if (!/^0x[a-fA-F0-9]{40}$/.test(row.address.trim())) {
              errors.push(`Line ${lineNumber}: Invalid Ethereum address`);
              return;
            }

            // Validate amount
            if (!/^\d+(\.\d+)?$/.test(row.amount.toString().trim())) {
              errors.push(`Line ${lineNumber}: Invalid amount format`);
              return;
            }

            // Validate category exists
            const categoryExists = vestingSchedules.some(
              (schedule) =>
                schedule.category.toLowerCase() ===
                row.category.trim().toLowerCase()
            );
            if (!categoryExists) {
              errors.push(
                `Line ${lineNumber}: Category "${row.category}" not found in vesting schedules`
              );
              return;
            }

            newBeneficiaries.push({
              id: crypto.randomUUID(),
              address: row.address.trim(),
              category: row.category.trim(),
              amount: row.amount.toString().trim(),
              name: row.name?.trim() || "",
              email: row.email?.trim() || "",
            });
          });

          if (errors.length > 0) {
            toast({
              title: "CSV Import Errors",
              description: `Found ${errors.length} errors. Check console for details.`,
              variant: "destructive",
            });
            console.error("CSV Import Errors:", errors);
          } else {
            setBeneficiaries([...beneficiaries, ...newBeneficiaries]);
            toast({
              title: "Import successful",
              description: `Added ${newBeneficiaries.length} beneficiaries.`,
            });
          }
        } catch (error) {
          toast({
            title: "Import failed",
            description: "Failed to parse CSV file. Please check the format.",
            variant: "destructive",
          });
        }
        setIsUploading(false);
      },
      error: () => {
        toast({
          title: "Import failed",
          description: "Failed to read CSV file.",
          variant: "destructive",
        });
        setIsUploading(false);
      },
    });
  };

  const downloadTemplate = () => {
    const template = `address,category,amount,name,email
0x1234567890123456789012345678901234567890,team,1000,John Doe,john@example.com
0x2345678901234567890123456789012345678901,investors,5000,Jane Smith,jane@example.com`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "beneficiaries-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTotalAllocation = () => {
    return beneficiaries.reduce((total, beneficiary) => {
      return total + parseFloat(beneficiary.amount);
    }, 0);
  };

  const getAllocationByCategory = () => {
    const allocation: Record<string, number> = {};
    beneficiaries.forEach((beneficiary) => {
      allocation[beneficiary.category] =
        (allocation[beneficiary.category] || 0) +
        parseFloat(beneficiary.amount);
    });
    return allocation;
  };

  const getCategoryColor = (category: string) => {
    const colors = [
      "bg-blue-100 text-blue-800",
      "bg-green-100 text-green-800",
      "bg-purple-100 text-purple-800",
      "bg-orange-100 text-orange-800",
      "bg-pink-100 text-pink-800",
    ];
    const index = vestingSchedules.findIndex((s) => s.category === category);
    return colors[index % colors.length] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Beneficiaries & Allocations
          </CardTitle>
          <CardDescription>
            Add beneficiaries and assign token allocations for each vesting
            schedule
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Upload and Add Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingBeneficiary(null);
                    form.reset();
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Beneficiary
                </Button>
              </DialogTrigger>

              {/* Add/Edit Beneficiary Dialog */}
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingBeneficiary
                      ? "Edit Beneficiary"
                      : "Add Beneficiary"}
                  </DialogTitle>
                  <DialogDescription>
                    Enter the beneficiary details and token allocation
                  </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Wallet Address</FormLabel>
                          <FormControl>
                            <Input placeholder="0x..." {...field} />
                          </FormControl>
                          <FormDescription>
                            The Ethereum address that will receive the tokens
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormDescription>
                              Display name for this beneficiary
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="john@example.com"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Contact email for notifications
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vesting Category</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {vestingSchedules.map((schedule) => (
                                  <SelectItem
                                    key={schedule.id}
                                    value={schedule.category}
                                  >
                                    {schedule.category}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              The vesting schedule this beneficiary belongs to
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Token Amount</FormLabel>
                            <FormControl>
                              <Input placeholder="1000" {...field} />
                            </FormControl>
                            <FormDescription>
                              Number of tokens to allocate
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Selected Category Info */}
                    {form.watch("category") && (
                      <div className="bg-muted p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">
                          Vesting Schedule Details
                        </h4>
                        {(() => {
                          const selectedSchedule = vestingSchedules.find(
                            (s) => s.category === form.watch("category")
                          );
                          if (!selectedSchedule) return null;

                          return (
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">
                                  Cliff Period:
                                </span>
                                <p>{selectedSchedule.cliffMonths} months</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">
                                  Vesting Duration:
                                </span>
                                <p>{selectedSchedule.vestingMonths} months</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">
                                  Revocable:
                                </span>
                                <p>
                                  {selectedSchedule.revocable ? "Yes" : "No"}
                                </p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">
                                  Total Duration:
                                </span>
                                <p>
                                  {selectedSchedule.cliffMonths +
                                    selectedSchedule.vestingMonths}{" "}
                                  months
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingBeneficiary
                          ? "Update Beneficiary"
                          : "Add Beneficiary"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? "Uploading..." : "Upload CSV"}
              </Button>

              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Template
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total Beneficiaries</span>
              </div>
              <p className="text-2xl font-bold mt-1">{beneficiaries.length}</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total Allocation</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {getTotalAllocation().toLocaleString()}{" "}
                {tokenConfig?.symbol || "Tokens"}
              </p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Badge className="h-4 w-4" />
                <span className="text-sm font-medium">Categories</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {Object.keys(getAllocationByCategory()).length}
              </p>
            </Card>
          </div>

          {/* Category Breakdown */}
          {Object.keys(getAllocationByCategory()).length > 0 && (
            <Card className="p-4 mb-6">
              <h4 className="font-semibold mb-3">Allocation by Category</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(getAllocationByCategory()).map(
                  ([category, amount]) => (
                    <div
                      key={category}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <Badge className={getCategoryColor(category)}>
                        {category}
                      </Badge>
                      <span className="font-medium">
                        {amount.toLocaleString()}{" "}
                        {tokenConfig?.symbol || "Tokens"}
                      </span>
                    </div>
                  )
                )}
              </div>
            </Card>
          )}

          {/* Beneficiaries Table */}
          {beneficiaries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No beneficiaries added yet</p>
              <p className="text-sm">
                Add beneficiaries manually or upload a CSV file
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Address</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {beneficiaries.map((beneficiary) => (
                    <TableRow key={beneficiary.id}>
                      <TableCell className="font-mono text-sm">
                        {beneficiary.address.slice(0, 6)}...
                        {beneficiary.address.slice(-4)}
                      </TableCell>
                      <TableCell>{beneficiary.name || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          className={getCategoryColor(beneficiary.category)}
                        >
                          {beneficiary.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {parseFloat(beneficiary.amount).toLocaleString()}{" "}
                        {tokenConfig?.symbol || "Tokens"}
                      </TableCell>
                      <TableCell>{beneficiary.email || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(beneficiary)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(beneficiary.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrevious}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        <Button onClick={onNext} disabled={beneficiaries.length === 0}>
          Continue to Review
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
