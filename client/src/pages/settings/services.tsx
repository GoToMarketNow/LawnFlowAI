import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Plus, 
  Settings2, 
  DollarSign, 
  Clock, 
  Snowflake, 
  Leaf, 
  TreeDeciduous, 
  Trash2,
  Paintbrush,
  Package,
  ChevronRight,
  Tag,
  Loader2,
  Calendar,
} from "lucide-react";
import type { Service, PromotionRule, InsertService, ServicePricing, ServiceFrequencyOption, SnowServicePolicy } from "@shared/schema";

const serviceFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  category: z.enum(["LAWN", "TREE", "SNOW", "CLEANUP", "CUSTOM"]),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  serviceType: z.enum(["RECURRING", "ONE_TIME", "SEASONAL", "EVENT_BASED"]),
  requiresManualQuote: z.boolean().default(false),
  defaultDurationMinutes: z.coerce.number().min(0).optional().nullable(),
  requiresLeadTime: z.boolean().default(false),
  defaultLeadTimeDays: z.coerce.number().min(0).optional().nullable(),
  includesMaterials: z.boolean().default(false),
  requiresQualifiedCrew: z.boolean().default(false),
});

type ServiceFormValues = z.infer<typeof serviceFormSchema>;

const promotionFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  appliesToCategory: z.string().optional().nullable(),
  condition: z.enum(["FIRST_TIME_CUSTOMER", "RECURRING_COMMITMENT", "BUNDLE", "SEASONAL"]),
  discountType: z.enum(["PERCENT", "FLAT"]),
  discountValue: z.coerce.number(),
  requiresFrequency: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

type PromotionFormValues = z.infer<typeof promotionFormSchema>;

const pricingFormSchema = z.object({
  pricingModel: z.enum(["FLAT", "PER_VISIT", "PER_EVENT", "PER_SQFT", "RANGE"]),
  minPrice: z.coerce.number().min(0),
  targetPrice: z.coerce.number().min(0),
  maxPrice: z.coerce.number().min(0),
  unitLabel: z.string().optional().nullable(),
  appliesToFrequency: z.enum(["ONE_TIME", "RECURRING", "BOTH"]).default("BOTH"),
  materialCostIncluded: z.boolean().default(false),
  materialCostEstimate: z.coerce.number().min(0).optional().nullable(),
});

type PricingFormValues = z.infer<typeof pricingFormSchema>;

const frequencyFormSchema = z.object({
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "SEASONAL", "ON_DEMAND"]),
  priceModifierPercent: z.coerce.number(),
  isDefault: z.boolean().default(false),
});

const snowPolicyFormSchema = z.object({
  mode: z.enum(["ROTATION", "ON_DEMAND"]),
  priceModifierPercent: z.coerce.number().default(0),
  priorityLevel: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
  notes: z.string().optional().nullable(),
});

type FrequencyFormValues = z.infer<typeof frequencyFormSchema>;
type SnowPolicyFormValues = z.infer<typeof snowPolicyFormSchema>;

interface ServiceWithDetails extends Service {
  pricing?: ServicePricing[];
  frequencyOptions?: ServiceFrequencyOption[];
  snowPolicy?: SnowServicePolicy | null;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LAWN: Leaf,
  TREE: TreeDeciduous,
  SNOW: Snowflake,
  CLEANUP: Paintbrush,
  CUSTOM: Package,
};

const CATEGORY_COLORS: Record<string, string> = {
  LAWN: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  TREE: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  SNOW: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  CLEANUP: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  CUSTOM: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function ServiceFormDialog({
  open,
  onOpenChange,
  service,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Service | null;
}) {
  const { toast } = useToast();
  const isEditing = !!service;

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      name: "",
      category: "LAWN",
      description: "",
      isActive: true,
      serviceType: "RECURRING",
      requiresManualQuote: false,
      defaultDurationMinutes: null,
      requiresLeadTime: false,
      defaultLeadTimeDays: null,
      includesMaterials: false,
      requiresQualifiedCrew: false,
    },
  });

  useEffect(() => {
    if (service) {
      form.reset({
        name: service.name || "",
        category: (service.category as ServiceFormValues["category"]) || "LAWN",
        description: service.description || "",
        isActive: service.isActive ?? true,
        serviceType: (service.serviceType as ServiceFormValues["serviceType"]) || "RECURRING",
        requiresManualQuote: service.requiresManualQuote ?? false,
        defaultDurationMinutes: service.defaultDurationMinutes ?? null,
        requiresLeadTime: service.requiresLeadTime ?? false,
        defaultLeadTimeDays: service.defaultLeadTimeDays ?? null,
        includesMaterials: service.includesMaterials ?? false,
        requiresQualifiedCrew: service.requiresQualifiedCrew ?? false,
      });
    } else {
      form.reset({
        name: "",
        category: "LAWN",
        description: "",
        isActive: true,
        serviceType: "RECURRING",
        requiresManualQuote: false,
        defaultDurationMinutes: null,
        requiresLeadTime: false,
        defaultLeadTimeDays: null,
        includesMaterials: false,
        requiresQualifiedCrew: false,
      });
    }
  }, [service, form]);

  const createMutation = useMutation({
    mutationFn: (data: ServiceFormValues) =>
      apiRequest("POST", "/api/services", { ...data, accountId: 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({ title: "Service created", description: "New service added to catalog" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create service", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ServiceFormValues) =>
      apiRequest("PATCH", `/api/services/${service?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({ title: "Service updated", description: "Changes saved successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update service", variant: "destructive" });
    },
  });

  const onSubmit = (data: ServiceFormValues) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Service" : "Add Service"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update service details and settings"
              : "Create a new service for your catalog"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Weekly Lawn Mowing" {...field} data-testid="input-service-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="LAWN">Lawn Care</SelectItem>
                        <SelectItem value="TREE">Tree Service</SelectItem>
                        <SelectItem value="SNOW">Snow Removal</SelectItem>
                        <SelectItem value="CLEANUP">Cleanup</SelectItem>
                        <SelectItem value="CUSTOM">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-service-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="RECURRING">Recurring</SelectItem>
                        <SelectItem value="ONE_TIME">One-Time</SelectItem>
                        <SelectItem value="SEASONAL">Seasonal</SelectItem>
                        <SelectItem value="EVENT_BASED">Event-Based</SelectItem>
                      </SelectContent>
                    </Select>
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what this service includes..."
                      className="resize-none"
                      {...field}
                      data-testid="textarea-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="defaultDurationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="60"
                        {...field}
                        value={field.value ?? ""}
                        data-testid="input-duration"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="defaultLeadTimeDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Time (days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        value={field.value ?? ""}
                        data-testid="input-lead-time"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3 pt-2">
              <FormField
                control={form.control}
                name="requiresManualQuote"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-manual-quote"
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="font-normal">Requires manual quote</FormLabel>
                      <FormDescription className="text-xs">
                        Cannot be auto-quoted by AI
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="requiresLeadTime"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-lead-time"
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="font-normal">Requires lead time</FormLabel>
                      <FormDescription className="text-xs">
                        Cannot be scheduled same-day
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="includesMaterials"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-materials"
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="font-normal">Includes materials</FormLabel>
                      <FormDescription className="text-xs">
                        Service price includes material costs
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="requiresQualifiedCrew"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-qualified-crew"
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="font-normal">Requires qualified crew</FormLabel>
                      <FormDescription className="text-xs">
                        Only certified crews can perform
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-active"
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="font-normal">Active</FormLabel>
                      <FormDescription className="text-xs">
                        Available for quoting and scheduling
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-service">
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Service"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function PromotionFormDialog({
  open,
  onOpenChange,
  promotion,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotion?: PromotionRule | null;
}) {
  const { toast } = useToast();
  const isEditing = !!promotion;

  const form = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: {
      name: "",
      appliesToCategory: null,
      condition: "SEASONAL",
      discountType: "PERCENT",
      discountValue: 10,
      requiresFrequency: null,
      isActive: true,
    },
  });

  useEffect(() => {
    if (promotion) {
      form.reset({
        name: promotion.name || "",
        appliesToCategory: promotion.appliesToCategory || null,
        condition: (promotion.condition as PromotionFormValues["condition"]) || "SEASONAL",
        discountType: (promotion.discountType as PromotionFormValues["discountType"]) || "PERCENT",
        discountValue: promotion.discountValue ?? 10,
        requiresFrequency: promotion.requiresFrequency || null,
        isActive: promotion.isActive ?? true,
      });
    } else {
      form.reset({
        name: "",
        appliesToCategory: null,
        condition: "SEASONAL",
        discountType: "PERCENT",
        discountValue: 10,
        requiresFrequency: null,
        isActive: true,
      });
    }
  }, [promotion, form]);

  const createMutation = useMutation({
    mutationFn: (data: PromotionFormValues) =>
      apiRequest("POST", "/api/promotions", { ...data, accountId: 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions"] });
      toast({ title: "Promotion created", description: "New promotion added" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create promotion", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: PromotionFormValues) =>
      apiRequest("PATCH", `/api/promotions/${promotion?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions"] });
      toast({ title: "Promotion updated", description: "Changes saved successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update promotion", variant: "destructive" });
    },
  });

  const onSubmit = (data: PromotionFormValues) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const discountType = form.watch("discountType");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Promotion" : "Add Promotion"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update promotion settings"
              : "Create a new discount or pricing rule"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Promotion Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Spring Special 20% Off" {...field} data-testid="input-promotion-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="condition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condition</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-condition">
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="FIRST_TIME_CUSTOMER">First Time Customer</SelectItem>
                      <SelectItem value="RECURRING_COMMITMENT">Recurring Commitment</SelectItem>
                      <SelectItem value="BUNDLE">Bundle Discount</SelectItem>
                      <SelectItem value="SEASONAL">Seasonal Offer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="appliesToCategory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Applies To Category (optional)</FormLabel>
                  <Select 
                    onValueChange={(val) => field.onChange(val === "ALL" ? null : val)} 
                    value={field.value || "ALL"}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-applies-category">
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ALL">All Categories</SelectItem>
                      <SelectItem value="LAWN">Lawn Care</SelectItem>
                      <SelectItem value="TREE">Tree Service</SelectItem>
                      <SelectItem value="SNOW">Snow Removal</SelectItem>
                      <SelectItem value="CLEANUP">Cleanup</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="discountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-discount-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PERCENT">Percentage</SelectItem>
                        <SelectItem value="FLAT">Flat Amount</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discountValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{discountType === "PERCENT" ? "Discount %" : "Amount (cents)"}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={discountType === "PERCENT" ? "10" : "500"}
                        {...field}
                        data-testid="input-discount-value"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      {discountType === "PERCENT" ? "Negative = surcharge" : "Use cents (500 = $5)"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-promotion-active"
                    />
                  </FormControl>
                  <FormLabel className="font-normal">Active</FormLabel>
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-promotion"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-promotion">
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Promotion"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ServiceCard({ service, onEdit, onViewPricing }: { service: Service; onEdit: (s: Service) => void; onViewPricing: (id: number) => void }) {
  const { toast } = useToast();
  const CategoryIcon = CATEGORY_ICONS[service.category || "CUSTOM"] || Package;
  
  const toggleActive = useMutation({
    mutationFn: () => 
      apiRequest("PATCH", `/api/services/${service.id}`, { isActive: !service.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({
        title: service.isActive ? "Service deactivated" : "Service activated",
        description: `${service.name} is now ${service.isActive ? "inactive" : "active"}`,
      });
    },
  });

  return (
    <Card className={`${!service.isActive ? "opacity-60" : ""}`} data-testid={`card-service-${service.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-md ${CATEGORY_COLORS[service.category || "CUSTOM"]}`}>
            <CategoryIcon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium truncate" data-testid={`text-service-name-${service.id}`}>
                {service.name}
              </h3>
              {service.requiresManualQuote && (
                <Badge variant="outline" className="text-xs shrink-0">Manual Quote</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {service.description}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs">
                {service.category}
              </Badge>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {service.defaultDurationMinutes || "--"} min
              </span>
              {service.requiresLeadTime && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  {service.defaultLeadTimeDays || 0} day lead
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Switch
              checked={service.isActive || false}
              onCheckedChange={() => toggleActive.mutate()}
              disabled={toggleActive.isPending}
              data-testid={`switch-service-active-${service.id}`}
            />
            <div className="flex gap-1">
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => onViewPricing(service.id)}
                data-testid={`button-pricing-service-${service.id}`}
              >
                <DollarSign className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => onEdit(service)}
                data-testid={`button-edit-service-${service.id}`}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PromotionCard({ promotion, onEdit }: { promotion: PromotionRule; onEdit: (p: PromotionRule) => void }) {
  const isDiscount = (promotion.discountValue || 0) >= 0;
  
  return (
    <Card data-testid={`card-promotion-${promotion.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-md ${isDiscount ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
            <Tag className={`h-4 w-4 ${isDiscount ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`} />
          </div>
          <div className="flex-1">
            <h4 className="font-medium" data-testid={`text-promotion-name-${promotion.id}`}>
              {promotion.name}
            </h4>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {promotion.discountType === "PERCENT" 
                  ? `${Math.abs(promotion.discountValue || 0)}%` 
                  : formatCents(Math.abs(promotion.discountValue || 0))}
                {isDiscount ? " off" : " surcharge"}
              </span>
              {promotion.condition && (
                <Badge variant="outline" className="text-xs">{promotion.condition}</Badge>
              )}
            </div>
          </div>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => onEdit(promotion)}
            data-testid={`button-edit-promotion-${promotion.id}`}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          <Badge variant={promotion.isActive ? "default" : "secondary"}>
            {promotion.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function ServiceDetailDialog({
  open,
  onOpenChange,
  serviceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: number | null;
}) {
  const { toast } = useToast();
  const [showPricingForm, setShowPricingForm] = useState(false);
  const [editingPricing, setEditingPricing] = useState<ServicePricing | null>(null);
  const [showFrequencyForm, setShowFrequencyForm] = useState(false);
  const [editingFrequency, setEditingFrequency] = useState<ServiceFrequencyOption | null>(null);
  const [showSnowPolicyForm, setShowSnowPolicyForm] = useState(false);

  const { data: serviceDetails, isLoading } = useQuery<ServiceWithDetails>({
    queryKey: ["/api/services", serviceId],
    enabled: !!serviceId && open,
  });

  const isSnowService = serviceDetails?.category === "SNOW";

  const pricingForm = useForm<PricingFormValues>({
    resolver: zodResolver(pricingFormSchema),
    defaultValues: {
      pricingModel: "FLAT",
      minPrice: 0,
      targetPrice: 0,
      maxPrice: 0,
      unitLabel: null,
      appliesToFrequency: "BOTH",
      materialCostIncluded: false,
      materialCostEstimate: null,
    },
  });

  const frequencyForm = useForm<FrequencyFormValues>({
    resolver: zodResolver(frequencyFormSchema),
    defaultValues: {
      frequency: "WEEKLY",
      priceModifierPercent: 0,
      isDefault: false,
    },
  });

  const snowPolicyForm = useForm<SnowPolicyFormValues>({
    resolver: zodResolver(snowPolicyFormSchema),
    defaultValues: {
      mode: "ROTATION",
      priceModifierPercent: 0,
      priorityLevel: "NORMAL",
      notes: null,
    },
  });

  useEffect(() => {
    if (serviceDetails?.snowPolicy) {
      snowPolicyForm.reset({
        mode: serviceDetails.snowPolicy.mode as SnowPolicyFormValues["mode"],
        priceModifierPercent: serviceDetails.snowPolicy.priceModifierPercent || 0,
        priorityLevel: (serviceDetails.snowPolicy.priorityLevel as SnowPolicyFormValues["priorityLevel"]) || "NORMAL",
        notes: serviceDetails.snowPolicy.notes || null,
      });
      setShowSnowPolicyForm(true);
    } else if (isSnowService) {
      snowPolicyForm.reset({
        mode: "ROTATION",
        priceModifierPercent: 0,
        priorityLevel: "NORMAL",
        notes: null,
      });
      setShowSnowPolicyForm(false);
    }
  }, [serviceDetails?.snowPolicy, isSnowService, snowPolicyForm]);

  useEffect(() => {
    if (editingPricing) {
      pricingForm.reset({
        pricingModel: editingPricing.pricingModel as PricingFormValues["pricingModel"],
        minPrice: (editingPricing.minPrice || 0) / 100,
        targetPrice: (editingPricing.targetPrice || 0) / 100,
        maxPrice: (editingPricing.maxPrice || 0) / 100,
        unitLabel: editingPricing.unitLabel || null,
        appliesToFrequency: (editingPricing.appliesToFrequency as PricingFormValues["appliesToFrequency"]) || "BOTH",
        materialCostIncluded: editingPricing.materialCostIncluded || false,
        materialCostEstimate: editingPricing.materialCostEstimate ? editingPricing.materialCostEstimate / 100 : null,
      });
    } else {
      pricingForm.reset({
        pricingModel: "FLAT",
        minPrice: 0,
        targetPrice: 0,
        maxPrice: 0,
        unitLabel: null,
        appliesToFrequency: "BOTH",
        materialCostIncluded: false,
        materialCostEstimate: null,
      });
    }
  }, [editingPricing, pricingForm]);

  useEffect(() => {
    if (editingFrequency) {
      frequencyForm.reset({
        frequency: editingFrequency.frequency as FrequencyFormValues["frequency"],
        priceModifierPercent: editingFrequency.priceModifierPercent || 0,
        isDefault: editingFrequency.isDefault || false,
      });
    } else {
      frequencyForm.reset({
        frequency: "WEEKLY",
        priceModifierPercent: 0,
        isDefault: false,
      });
    }
  }, [editingFrequency, frequencyForm]);

  const createPricingMutation = useMutation({
    mutationFn: (data: PricingFormValues) =>
      apiRequest("POST", `/api/services/${serviceId}/pricing`, {
        ...data,
        minPrice: Math.round(data.minPrice * 100),
        targetPrice: Math.round(data.targetPrice * 100),
        maxPrice: Math.round(data.maxPrice * 100),
        materialCostEstimate: data.materialCostEstimate ? Math.round(data.materialCostEstimate * 100) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services", serviceId] });
      toast({ title: "Pricing added" });
      setShowPricingForm(false);
      pricingForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add pricing", variant: "destructive" });
    },
  });

  const updatePricingMutation = useMutation({
    mutationFn: (data: PricingFormValues) =>
      apiRequest("PATCH", `/api/service-pricing/${editingPricing?.id}`, {
        ...data,
        minPrice: Math.round(data.minPrice * 100),
        targetPrice: Math.round(data.targetPrice * 100),
        maxPrice: Math.round(data.maxPrice * 100),
        materialCostEstimate: data.materialCostEstimate ? Math.round(data.materialCostEstimate * 100) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services", serviceId] });
      toast({ title: "Pricing updated" });
      setShowPricingForm(false);
      setEditingPricing(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update pricing", variant: "destructive" });
    },
  });

  const deletePricingMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/service-pricing/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services", serviceId] });
      toast({ title: "Pricing deleted" });
    },
  });

  const createFrequencyMutation = useMutation({
    mutationFn: (data: FrequencyFormValues) =>
      apiRequest("POST", `/api/services/${serviceId}/frequency-options`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services", serviceId] });
      toast({ title: "Frequency option added" });
      setShowFrequencyForm(false);
      frequencyForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add frequency", variant: "destructive" });
    },
  });

  const updateFrequencyMutation = useMutation({
    mutationFn: (data: FrequencyFormValues) =>
      apiRequest("PATCH", `/api/frequency-options/${editingFrequency?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services", serviceId] });
      toast({ title: "Frequency option updated" });
      setShowFrequencyForm(false);
      setEditingFrequency(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update frequency", variant: "destructive" });
    },
  });

  const deleteFrequencyMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/frequency-options/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services", serviceId] });
      toast({ title: "Frequency option deleted" });
    },
  });

  const saveSnowPolicyMutation = useMutation({
    mutationFn: (data: SnowPolicyFormValues) =>
      apiRequest("POST", `/api/services/${serviceId}/snow-policy`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services", serviceId] });
      toast({ title: "Snow policy saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save snow policy", variant: "destructive" });
    },
  });

  const handleSnowPolicySubmit = (data: SnowPolicyFormValues) => {
    saveSnowPolicyMutation.mutate(data);
  };

  const handlePricingSubmit = (data: PricingFormValues) => {
    if (editingPricing) {
      updatePricingMutation.mutate(data);
    } else {
      createPricingMutation.mutate(data);
    }
  };

  const handleFrequencySubmit = (data: FrequencyFormValues) => {
    if (editingFrequency) {
      updateFrequencyMutation.mutate(data);
    } else {
      createFrequencyMutation.mutate(data);
    }
  };

  const handleAddPricing = () => {
    setEditingPricing(null);
    setShowPricingForm(true);
  };

  const handleEditPricing = (p: ServicePricing) => {
    setEditingPricing(p);
    setShowPricingForm(true);
  };

  const handleAddFrequency = () => {
    setEditingFrequency(null);
    setShowFrequencyForm(true);
  };

  const handleEditFrequency = (f: ServiceFrequencyOption) => {
    setEditingFrequency(f);
    setShowFrequencyForm(true);
  };

  if (!serviceId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{serviceDetails?.name || "Service Details"}</DialogTitle>
          <DialogDescription>
            Manage pricing tiers and frequency options
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="pricing" className="w-full">
            <TabsList className={`grid w-full ${isSnowService ? "grid-cols-3" : "grid-cols-2"}`}>
              <TabsTrigger value="pricing" data-testid="tab-pricing">Pricing</TabsTrigger>
              <TabsTrigger value="frequency" data-testid="tab-frequency">Frequency</TabsTrigger>
              {isSnowService && (
                <TabsTrigger value="snow-policy" data-testid="tab-snow-policy">Snow Policy</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="pricing" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Pricing Tiers</h3>
                <Button size="sm" variant="outline" onClick={handleAddPricing} data-testid="button-add-pricing">
                  <Plus className="h-4 w-4 mr-1" /> Add Pricing
                </Button>
              </div>

              {showPricingForm && (
                <Card className="border-dashed">
                  <CardContent className="p-4">
                    <Form {...pricingForm}>
                      <form onSubmit={pricingForm.handleSubmit(handlePricingSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={pricingForm.control}
                            name="pricingModel"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Pricing Model</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-pricing-model">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="FLAT">Flat Rate</SelectItem>
                                    <SelectItem value="PER_VISIT">Per Visit</SelectItem>
                                    <SelectItem value="PER_EVENT">Per Event</SelectItem>
                                    <SelectItem value="PER_SQFT">Per Sq Ft</SelectItem>
                                    <SelectItem value="RANGE">Price Range</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={pricingForm.control}
                            name="appliesToFrequency"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Applies To</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-applies-to-frequency">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="BOTH">All Customers</SelectItem>
                                    <SelectItem value="ONE_TIME">One-Time Only</SelectItem>
                                    <SelectItem value="RECURRING">Recurring Only</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={pricingForm.control}
                            name="minPrice"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Min Price ($)</FormLabel>
                                <FormControl>
                                  <Input type="number" min="0" step="0.01" {...field} data-testid="input-min-price" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={pricingForm.control}
                            name="targetPrice"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Target Price ($)</FormLabel>
                                <FormControl>
                                  <Input type="number" min="0" step="0.01" {...field} data-testid="input-target-price" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={pricingForm.control}
                            name="maxPrice"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Max Price ($)</FormLabel>
                                <FormControl>
                                  <Input type="number" min="0" step="0.01" {...field} data-testid="input-max-price" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={pricingForm.control}
                            name="unitLabel"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Unit Label (optional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. sq ft, acre" {...field} value={field.value || ""} data-testid="input-unit-label" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={pricingForm.control}
                            name="materialCostEstimate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Material Cost ($)</FormLabel>
                                <FormControl>
                                  <Input type="number" min="0" step="0.01" placeholder="0" {...field} value={field.value ?? ""} data-testid="input-material-cost" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={pricingForm.control}
                          name="materialCostIncluded"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-material-included" />
                              </FormControl>
                              <FormLabel className="m-0">Material cost included in price</FormLabel>
                            </FormItem>
                          )}
                        />

                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="ghost" onClick={() => { setShowPricingForm(false); setEditingPricing(null); }} data-testid="button-cancel-pricing">
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createPricingMutation.isPending || updatePricingMutation.isPending} data-testid="button-save-pricing">
                            {(createPricingMutation.isPending || updatePricingMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {editingPricing ? "Update" : "Add"} Pricing
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              )}

              {serviceDetails?.pricing?.length === 0 && !showPricingForm && (
                <div className="text-center py-6 text-muted-foreground">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No pricing tiers configured</p>
                </div>
              )}

              {serviceDetails?.pricing?.map((p) => (
                <Card key={p.id} data-testid={`card-pricing-${p.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{p.pricingModel}</Badge>
                          <Badge variant="secondary" className="text-xs">{p.appliesToFrequency}</Badge>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">
                            {formatCents(p.minPrice)} - {formatCents(p.maxPrice)}
                          </span>
                          <span className="text-muted-foreground ml-2">
                            (target: {formatCents(p.targetPrice)})
                          </span>
                          {p.unitLabel && <span className="text-muted-foreground ml-1">/ {p.unitLabel}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleEditPricing(p)} data-testid={`button-edit-pricing-${p.id}`}>
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => deletePricingMutation.mutate(p.id)}
                          disabled={deletePricingMutation.isPending}
                          data-testid={`button-delete-pricing-${p.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="frequency" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Frequency Options</h3>
                <Button size="sm" variant="outline" onClick={handleAddFrequency} data-testid="button-add-frequency">
                  <Plus className="h-4 w-4 mr-1" /> Add Option
                </Button>
              </div>

              {showFrequencyForm && (
                <Card className="border-dashed">
                  <CardContent className="p-4">
                    <Form {...frequencyForm}>
                      <form onSubmit={frequencyForm.handleSubmit(handleFrequencySubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={frequencyForm.control}
                            name="frequency"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Frequency</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-frequency">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                                    <SelectItem value="BIWEEKLY">Bi-Weekly</SelectItem>
                                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                                    <SelectItem value="SEASONAL">Seasonal</SelectItem>
                                    <SelectItem value="ON_DEMAND">On Demand</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={frequencyForm.control}
                            name="priceModifierPercent"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Price Modifier (%)</FormLabel>
                                <FormControl>
                                  <Input type="number" placeholder="-10 for discount, +20 for premium" {...field} data-testid="input-price-modifier" />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Negative for discount, positive for premium
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={frequencyForm.control}
                          name="isDefault"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-is-default" />
                              </FormControl>
                              <FormLabel className="m-0">Default option</FormLabel>
                            </FormItem>
                          )}
                        />

                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="ghost" onClick={() => { setShowFrequencyForm(false); setEditingFrequency(null); }} data-testid="button-cancel-frequency">
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createFrequencyMutation.isPending || updateFrequencyMutation.isPending} data-testid="button-save-frequency">
                            {(createFrequencyMutation.isPending || updateFrequencyMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {editingFrequency ? "Update" : "Add"} Option
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              )}

              {serviceDetails?.frequencyOptions?.length === 0 && !showFrequencyForm && (
                <div className="text-center py-6 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No frequency options configured</p>
                </div>
              )}

              {serviceDetails?.frequencyOptions?.map((f) => (
                <Card key={f.id} data-testid={`card-frequency-${f.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{f.frequency}</span>
                            {f.isDefault && <Badge variant="default" className="text-xs">Default</Badge>}
                          </div>
                          <span className={`text-sm ${f.priceModifierPercent < 0 ? "text-green-600 dark:text-green-400" : f.priceModifierPercent > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                            {f.priceModifierPercent > 0 ? "+" : ""}{f.priceModifierPercent}% price modifier
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleEditFrequency(f)} data-testid={`button-edit-frequency-${f.id}`}>
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => deleteFrequencyMutation.mutate(f.id)}
                          disabled={deleteFrequencyMutation.isPending}
                          data-testid={`button-delete-frequency-${f.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {isSnowService && (
              <TabsContent value="snow-policy" className="space-y-4 mt-4">
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-1">Snow Service Configuration</h3>
                  <p className="text-xs text-muted-foreground">
                    Configure how this snow service operates (rotation schedule or on-demand)
                  </p>
                </div>

                <Card>
                  <CardContent className="p-4">
                    <Form {...snowPolicyForm}>
                      <form onSubmit={snowPolicyForm.handleSubmit(handleSnowPolicySubmit)} className="space-y-4">
                        <FormField
                          control={snowPolicyForm.control}
                          name="mode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Service Mode</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-snow-mode">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="ROTATION">Rotation (scheduled visits)</SelectItem>
                                  <SelectItem value="ON_DEMAND">On-Demand (per request)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription className="text-xs">
                                Rotation: automatic service when snowfall exceeds threshold. On-Demand: customer requests each service.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={snowPolicyForm.control}
                            name="priceModifierPercent"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Price Modifier (%)</FormLabel>
                                <FormControl>
                                  <Input type="number" placeholder="0" {...field} data-testid="input-snow-price-modifier" />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Adjust pricing (e.g., +20 for on-demand premium)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={snowPolicyForm.control}
                            name="priorityLevel"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Priority Level</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-snow-priority">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="LOW">Low</SelectItem>
                                    <SelectItem value="NORMAL">Normal</SelectItem>
                                    <SelectItem value="HIGH">High</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={snowPolicyForm.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Policy Notes</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Additional notes about this snow policy..."
                                  className="resize-none"
                                  {...field}
                                  value={field.value || ""}
                                  data-testid="input-snow-notes"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex justify-end">
                          <Button type="submit" disabled={saveSnowPolicyMutation.isPending} data-testid="button-save-snow-policy">
                            {saveSnowPolicyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save Snow Policy
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>

                {serviceDetails?.snowPolicy && (
                  <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Snowflake className="h-4 w-4" />
                      <span>
                        Current mode: <strong>{serviceDetails.snowPolicy.mode}</strong> | 
                        Priority: <strong>{serviceDetails.snowPolicy.priorityLevel}</strong>
                        {serviceDetails.snowPolicy.priceModifierPercent !== 0 && (
                          <> | Modifier: <strong>{serviceDetails.snowPolicy.priceModifierPercent > 0 ? "+" : ""}{serviceDetails.snowPolicy.priceModifierPercent}%</strong></>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
              <Skeleton className="h-6 w-10" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function SettingsServicesPage() {
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<PromotionRule | null>(null);
  const [serviceDetailDialogOpen, setServiceDetailDialogOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);

  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const { data: promotions, isLoading: promotionsLoading } = useQuery<PromotionRule[]>({
    queryKey: ["/api/promotions"],
  });

  const activeServices = services?.filter(s => s.isActive) || [];
  const inactiveServices = services?.filter(s => !s.isActive) || [];

  const handleAddService = () => {
    setEditingService(null);
    setServiceDialogOpen(true);
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setServiceDialogOpen(true);
  };

  const handleViewPricing = (serviceId: number) => {
    setSelectedServiceId(serviceId);
    setServiceDetailDialogOpen(true);
  };

  const handleAddPromotion = () => {
    setEditingPromotion(null);
    setPromotionDialogOpen(true);
  };

  const handleEditPromotion = (promotion: PromotionRule) => {
    setEditingPromotion(promotion);
    setPromotionDialogOpen(true);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Service Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Manage your services, pricing models, and promotions
        </p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Services</h2>
        <Button onClick={handleAddService} data-testid="button-add-service">
          <Plus className="h-4 w-4 mr-2" />
          Add Service
        </Button>
      </div>

      {servicesLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-4 mb-8">
          {activeServices.map((service) => (
            <ServiceCard key={service.id} service={service} onEdit={handleEditService} onViewPricing={handleViewPricing} />
          ))}
          
          {inactiveServices.length > 0 && (
            <>
              <Separator className="my-6" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <span>Inactive Services ({inactiveServices.length})</span>
              </div>
              {inactiveServices.map((service) => (
                <ServiceCard key={service.id} service={service} onEdit={handleEditService} onViewPricing={handleViewPricing} />
              ))}
            </>
          )}
          
          {services?.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-medium mb-2">No services yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add your first service to start building quotes
                </p>
                <Button onClick={handleAddService} data-testid="button-add-first-service">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <ServiceFormDialog
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
        service={editingService}
      />

      <Separator className="my-8" />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-medium">Promotions</h2>
          <p className="text-sm text-muted-foreground">
            Discounts and pricing rules applied automatically
          </p>
        </div>
        <Button variant="outline" onClick={handleAddPromotion} data-testid="button-add-promotion">
          <Plus className="h-4 w-4 mr-2" />
          Add Promotion
        </Button>
      </div>

      {promotionsLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-3">
          {promotions?.map((promotion) => (
            <PromotionCard key={promotion.id} promotion={promotion} onEdit={handleEditPromotion} />
          ))}
          
          {promotions?.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center">
                <Tag className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-medium mb-1">No promotions</h3>
                <p className="text-sm text-muted-foreground">
                  Add promotions to offer discounts to customers
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <PromotionFormDialog
        open={promotionDialogOpen}
        onOpenChange={setPromotionDialogOpen}
        promotion={editingPromotion}
      />

      <ServiceDetailDialog
        open={serviceDetailDialogOpen}
        onOpenChange={setServiceDetailDialogOpen}
        serviceId={selectedServiceId}
      />

      <div className="mt-8 p-4 bg-muted/50 rounded-md">
        <div className="flex items-center gap-2 text-sm">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {activeServices.length} active services, {promotions?.filter(p => p.isActive).length || 0} active promotions
          </span>
        </div>
      </div>
    </div>
  );
}
