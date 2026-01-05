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
} from "lucide-react";
import type { Service, PromotionRule } from "@shared/schema";

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

function ServiceCard({ service }: { service: Service }) {
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
            <Button size="icon" variant="ghost" data-testid={`button-edit-service-${service.id}`}>
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PromotionCard({ promotion }: { promotion: PromotionRule }) {
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
          <Badge variant={promotion.isActive ? "default" : "secondary"}>
            {promotion.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardContent>
    </Card>
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
  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const { data: promotions, isLoading: promotionsLoading } = useQuery<PromotionRule[]>({
    queryKey: ["/api/promotions"],
  });

  const activeServices = services?.filter(s => s.isActive) || [];
  const inactiveServices = services?.filter(s => !s.isActive) || [];

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
        <Button data-testid="button-add-service">
          <Plus className="h-4 w-4 mr-2" />
          Add Service
        </Button>
      </div>

      {servicesLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-4 mb-8">
          {activeServices.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
          
          {inactiveServices.length > 0 && (
            <>
              <Separator className="my-6" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <span>Inactive Services ({inactiveServices.length})</span>
              </div>
              {inactiveServices.map((service) => (
                <ServiceCard key={service.id} service={service} />
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
                <Button data-testid="button-add-first-service">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Separator className="my-8" />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-medium">Promotions</h2>
          <p className="text-sm text-muted-foreground">
            Discounts and pricing rules applied automatically
          </p>
        </div>
        <Button variant="outline" data-testid="button-add-promotion">
          <Plus className="h-4 w-4 mr-2" />
          Add Promotion
        </Button>
      </div>

      {promotionsLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-3">
          {promotions?.map((promotion) => (
            <PromotionCard key={promotion.id} promotion={promotion} />
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
