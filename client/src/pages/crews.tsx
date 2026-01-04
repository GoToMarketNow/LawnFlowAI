import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Users, 
  Plus, 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2,
  MapPin,
  Clock,
  UserCheck,
  Search,
  RefreshCw,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { Crew, CrewMember } from "@shared/schema";

type CrewWithMembers = Crew & {
  members?: CrewMember[];
  memberCount?: number;
  leader?: CrewMember | null;
};

export default function CrewsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState<Crew | null>(null);
  const [newCrewName, setNewCrewName] = useState("");
  const [newCrewAddress, setNewCrewAddress] = useState("");

  const { data: crews, isLoading, refetch } = useQuery<CrewWithMembers[]>({
    queryKey: ["/api/ops/crews"],
  });

  const createCrewMutation = useMutation({
    mutationFn: async (data: { name: string; homeBaseAddress?: string }) => {
      return apiRequest("POST", "/api/ops/crews", {
        name: data.name,
        homeBaseAddress: data.homeBaseAddress,
        homeBaseLat: 38.0293,
        homeBaseLng: -78.4767,
        serviceRadiusMiles: 20,
        dailyCapacityMinutes: 420,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/crews"] });
      setShowCreateDialog(false);
      setNewCrewName("");
      setNewCrewAddress("");
      toast({ title: "Crew created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create crew", description: error.message, variant: "destructive" });
    },
  });

  const deleteCrewMutation = useMutation({
    mutationFn: async (crewId: number) => {
      return apiRequest("DELETE", `/api/ops/crews/${crewId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/crews"] });
      setShowDeleteDialog(false);
      setSelectedCrew(null);
      toast({ title: "Crew deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete crew", description: error.message, variant: "destructive" });
    },
  });

  const filteredCrews = crews?.filter(crew => 
    crew.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    crew.homeBaseAddress?.toLowerCase().includes(searchTerm.toLowerCase())
  ) ?? [];

  const activeCrews = filteredCrews.filter(c => c.status === "ACTIVE");
  const totalMembers = filteredCrews.reduce((sum, c) => sum + (c.memberCount ?? 0), 0);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Crews</h1>
          <p className="text-muted-foreground text-sm">Manage field teams, members, and assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => refetch()}
            data-testid="button-refresh-crews"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button 
            onClick={() => setShowCreateDialog(true)}
            data-testid="button-create-crew"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Crew
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Crews</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-crews">
              {filteredCrews.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {activeCrews.length} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Field Workers</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-members">
              {totalMembers}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all crews
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Crew Size</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-crew-size">
              {filteredCrews.length > 0 
                ? (totalMembers / filteredCrews.length).toFixed(1)
                : "0"
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Members per crew
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>All Crews</CardTitle>
              <CardDescription>View and manage your field teams</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search crews..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                data-testid="input-search-crews"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCrews.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-medium">No crews found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {searchTerm 
                  ? "Try adjusting your search term"
                  : "Get started by creating your first crew"
                }
              </p>
              {!searchTerm && (
                <Button 
                  className="mt-4" 
                  onClick={() => setShowCreateDialog(true)}
                  data-testid="button-create-first-crew"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Crew
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Leader</TableHead>
                  <TableHead className="text-center">Members</TableHead>
                  <TableHead>Home Base</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCrews.map((crew) => (
                  <TableRow 
                    key={crew.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => navigate(`/operations/crews/${crew.id}`)}
                    data-testid={`row-crew-${crew.id}`}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        {crew.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={crew.status === "ACTIVE" ? "default" : "secondary"}
                        data-testid={`badge-status-${crew.id}`}
                      >
                        {crew.status ?? "ACTIVE"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {crew.leader ? (
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{crew.leader.displayName}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" data-testid={`badge-member-count-${crew.id}`}>
                        {crew.memberCount ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {crew.homeBaseAddress ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">{crew.homeBaseAddress}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Not set</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" data-testid={`button-menu-${crew.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/operations/crews/${crew.id}`);
                            }}
                            data-testid={`menu-view-${crew.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/operations/crews/${crew.id}?edit=true`);
                            }}
                            data-testid={`menu-edit-${crew.id}`}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Crew
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCrew(crew);
                              setShowDeleteDialog(true);
                            }}
                            data-testid={`menu-delete-${crew.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Crew
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Crew</DialogTitle>
            <DialogDescription>
              Add a new field team to your operations
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="crew-name">Crew Name</Label>
              <Input
                id="crew-name"
                placeholder="e.g., Alpha Team"
                value={newCrewName}
                onChange={(e) => setNewCrewName(e.target.value)}
                data-testid="input-new-crew-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crew-address">Home Base Address (optional)</Label>
              <Input
                id="crew-address"
                placeholder="e.g., 123 Main St, Charlottesville, VA"
                value={newCrewAddress}
                onChange={(e) => setNewCrewAddress(e.target.value)}
                data-testid="input-new-crew-address"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCreateDialog(false)}
              data-testid="button-cancel-create"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => createCrewMutation.mutate({ 
                name: newCrewName, 
                homeBaseAddress: newCrewAddress || undefined 
              })}
              disabled={!newCrewName.trim() || createCrewMutation.isPending}
              data-testid="button-confirm-create"
            >
              {createCrewMutation.isPending ? "Creating..." : "Create Crew"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Crew</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedCrew?.name}"? This action will deactivate the crew and all its members.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => selectedCrew && deleteCrewMutation.mutate(selectedCrew.id)}
              disabled={deleteCrewMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteCrewMutation.isPending ? "Deleting..." : "Delete Crew"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
