import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserRole } from "@/components/role-gate";
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
  MapPin, 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2,
  Users,
  Search,
  RefreshCw,
  Circle,
  Square,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ServiceZone, Crew, CrewZoneAssignment } from "@shared/schema";

type ZoneWithCrews = ServiceZone & {
  crewCount?: number;
};

type ZoneCrewAssignment = CrewZoneAssignment & {
  crew: Crew;
};

export default function ZonesPage() {
  const { toast } = useToast();
  const userRole = useUserRole();
  const canEdit = userRole === "OWNER" || userRole === "ADMIN";
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCrewsDialog, setShowCrewsDialog] = useState(false);
  const [selectedZone, setSelectedZone] = useState<ServiceZone | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    centerLat: "",
    centerLng: "",
    radiusMiles: "",
    color: "#22c55e",
    priority: "0",
  });

  const { data: zones, isLoading, refetch } = useQuery<ZoneWithCrews[]>({
    queryKey: ["/api/ops/zones"],
  });

  const { data: zoneCrews } = useQuery<ZoneCrewAssignment[]>({
    queryKey: ["/api/ops/zones", selectedZone?.id, "crews"],
    enabled: !!selectedZone && showCrewsDialog,
  });

  const createZoneMutation = useMutation({
    mutationFn: async (data: Partial<ServiceZone>) => {
      return apiRequest("POST", "/api/ops/zones", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/zones"] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: "Zone created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create zone", description: error.message, variant: "destructive" });
    },
  });

  const updateZoneMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ServiceZone> }) => {
      return apiRequest("PATCH", `/api/ops/zones/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/zones"] });
      setShowEditDialog(false);
      setSelectedZone(null);
      resetForm();
      toast({ title: "Zone updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update zone", description: error.message, variant: "destructive" });
    },
  });

  const deleteZoneMutation = useMutation({
    mutationFn: async (zoneId: number) => {
      return apiRequest("DELETE", `/api/ops/zones/${zoneId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/zones"] });
      setShowDeleteDialog(false);
      setSelectedZone(null);
      toast({ title: "Zone deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete zone", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      centerLat: "",
      centerLng: "",
      radiusMiles: "",
      color: "#22c55e",
      priority: "0",
    });
  };

  const handleCreate = () => {
    createZoneMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      centerLat: formData.centerLat ? parseFloat(formData.centerLat) : undefined,
      centerLng: formData.centerLng ? parseFloat(formData.centerLng) : undefined,
      radiusMiles: formData.radiusMiles ? parseFloat(formData.radiusMiles) : undefined,
      color: formData.color,
      priority: parseInt(formData.priority) || 0,
    });
  };

  const handleUpdate = () => {
    if (!selectedZone) return;
    updateZoneMutation.mutate({
      id: selectedZone.id,
      data: {
        name: formData.name,
        description: formData.description || undefined,
        centerLat: formData.centerLat ? parseFloat(formData.centerLat) : undefined,
        centerLng: formData.centerLng ? parseFloat(formData.centerLng) : undefined,
        radiusMiles: formData.radiusMiles ? parseFloat(formData.radiusMiles) : undefined,
        color: formData.color,
        priority: parseInt(formData.priority) || 0,
      },
    });
  };

  const openEditDialog = (zone: ServiceZone) => {
    setSelectedZone(zone);
    setFormData({
      name: zone.name,
      description: zone.description || "",
      centerLat: zone.centerLat?.toString() || "",
      centerLng: zone.centerLng?.toString() || "",
      radiusMiles: zone.radiusMiles?.toString() || "",
      color: zone.color || "#22c55e",
      priority: zone.priority?.toString() || "0",
    });
    setShowEditDialog(true);
  };

  const filteredZones = zones?.filter(zone => 
    zone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    zone.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) ?? [];

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
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            Service Zones
          </h1>
          <p className="text-muted-foreground">
            Define geographic areas where your crews operate
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => refetch()}
            data-testid="button-refresh-zones"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canEdit && (
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-zone">
              <Plus className="h-4 w-4 mr-2" />
              Add Zone
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Zones</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-zones">
              {zones?.length ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Zones</CardTitle>
            <Circle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-zones">
              {zones?.filter(z => z.isActive).length ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Radius</CardTitle>
            <Square className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-zones-with-radius">
              {zones?.filter(z => z.radiusMiles).length ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>All Zones</CardTitle>
              <CardDescription>
                Geographic service areas for crew assignment
              </CardDescription>
            </div>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search zones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-zones"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredZones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No zones match your search" : "No zones created yet"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Radius</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Color</TableHead>
                  {canEdit && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredZones.map((zone) => (
                  <TableRow key={zone.id} data-testid={`row-zone-${zone.id}`}>
                    <TableCell className="font-medium">
                      {zone.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {zone.description || "-"}
                    </TableCell>
                    <TableCell>
                      {zone.centerLat && zone.centerLng ? (
                        <span className="text-sm">
                          {zone.centerLat.toFixed(4)}, {zone.centerLng.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {zone.radiusMiles ? (
                        <Badge variant="secondary">{zone.radiusMiles} mi</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{zone.priority ?? 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <div 
                        className="w-6 h-6 rounded-md border" 
                        style={{ backgroundColor: zone.color || "#22c55e" }}
                        title={zone.color || "#22c55e"}
                      />
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-zone-menu-${zone.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedZone(zone);
                                setShowCrewsDialog(true);
                              }}
                              data-testid={`menu-view-crews-${zone.id}`}
                            >
                              <Users className="h-4 w-4 mr-2" />
                              View Crews
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => openEditDialog(zone)}
                              data-testid={`menu-edit-zone-${zone.id}`}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => {
                                setSelectedZone(zone);
                                setShowDeleteDialog(true);
                              }}
                              data-testid={`menu-delete-zone-${zone.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
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
            <DialogTitle>Create Service Zone</DialogTitle>
            <DialogDescription>
              Define a new geographic area for crew assignment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Zone Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., North District"
                data-testid="input-zone-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                data-testid="input-zone-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="centerLat">Center Latitude</Label>
                <Input
                  id="centerLat"
                  type="number"
                  step="any"
                  value={formData.centerLat}
                  onChange={(e) => setFormData({ ...formData, centerLat: e.target.value })}
                  placeholder="38.0293"
                  data-testid="input-zone-lat"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="centerLng">Center Longitude</Label>
                <Input
                  id="centerLng"
                  type="number"
                  step="any"
                  value={formData.centerLng}
                  onChange={(e) => setFormData({ ...formData, centerLng: e.target.value })}
                  placeholder="-78.4767"
                  data-testid="input-zone-lng"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="radiusMiles">Radius (miles)</Label>
                <Input
                  id="radiusMiles"
                  type="number"
                  step="0.1"
                  value={formData.radiusMiles}
                  onChange={(e) => setFormData({ ...formData, radiusMiles: e.target.value })}
                  placeholder="10"
                  data-testid="input-zone-radius"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  placeholder="0"
                  data-testid="input-zone-priority"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Display Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-16 h-9 p-1"
                  data-testid="input-zone-color"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#22c55e"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={!formData.name || createZoneMutation.isPending}
              data-testid="button-confirm-create"
            >
              {createZoneMutation.isPending ? "Creating..." : "Create Zone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Service Zone</DialogTitle>
            <DialogDescription>
              Update zone details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Zone Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., North District"
                data-testid="input-edit-zone-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                data-testid="input-edit-zone-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-centerLat">Center Latitude</Label>
                <Input
                  id="edit-centerLat"
                  type="number"
                  step="any"
                  value={formData.centerLat}
                  onChange={(e) => setFormData({ ...formData, centerLat: e.target.value })}
                  placeholder="38.0293"
                  data-testid="input-edit-zone-lat"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-centerLng">Center Longitude</Label>
                <Input
                  id="edit-centerLng"
                  type="number"
                  step="any"
                  value={formData.centerLng}
                  onChange={(e) => setFormData({ ...formData, centerLng: e.target.value })}
                  placeholder="-78.4767"
                  data-testid="input-edit-zone-lng"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-radiusMiles">Radius (miles)</Label>
                <Input
                  id="edit-radiusMiles"
                  type="number"
                  step="0.1"
                  value={formData.radiusMiles}
                  onChange={(e) => setFormData({ ...formData, radiusMiles: e.target.value })}
                  placeholder="10"
                  data-testid="input-edit-zone-radius"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-priority">Priority</Label>
                <Input
                  id="edit-priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  placeholder="0"
                  data-testid="input-edit-zone-priority"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-color">Display Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="edit-color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-16 h-9 p-1"
                  data-testid="input-edit-zone-color"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#22c55e"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdate} 
              disabled={!formData.name || updateZoneMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {updateZoneMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Zone</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedZone?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => selectedZone && deleteZoneMutation.mutate(selectedZone.id)}
              disabled={deleteZoneMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteZoneMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCrewsDialog} onOpenChange={setShowCrewsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crews in {selectedZone?.name}</DialogTitle>
            <DialogDescription>
              Crews assigned to this service zone
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {zoneCrews && zoneCrews.length > 0 ? (
              <div className="space-y-2">
                {zoneCrews.map((assignment) => (
                  <div 
                    key={assignment.id}
                    className="flex items-center justify-between p-3 rounded-md border"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{assignment.crew.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {assignment.isPrimary && (
                        <Badge variant="secondary">Primary</Badge>
                      )}
                      <Badge variant="outline">P{assignment.priority ?? 0}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No crews assigned to this zone
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCrewsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
