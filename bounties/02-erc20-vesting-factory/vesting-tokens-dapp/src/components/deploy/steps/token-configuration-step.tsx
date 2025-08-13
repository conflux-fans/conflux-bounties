// src/components/deploy/steps/token-configuration-step.tsx
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useDeploymentStore } from "@/store/deployment-store";
import { Coins, ArrowRight } from "lucide-react";

const tokenConfigSchema = z.object({
  name: z.string().min(1, "Token name is required").max(50, "Name too long"),
  symbol: z
    .string()
    .min(1, "Token symbol is required")
    .max(10, "Symbol too long")
    .regex(/^[A-Z0-9]+$/, "Symbol must be uppercase letters and numbers only"),
  totalSupply: z
    .string()
    .min(1, "Total supply is required")
    .regex(/^\d+(\.\d+)?$/, "Must be a valid number"),
  decimals: z.number().min(0).max(18),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  logo: z.string().url().optional().or(z.literal("")),
});

type TokenConfigForm = z.infer<typeof tokenConfigSchema>;

interface TokenConfigurationStepProps {
  onNext: () => void;
}

export function TokenConfigurationStep({
  onNext,
}: TokenConfigurationStepProps) {
  const { tokenConfig, setTokenConfig } = useDeploymentStore();

  const form = useForm<TokenConfigForm>({
    resolver: zodResolver(tokenConfigSchema),
    defaultValues: {
      name: tokenConfig?.name || "",
      symbol: tokenConfig?.symbol || "",
      totalSupply: tokenConfig?.totalSupply || "",
      decimals: tokenConfig?.decimals ?? 18,
      description: tokenConfig?.description || "",
      website: tokenConfig?.website || "",
      logo: tokenConfig?.logo || "",
    },
  });

  const onSubmit = (data: TokenConfigForm) => {
    setTokenConfig(data);
    onNext();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Token Configuration
        </CardTitle>
        <CardDescription>
          Configure your token's basic information and metadata
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., MyProject Token" {...field} />
                    </FormControl>
                    <FormDescription>
                      The full name of your token
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="symbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token Symbol</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., MPT"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      3-10 character symbol (automatically uppercase)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="totalSupply"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Supply</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 1000000" {...field} />
                    </FormControl>
                    <FormDescription>
                      Total number of tokens to create
                    </FormDescription>
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
                        min={0}
                        max={18}
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 18)
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Number of decimal places (18 is standard)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your token and project..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Brief description of your token and project
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} />
                    </FormControl>
                    <FormDescription>Your project website</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="logo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo URL (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://example.com/logo.png"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Direct link to your token logo
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end pt-6">
              <Button type="submit" className="flex items-center gap-2">
                Continue to Vesting Schedules
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
