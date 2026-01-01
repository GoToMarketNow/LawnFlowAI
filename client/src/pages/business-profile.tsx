import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  Wrench,
  Save,
  Plus,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BusinessProfile } from "@shared/schema";
import { ServiceAreaMap, type ServiceAreaData } from "@/components/service-area-map";

const businessProfileSchema = z.object({
  name: z.string().min(2, "Business name is required"),
  phone: z.string().min(10, "Valid phone number required"),
  email: z.string().email("Valid email required"),
  address: z.string().optional(),
  serviceArea: z.string().optional(),
  businessHours: z.string().optional(),
  autoResponseEnabled: z.boolean().default(true),
});

type BusinessProfileFormData = z.infer<typeof businessProfileSchema>;

export default function BusinessProfilePage() {
  const { toast } = useToast();
  const [newService, setNewService] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [serviceArea, setServiceArea] = useState<ServiceAreaData>({
    centerLat: null,
    centerLng: null,
    radiusMi: 10,
    maxMi: 20,
    allowExtended: true,
  });

  const { data: profile, isLoading } = useQuery<BusinessProfile>({
    queryKey: ["/api/business-profile"],
  });

  // Load service area when profile loads
  if (profile && serviceArea.centerLat === null && profile.serviceAreaCenterLat !== null) {
    setServiceArea({
      centerLat: profile.serviceAreaCenterLat ?? null,
      centerLng: profile.serviceAreaCenterLng ?? null,
      radiusMi: profile.serviceAreaRadiusMi ?? 10,
      maxMi: profile.serviceAreaMaxMi ?? 20,
      allowExtended: profile.serviceAreaAllowExtended ?? true,
    });
  }

  const form = useForm<BusinessProfileFormData>({
    resolver: zodResolver(businessProfileSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
      serviceArea: "",
      businessHours: "",
      autoResponseEnabled: true,
    },
    values: profile
      ? {
          name: profile.name,
          phone: profile.phone,
          email: profile.email,
          address: profile.address || "",
          serviceArea: profile.serviceArea || "",
          businessHours: profile.businessHours || "",
          autoResponseEnabled: profile.autoResponseEnabled ?? true,
        }
      : undefined,
  });

  // Load services when profile loads
  if (profile?.services && services.length === 0 && profile.services.length > 0) {
    setServices(profile.services);
  }

  const saveMutation = useMutation({
    mutationFn: async (data: BusinessProfileFormData) => {
      const payload = {
        ...data,
        services,
        serviceAreaCenterLat: serviceArea.centerLat,
        serviceAreaCenterLng: serviceArea.centerLng,
        serviceAreaRadiusMi: serviceArea.radiusMi,
        serviceAreaMaxMi: serviceArea.maxMi,
        serviceAreaAllowExtended: serviceArea.allowExtended,
      };
      if (profile?.id) {
        return apiRequest("PATCH", `/api/business-profile/${profile.id}`, payload);
      }
      return apiRequest("POST", "/api/business-profile", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-profile"] });
      toast({
        title: "Profile Saved",
        description: "Your business profile has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addService = () => {
    if (newService.trim() && !services.includes(newService.trim())) {
      setServices([...services, newService.trim()]);
      setNewService("");
    }
  };

  const removeService = (service: string) => {
    setServices(services.filter((s) => s !== service));
  };

  const onSubmit = (data: BusinessProfileFormData) => {
    saveMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-2xl">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card>
          <CardContent className="p-6 space-y-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i}>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Business Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure your landscaping business details for AI agents
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>
                This information is used by AI agents to represent your business
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Green Thumb Landscaping"
                        {...field}
                        data-testid="input-business-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Phone className="h-4 w-4 inline mr-1" />
                        Phone
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+1 (555) 123-4567"
                          {...field}
                          data-testid="input-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Mail className="h-4 w-4 inline mr-1" />
                        Email
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="hello@greenthumb.com"
                          {...field}
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <MapPin className="h-4 w-4 inline mr-1" />
                      Business Address
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123 Main St, Springfield, IL 62701"
                        {...field}
                        data-testid="input-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serviceArea"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Area</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Springfield and surrounding 25 miles"
                        {...field}
                        data-testid="input-service-area"
                      />
                    </FormControl>
                    <FormDescription>
                      Areas where you provide services
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="businessHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Clock className="h-4 w-4 inline mr-1" />
                      Business Hours
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Mon-Fri 8am-6pm, Sat 9am-4pm"
                        {...field}
                        data-testid="input-hours"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Services Offered
              </CardTitle>
              <CardDescription>
                List the services your business provides
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Add a service (e.g., Lawn Mowing)"
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addService();
                    }
                  }}
                  data-testid="input-new-service"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addService}
                  data-testid="button-add-service"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {services.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {services.map((service) => (
                    <Badge
                      key={service}
                      variant="secondary"
                      className="pl-3 pr-1 py-1.5"
                    >
                      {service}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 ml-1"
                        onClick={() => removeService(service)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No services added yet
                </p>
              )}
            </CardContent>
          </Card>

          <ServiceAreaMap
            value={serviceArea}
            onChange={setServiceArea}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AI Settings</CardTitle>
              <CardDescription>
                Configure how AI agents handle customer interactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="autoResponseEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Auto-Response Enabled
                      </FormLabel>
                      <FormDescription>
                        Automatically respond to missed calls and SMS
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-auto-response"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full"
            disabled={saveMutation.isPending}
            data-testid="button-save-profile"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save Profile"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
