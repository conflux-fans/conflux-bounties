// src/components/batch/steps/batch-tokens-step.tsx
"use client";

import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useBatchDeploymentStore } from "@/store/batch-deployment-store";
import {
  Coins,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Users,
  Clock,
  Edit,
  Eye,
} from "lucide-react";

// Generate simple temporary IDs for frontend state
let tempIdCounter = 0;
const generateTempId = () => `temp_${Date.now()}_${++tempIdCounter}`;

interface BatchTokensStepProps {
  onNext: () => void;
  onPrevious: () => void;
}

export function BatchTokensStep({ onNext, onPrevious }: BatchTokensStepProps) {
  const {
    inputMethod,
    tokenConfigs,
    vestingSchedules,
    beneficiaries,
    addTokenConfig,
    updateTokenConfig,
    removeTokenConfig,
    addVestingSchedule,
    updateVestingSchedule,
    removeVestingSchedule,
    addBeneficiary,
    updateBeneficiary,
    removeBeneficiary,
    getVestingSchedulesByToken,
    getBeneficiariesByToken,
    validateBatchConfiguration,
  } = useBatchDeploymentStore();

  const [editingToken, setEditingToken] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [editingBeneficiary, setEditingBeneficiary] = useState<string | null>(
    null
  );

  const validation = validateBatchConfiguration();

  const handleNext = () => {
    const validation = validateBatchConfiguration();
    if (validation.isValid) {
      onNext();
    }
  };

  const addNewToken = () => {
    const newToken = {
      id: generateTempId(),
      name: "",
      symbol: "",
      totalSupply: "",
      decimals: 18,
      description: "",
      website: "",
      logo: "",
    };
    addTokenConfig(newToken);
    setEditingToken(newToken.id);
  };

  const addNewVestingSchedule = (tokenId: string) => {
    const newSchedule = {
      id: generateTempId(),
      tokenId,
      category: "",
      cliffMonths: 0,
      vestingMonths: 12,
      revocable: false,
    };
    addVestingSchedule(newSchedule);
    setEditingSchedule(newSchedule.id);
  };

  const addNewBeneficiary = (tokenId: string) => {
    const newBeneficiary = {
      id: generateTempId(),
      tokenId,
      address: "",
      amount: "",
      category: "",
    };
    addBeneficiary(newBeneficiary);
    setEditingBeneficiary(newBeneficiary.id);
  };

  const calculateTotalAllocation = (tokenId: string) => {
    const tokenBeneficiaries = getBeneficiariesByToken(tokenId);
    return tokenBeneficiaries.reduce(
      (total, b) => total + parseFloat(b.amount || "0"),
      0
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Token Configuration
        </CardTitle>
        <CardDescription>
          {inputMethod === "csv"
            ? "Review and edit your imported configuration"
            : "Configure your tokens, vesting schedules, and beneficiaries"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {inputMethod === "manual" && (
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">
                Tokens ({tokenConfigs.length})
              </h3>
              <p className="text-sm text-muted-foreground">
                Add and configure your token deployments
              </p>
            </div>
            <Button onClick={addNewToken} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Token
            </Button>
          </div>
        )}

        {tokenConfigs.length === 0 && inputMethod === "manual" && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Coins className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No tokens configured
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Add your first token to get started with batch deployment
              </p>
              <Button onClick={addNewToken}>Add Token</Button>
            </CardContent>
          </Card>
        )}

        <Accordion type="multiple" className="space-y-4">
          {tokenConfigs.map((token, index) => {
            const tokenSchedules = getVestingSchedulesByToken(token.id);
            const tokenBeneficiaries = getBeneficiariesByToken(token.id);
            const totalAllocation = calculateTotalAllocation(token.id);

            return (
              <AccordionItem key={token.id} value={token.id}>
                <Card>
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <div className="text-left">
                            <h3 className="font-medium">
                              {token.name || "Unnamed Token"}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {token.symbol || "NO_SYMBOL"} •{" "}
                              {token.totalSupply || "0"} total supply
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mr-4">
                        <div className="text-right text-sm">
                          <div>{tokenSchedules.length} schedules</div>
                          <div>{tokenBeneficiaries.length} beneficiaries</div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingToken(token.id);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTokenConfig(token.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="px-6 pb-6 space-y-6">
                      {/* Token Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <Label className="text-muted-foreground">Name</Label>
                          <p className="font-medium">
                            {token.name || "Not set"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">
                            Symbol
                          </Label>
                          <p className="font-medium">
                            {token.symbol || "Not set"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">
                            Total Supply
                          </Label>
                          <p className="font-medium">
                            {token.totalSupply || "Not set"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">
                            Decimals
                          </Label>
                          <p className="font-medium">{token.decimals}</p>
                        </div>
                      </div>

                      <Separator />

                      {/* Vesting Schedules */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Vesting Schedules ({tokenSchedules.length})
                          </h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addNewVestingSchedule(token.id)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Schedule
                          </Button>
                        </div>

                        {tokenSchedules.map((schedule) => (
                          <Card key={schedule.id} className="p-4">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-4">
                                <Badge>{schedule.category || "Unnamed"}</Badge>
                                <div className="text-sm text-muted-foreground">
                                  {schedule.cliffMonths}mo cliff •{" "}
                                  {schedule.vestingMonths}mo vesting
                                  {schedule.revocable && " • Revocable"}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setEditingSchedule(schedule.id)
                                  }
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    removeVestingSchedule(schedule.id)
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}

                        {tokenSchedules.length === 0 && (
                          <Card className="border-dashed p-8 text-center">
                            <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">
                              No vesting schedules configured
                            </p>
                          </Card>
                        )}
                      </div>

                      <Separator />

                      {/* Beneficiaries */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Beneficiaries ({tokenBeneficiaries.length})
                            <Badge variant="outline">
                              Total: {totalAllocation.toLocaleString()}
                            </Badge>
                          </h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addNewBeneficiary(token.id)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Beneficiary
                          </Button>
                        </div>

                        {tokenBeneficiaries.map((beneficiary) => (
                          <Card key={beneficiary.id} className="p-4">
                            <div className="flex justify-between items-center">
                              <div className="flex-1 grid grid-cols-3 gap-4">
                                <div>
                                  <Label className="text-xs text-muted-foreground">
                                    Address
                                  </Label>
                                  <p className="text-sm font-mono">
                                    {beneficiary.address
                                      ? `${beneficiary.address.slice(
                                          0,
                                          8
                                        )}...${beneficiary.address.slice(-6)}`
                                      : "Not set"}
                                  </p>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">
                                    Amount
                                  </Label>
                                  <p className="text-sm font-medium">
                                    {parseFloat(
                                      beneficiary.amount || "0"
                                    ).toLocaleString()}
                                  </p>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">
                                    Category
                                  </Label>
                                  <Badge variant="outline">
                                    {beneficiary.category || "None"}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setEditingBeneficiary(beneficiary.id)
                                  }
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    removeBeneficiary(beneficiary.id)
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}

                        {tokenBeneficiaries.length === 0 && (
                          <Card className="border-dashed p-8 text-center">
                            <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">
                              No beneficiaries configured
                            </p>
                          </Card>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Validation Errors */}
        {!validation.isValid && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800 text-lg">
                Configuration Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {validation.errors.map((error, index) => (
                  <li key={index} className="text-sm text-red-700">
                    • {error}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-6">
          <Button
            variant="outline"
            onClick={onPrevious}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            onClick={handleNext}
            disabled={!validation.isValid}
            className="flex items-center gap-2"
          >
            Continue to Review
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Edit Dialogs */}
        <TokenEditDialog
          tokenId={editingToken}
          onClose={() => setEditingToken(null)}
        />
        <ScheduleEditDialog
          scheduleId={editingSchedule}
          onClose={() => setEditingSchedule(null)}
        />
        <BeneficiaryEditDialog
          beneficiaryId={editingBeneficiary}
          onClose={() => setEditingBeneficiary(null)}
        />
      </CardContent>
    </Card>
  );
}

// Token Edit Dialog Component
function TokenEditDialog({
  tokenId,
  onClose,
}: {
  tokenId: string | null;
  onClose: () => void;
}) {
  const { tokenConfigs, updateTokenConfig } = useBatchDeploymentStore();
  const token = tokenConfigs.find((t) => t.id === tokenId);

  const form = useForm({
    resolver: zodResolver(
      z.object({
        name: z.string().min(1, "Name is required"),
        symbol: z
          .string()
          .min(1, "Symbol is required")
          .max(10, "Symbol too long"),
        totalSupply: z.string().min(1, "Total supply is required"),
        decimals: z.number().min(0).max(18),
        description: z.string().optional(),
        website: z.string().url().optional().or(z.literal("")),
        logo: z.string().url().optional().or(z.literal("")),
      })
    ),
    defaultValues: token || {
      name: "",
      symbol: "",
      totalSupply: "",
      decimals: 18,
      description: "",
      website: "",
      logo: "",
    },
  });

  useEffect(() => {
    if (token) {
      form.reset(token);
    }
  }, [token, form]);

  const onSubmit = (data: any) => {
    if (tokenId) {
      updateTokenConfig(tokenId, data);
      onClose();
    }
  };

  if (!token) return null;

  return (
    <Dialog open={!!tokenId} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Token</DialogTitle>
          <DialogDescription>Update the token configuration</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Token Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., MyProject Token" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Symbol</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., MPT"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value.toUpperCase())
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="totalSupply"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Supply</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., 1000000"
                      {...field}
                      type="number"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="decimals"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Decimals</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max="18"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Schedule Edit Dialog Component
function ScheduleEditDialog({
  scheduleId,
  onClose,
}: {
  scheduleId: string | null;
  onClose: () => void;
}) {
  const { vestingSchedules, updateVestingSchedule } = useBatchDeploymentStore();
  const schedule = vestingSchedules.find((s) => s.id === scheduleId);

  const form = useForm({
    resolver: zodResolver(
      z.object({
        category: z.string().min(1, "Category is required"),
        cliffMonths: z.number().min(0, "Cliff must be 0 or positive"),
        vestingMonths: z
          .number()
          .min(1, "Vesting duration must be at least 1 month"),
        revocable: z.boolean(),
      })
    ),
    defaultValues: schedule || {
      category: "",
      cliffMonths: 0,
      vestingMonths: 12,
      revocable: false,
    },
  });

  useEffect(() => {
    if (schedule) {
      form.reset(schedule);
    }
  }, [schedule, form]);

  const onSubmit = (data: any) => {
    if (scheduleId) {
      updateVestingSchedule(scheduleId, data);
      onClose();
    }
  };

  if (!schedule) return null;

  return (
    <Dialog open={!!scheduleId} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Vesting Schedule</DialogTitle>
          <DialogDescription>
            Update the vesting schedule configuration
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Team">Team</SelectItem>
                      <SelectItem value="Advisors">Advisors</SelectItem>
                      <SelectItem value="Investors">Investors</SelectItem>
                      <SelectItem value="Community">Community</SelectItem>
                      <SelectItem value="Reserve">Reserve</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cliffMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliff Period (Months)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vestingMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vesting Duration (Months)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 1)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="revocable"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Revocable</FormLabel>
                    <FormDescription>
                      Can this vesting schedule be revoked?
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Beneficiary Edit Dialog Component
function BeneficiaryEditDialog({
  beneficiaryId,
  onClose,
}: {
  beneficiaryId: string | null;
  onClose: () => void;
}) {
  const { beneficiaries, updateBeneficiary, vestingSchedules } =
    useBatchDeploymentStore();
  const beneficiary = beneficiaries.find((b) => b.id === beneficiaryId);

  // Get available categories for this token
  const availableCategories = beneficiary
    ? vestingSchedules
        .filter((s) => s.tokenId === beneficiary.tokenId)
        .map((s) => s.category)
    : [];

  const form = useForm({
    resolver: zodResolver(
      z.object({
        address: z
          .string()
          .min(1, "Address is required")
          .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
        amount: z
          .string()
          .min(1, "Amount is required")
          .regex(/^\d+(\.\d+)?$/, "Must be a valid number"),
        category: z.string().min(1, "Category is required"),
      })
    ),
    defaultValues: beneficiary || {
      address: "",
      amount: "",
      category: "",
    },
  });

  useEffect(() => {
    if (beneficiary) {
      form.reset(beneficiary);
    }
  }, [beneficiary, form]);

  const onSubmit = (data: any) => {
    if (beneficiaryId) {
      updateBeneficiary(beneficiaryId, data);
      onClose();
    }
  };

  if (!beneficiary) return null;

  return (
    <Dialog open={!!beneficiaryId} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Beneficiary</DialogTitle>
          <DialogDescription>
            Update the beneficiary information
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Wallet Address</FormLabel>
                  <FormControl>
                    <Input placeholder="0x..." {...field} />
                  </FormControl>
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
                    <Input placeholder="e.g., 10000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Category must match an existing vesting schedule
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
