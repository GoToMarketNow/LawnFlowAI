import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCustomers, useCreateJob } from "@/lib/api/hooks";
import { Loader2, Calendar as CalendarIcon, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const jobSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  serviceType: z.string().min(1, "Service type is required"),
  scheduledDate: z.string().min(1, "Scheduled date is required"),
  amount: z.string().transform((val) => (val ? Math.round(parseFloat(val) * 100) : 0)),
  notes: z.string().optional(),
  customerNotes: z.string().optional(),
  accessInstructions: z.string().optional(),
});

type JobFormValues = z.infer<typeof jobSchema>;

export function CreateJobDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const { data: customersData, isLoading: isLoadingCustomers } = useCustomers();
  const createJobMutation = useCreateJob();

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      customerId: "",
      serviceType: "mowing",
      scheduledDate: new Date().toISOString().split("T")[0],
      amount: "",
      notes: "",
      customerNotes: "",
      accessInstructions: "",
    },
  });

  const onSubmit = (values: any) => {
    // Find customer name for the API call (though the backend should probably handle this by ID)
    const customer = customersData?.customers.find((c: any) => c.id.toString() === values.customerId);
    
    createJobMutation.mutate(
      {
        ...values,
        customerId: parseInt(values.customerId),
        customerName: customer?.name || "Unknown",
        customerPhone: customer?.phone || "Unknown",
        customerAddress: customer?.primaryAddress || "",
        status: "pending",
      },
      {
        onSuccess: () => {
          toast({
            title: "Job Created",
            description: "The new job has been successfully created and added to the queue.",
          });
          onOpenChange(false);
          form.reset();
        },
        onError: (error) => {
          toast({
            title: "Failed to create job",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const serviceTypes = [
    { value: "mowing", label: "Lawn Mowing" },
    { value: "cleanup", label: "Spring/Fall Cleanup" },
    { value: "mulch", label: "Mulching" },
    { value: "landscaping", label: "Landscaping" },
    { value: "irrigation", label: "Irrigation" },
    { value: "other", label: "Other Service" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Job</DialogTitle>
          <DialogDescription>
            Manually add a new service job to the system.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer Selection */}
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingCustomers ? "Loading customers..." : "Select customer"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customersData?.customers.map((customer: any) => (
                          <SelectItem key={customer.id} value={customer.id.toString()}>
                            {customer.name} ({customer.phone})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Service Type */}
              <FormField
                control={form.control}
                name="serviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {serviceTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Scheduled Date */}
              <FormField
                control={form.control}
                name="scheduledDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scheduled Date</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="date" {...field} className="pl-10" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price ($)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="number" step="0.01" placeholder="0.00" {...field} className="pl-10" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Notes (Visible to Staff)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Administrative notes about this job..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer Notes */}
              <FormField
                control={form.control}
                name="customerNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Instructions (Visible to Crew)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Instructions from the customer..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Access Instructions */}
              <FormField
                control={form.control}
                name="accessInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access Instructions (Gate codes, etc.)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="How to get on site..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createJobMutation.isPending}>
                {createJobMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Job
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
