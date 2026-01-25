import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Zap,
  Search,
  MoreHorizontal,
  Phone,
  MessageSquare,
  Globe,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  ArrowRight,
  Loader2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLeads, useConvertLeadToQuote, useMarkLeadLost } from "@/lib/api/hooks";
import { format } from "date-fns";
import { TableLoadingSkeleton } from "@/components/ui/loading-skeleton";

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  new: { label: "New", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500/10" },
  contacted: { label: "Contacted", color: "text-yellow-600 dark:text-yellow-400", bgColor: "bg-yellow-500/10" },
  qualified: { label: "Qualified", color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-500/10" },
  converted: { label: "Converted", color: "text-green-600 dark:text-green-400", bgColor: "bg-green-500/10" },
  lost: { label: "Lost", color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-500/10" },
};

const sourceConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  missed_call: { label: "Missed Call", icon: <Phone className="h-3 w-3" /> },
  sms: { label: "SMS", icon: <MessageSquare className="h-3 w-3" /> },
  web: { label: "Web", icon: <Globe className="h-3 w-3" /> },
  referral: { label: "Referral", icon: <Users className="h-3 w-3" /> },
};

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isMarkLostDialogOpen, setIsMarkLostDialogOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const { toast } = useToast();

  const { data, isLoading } = useLeads();
  const convertMutation = useConvertLeadToQuote();
  const markLostMutation = useMarkLeadLost();

  if (isLoading) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <TableLoadingSkeleton columns={6} rows={8} />
      </div>
    );
  }

  const leads = data?.leads || [];
  const filteredLeads = leads.filter((lead) =>
    lead.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    lead.phone.includes(search)
  );

  const handleConvert = (leadId: number) => {
    convertMutation.mutate(leadId, {
      onSuccess: () => {
        toast({
          title: "Lead Converted",
          description: "The lead has been successfully converted to a quote.",
        });
      },
      onError: (error) => {
        toast({
          title: "Conversion Failed",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  const handleMarkLost = () => {
    if (!selectedLead) return;
    markLostMutation.mutate(
      { leadId: selectedLead.id, reason: lostReason },
      {
        onSuccess: () => {
          setIsMarkLostDialogOpen(false);
          setSelectedLead(null);
          setLostReason("");
          toast({
            title: "Lead Marked Lost",
            description: "The lead has been moved to lost status.",
          });
        },
      }
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-500" />
            Leads Management
          </h1>
          <p className="text-muted-foreground">Track and convert inbound business opportunities</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button size="sm">
            Add Manual Lead
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Leads Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Service Requested</TableHead>
              <TableHead>Date Received</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading leads...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No leads found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div className="font-medium">{lead.customerName || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{lead.phone}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      {sourceConfig[lead.source]?.icon}
                      {sourceConfig[lead.source]?.label || lead.source}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`${statusConfig[lead.status]?.bgColor} ${statusConfig[lead.status]?.color} border-none font-medium`}
                    >
                      {statusConfig[lead.status]?.label || lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate text-sm" title={lead.serviceRequested}>
                      {lead.serviceRequested}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(lead.createdAt), "MMM d, yyyy")}
                    <div className="text-[10px] text-muted-foreground">
                      {format(new Date(lead.createdAt), "h:mm a")}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleConvert(lead.id)}
                          disabled={lead.status === 'converted' || lead.status === 'lost'}
                        >
                          <Zap className="h-4 w-4 mr-2" />
                          Convert to Quote
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Send SMS
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => {
                            setSelectedLead(lead);
                            setIsMarkLostDialogOpen(true);
                          }}
                          disabled={lead.status === 'converted' || lead.status === 'lost'}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Mark as Lost
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mark Lost Dialog */}
      <Dialog open={isMarkLostDialogOpen} onOpenChange={setIsMarkLostDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Lead as Lost</DialogTitle>
            <DialogDescription>
              Why was this lead lost? This helps us improve our lead qualification.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Reason for losing lead</label>
            <textarea
              className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="e.g. Out of service area, customer decided to wait, etc."
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsMarkLostDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleMarkLost}
              disabled={!lostReason || markLostMutation.isPending}
            >
              {markLostMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Mark as Lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
