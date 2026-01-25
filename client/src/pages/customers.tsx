import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search,
  Users,
  Phone,
  MapPin,
  Calendar,
  ChevronRight,
  Brain,
} from "lucide-react";
import { format } from "date-fns";

interface CustomerProfile {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  lastInteractionAt?: string;
  totalJobs?: number;
  lifetimeValue?: number;
}

function CustomerCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-8" />
        </div>
      </CardContent>
    </Card>
  );
}

function CustomerCard({ customer }: { customer: CustomerProfile }) {
  const initials = customer.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Link href={`/customers/${customer.id}`}>
      <Card className="hover-elevate cursor-pointer" data-testid={`customer-card-${customer.id}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Avatar>
              <AvatarFallback className="bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm truncate">{customer.name}</span>
                {customer.totalJobs && customer.totalJobs > 5 && (
                  <Badge variant="secondary" className="text-xs">
                    VIP
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {customer.phone}
                </div>
                {customer.address && (
                  <div className="flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{customer.address}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="text-right">
              {customer.lastInteractionAt && (
                <div className="text-xs text-muted-foreground mb-1">
                  {format(new Date(customer.lastInteractionAt), "MMM d")}
                </div>
              )}
              {customer.lifetimeValue && (
                <div className="text-sm font-medium text-green-600 dark:text-green-400">
                  ${(customer.lifetimeValue / 100).toFixed(0)}
                </div>
              )}
            </div>
            
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");

  const { data: memoryData, isLoading: memoryLoading } = useQuery<{
    customers: any[];
    total: number;
  }>({
    queryKey: ["/api/memory/customers", { search, limit: 50 }],
  });

  const { data: conversationsData, isLoading: conversationsLoading } = useQuery<{
    conversations: any[];
  }>({
    queryKey: ["/api/conversations"],
  });

  const isLoading = memoryLoading || conversationsLoading;

  const customers: CustomerProfile[] = (memoryData?.customers || []).map((c: any) => ({
    id: c.id,
    name: c.name || c.phone || "Unknown",
    phone: c.phone || "",
    email: c.email,
    address: c.address,
    lastInteractionAt: c.lastInteractionAt,
    totalJobs: c.totalJobs || 0,
    lifetimeValue: c.lifetimeValue || 0,
  }));

  const conversationCustomers: CustomerProfile[] = (conversationsData?.conversations || [])
    .filter((c: any) => !customers.find((m) => m.phone === c.customerPhone))
    .map((c: any) => ({
      id: c.id,
      name: c.customerName || c.customerPhone || "Unknown",
      phone: c.customerPhone || "",
      address: c.propertyAddress,
      lastInteractionAt: c.updatedAt || c.createdAt,
    }));

  const allCustomers = [...customers, ...conversationCustomers];

  const filteredCustomers = allCustomers.filter((c) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(searchLower) ||
      c.phone.includes(search) ||
      c.address?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {allCustomers.length} {allCustomers.length === 1 ? "customer" : "customers"}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64"
              data-testid="input-search-customers"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <CustomerCardSkeleton />
          <CustomerCardSkeleton />
          <CustomerCardSkeleton />
          <CustomerCardSkeleton />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">
              {search ? "No customers found" : "No customers yet"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {search
                ? "Try adjusting your search terms."
                : "Customers will appear here once they interact with your business."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCustomers.map((customer) => (
            <CustomerCard key={`${customer.id}-${customer.phone}`} customer={customer} />
          ))}
        </div>
      )}
    </div>
  );
}
