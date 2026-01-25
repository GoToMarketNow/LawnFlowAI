import { useEffect } from "react";
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
import { useUpdateCrew, type Crew } from "@/lib/api/hooks";
import { Loader2, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const crewSchema = z.object({
  name: z.string().min(1, "Name is required"),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  homeBaseAddress: z.string().optional(),
});

type CrewFormValues = z.infer<typeof crewSchema>;

export function EditCrewDialog({
  crew,
  open,
  onOpenChange,
}: {
  crew: Crew | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const updateCrewMutation = useUpdateCrew();

  const form = useForm<CrewFormValues>({
    resolver: zodResolver(crewSchema),
    defaultValues: {
      name: "",
      status: "ACTIVE",
      homeBaseAddress: "",
    },
  });

  useEffect(() => {
    if (crew) {
      form.reset({
        name: crew.name,
        status: crew.status,
        homeBaseAddress: crew.homeBaseAddress || "",
      });
    }
  }, [crew, form]);

  const onSubmit = (values: CrewFormValues) => {
    if (!crew) return;
    
    updateCrewMutation.mutate(
      { id: crew.id, data: values },
      {
        onSuccess: () => {
          toast({
            title: "Crew Updated",
            description: "The crew details have been successfully updated.",
          });
          onOpenChange(false);
        },
        onError: (error) => {
          toast({
            title: "Update Failed",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Crew</DialogTitle>
          <DialogDescription>
            Update crew details and status.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Crew Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. North Team" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="homeBaseAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Home Base Address</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Main depot address..." {...field} className="pl-10" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateCrewMutation.isPending}>
                {updateCrewMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
