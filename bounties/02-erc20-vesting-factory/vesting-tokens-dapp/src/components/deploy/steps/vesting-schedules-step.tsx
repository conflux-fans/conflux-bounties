// src/components/deploy/steps/vesting-schedules-step.tsx
"use client";

import { useState } from "react";
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
import { useDeploymentStore, VestingSchedule } from "@/store/deployment-store";
import {
  Clock,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Calendar,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const vestingScheduleSchema = z.object({
  category: z.string().min(1, "Category is required"),
  cliffMonths: z
    .number()
    .min(0, "Cliff must be 0 or positive")
    .max(60, "Cliff too long"),
  vestingMonths: z
    .number()
    .min(1, "Vesting duration must be at least 1 month")
    .max(120, "Vesting too long"),
  revocable: z.boolean(),
  description: z.string().optional(),
});

type VestingScheduleForm = z.infer<typeof vestingScheduleSchema>;

interface VestingSchedulesStepProps {
  onNext: () => void;
  onPrevious: () => void;
}

export function VestingSchedulesStep({
  onNext,
  onPrevious,
}: VestingSchedulesStepProps) {
  const {
    vestingSchedules,
    addVestingSchedule,
    updateVestingSchedule,
    removeVestingSchedule,
  } = useDeploymentStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<VestingSchedule | null>(null);

  const form = useForm<VestingScheduleForm>({
    resolver: zodResolver(vestingScheduleSchema),
    defaultValues: {
      category: "",
      cliffMonths: 0,
      vestingMonths: 12,
      revocable: false,
      description: "",
    },
  });

  const onSubmit = (data: VestingScheduleForm) => {
    const schedule: VestingSchedule = {
      id: editingSchedule?.id || crypto.randomUUID(),
      ...data,
    };

    if (editingSchedule) {
      updateVestingSchedule(editingSchedule.id, schedule);
    } else {
      addVestingSchedule(schedule);
    }

    form.reset();
    setEditingSchedule(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (schedule: VestingSchedule) => {
    setEditingSchedule(schedule);
    form.reset(schedule);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    removeVestingSchedule(id);
  };

  const calculateTotalDuration = (cliff: number, vesting: number) => {
    return cliff + vesting;
  };

  const predefinedCategories = [
    {
      value: "team",
      label: "Team & Founders",
      defaultCliff: 12,
      defaultVesting: 36,
    },
    {
      value: "investors",
      label: "Investors",
      defaultCliff: 6,
      defaultVesting: 24,
    },
    {
      value: "advisors",
      label: "Advisors",
      defaultCliff: 3,
      defaultVesting: 12,
    },
    {
      value: "community",
      label: "Community",
      defaultCliff: 0,
      defaultVesting: 6,
    },
    {
      value: "treasury",
      label: "Treasury",
      defaultCliff: 0,
      defaultVesting: 48,
    },
    {
      value: "custom",
      label: "Custom Category",
      defaultCliff: 0,
      defaultVesting: 12,
    },
  ];

  const handleCategoryChange = (category: string) => {
    const predefined = predefinedCategories.find((c) => c.value === category);
    if (predefined && category !== "custom") {
      form.setValue("cliffMonths", predefined.defaultCliff);
      form.setValue("vestingMonths", predefined.defaultVesting);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Vesting Schedules
          </CardTitle>
          <CardDescription>
            Create different vesting schedules for various stakeholder groups
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {vestingSchedules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No vesting schedules created yet</p>
                <p className="text-sm">
                  Add your first vesting schedule to continue
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {vestingSchedules.map((schedule) => (
                  <Card key={schedule.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="secondary">{schedule.category}</Badge>
                          {schedule.revocable && (
                            <Badge variant="outline">Revocable</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">
                              Cliff Period:
                            </span>
                            <p className="font-medium">
                              {schedule.cliffMonths} months
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Vesting Duration:
                            </span>
                            <p className="font-medium">
                              {schedule.vestingMonths} months
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Total Duration:
                            </span>
                            <p className="font-medium">
                              {calculateTotalDuration(
                                schedule.cliffMonths,
                                schedule.vestingMonths
                              )}{" "}
                              months
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Type:</span>
                            <p className="font-medium">
                              {schedule.cliffMonths > 0
                                ? "Cliff + Linear"
                                : "Linear Only"}
                            </p>
                          </div>
                        </div>
                        {schedule.description && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {schedule.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(schedule)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(schedule.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingSchedule(null);
                    form.reset();
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Vesting Schedule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingSchedule
                      ? "Edit Vesting Schedule"
                      : "Create Vesting Schedule"}
                  </DialogTitle>
                  <DialogDescription>
                    Configure the vesting parameters for this stakeholder group
                  </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              handleCategoryChange(value);
                            }}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {predefinedCategories.map((category) => (
                                <SelectItem
                                  key={category.value}
                                  value={category.value}
                                >
                                  {category.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose a predefined category or create a custom one
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("category") === "custom" && (
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom Category Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter custom category name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="cliffMonths"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cliff Period (Months)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                max={60}
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseInt(e.target.value) || 0)
                                }
                              />
                            </FormControl>
                            <FormDescription>
                              Period before vesting starts (0 = no cliff)
                            </FormDescription>
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
                                min={1}
                                max={120}
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseInt(e.target.value) || 12)
                                }
                              />
                            </FormControl>
                            <FormDescription>
                              Duration of linear vesting period
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="revocable"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              Revocable
                            </FormLabel>
                            <FormDescription>
                              Allow the owner to revoke unvested tokens
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

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe this vesting schedule..."
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Additional details about this vesting schedule
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Preview */}
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">
                        Vesting Schedule Preview
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">
                            Cliff Period:
                          </span>
                          <p>{form.watch("cliffMonths")} months</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Vesting Duration:
                          </span>
                          <p>{form.watch("vestingMonths")} months</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Total Duration:
                          </span>
                          <p>
                            {calculateTotalDuration(
                              form.watch("cliffMonths"),
                              form.watch("vestingMonths")
                            )}{" "}
                            months
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Type:</span>
                          <p>
                            {form.watch("cliffMonths") > 0
                              ? "Cliff + Linear"
                              : "Linear Only"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingSchedule ? "Update Schedule" : "Add Schedule"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrevious}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        <Button onClick={onNext} disabled={vestingSchedules.length === 0}>
          Continue to Beneficiaries
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
