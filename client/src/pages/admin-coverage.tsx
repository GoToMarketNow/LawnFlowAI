import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, Database, CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";

interface CountySource {
  id: number;
  stateFips: string;
  countyFips: string;
  countyName: string;
  status: "full" | "partial" | "none" | "unknown";
  sourceType: "arcgis_feature_service" | "arcgis_rest" | "manual_viewer" | "none";
  serviceUrl: string | null;
  layerId: number | null;
  supportsPointQuery: boolean;
  areaFieldCandidates: string[];
  areaUnits: "sqft" | "sqm" | "acres" | "unknown";
  parcelIdField: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  stateFips: string;
  countyFips: string;
  countyName: string;
  status: string;
  sourceType: string;
  serviceUrl: string;
  layerId: string;
  supportsPointQuery: boolean;
  areaFieldCandidates: string;
  areaUnits: string;
  parcelIdField: string;
}

const initialFormData: FormData = {
  stateFips: "",
  countyFips: "",
  countyName: "",
  status: "unknown",
  sourceType: "none",
  serviceUrl: "",
  layerId: "",
  supportsPointQuery: false,
  areaFieldCandidates: "",
  areaUnits: "unknown",
  parcelIdField: "",
};

export default function AdminCoverage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<CountySource | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [testAddress, setTestAddress] = useState("");

  const { data: sources, isLoading } = useQuery<CountySource[]>({
    queryKey: ["/api/admin/county-sources"],
  });

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/geo/lot-size/seed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/county-sources"] });
      toast({ title: "Seeded county sources and ZIP crosswalk" });
    },
    onError: () => {
      toast({ title: "Failed to seed data", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/county-sources", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/county-sources"] });
      setIsDialogOpen(false);
      setFormData(initialFormData);
      toast({ title: "County source created" });
    },
    onError: () => {
      toast({ title: "Failed to create county source", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ countyFips, data }: { countyFips: string; data: any }) =>
      apiRequest("PATCH", `/api/admin/county-sources/${countyFips}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/county-sources"] });
      setIsDialogOpen(false);
      setEditingSource(null);
      setFormData(initialFormData);
      toast({ title: "County source updated" });
    },
    onError: () => {
      toast({ title: "Failed to update county source", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (countyFips: string) => apiRequest("DELETE", `/api/admin/county-sources/${countyFips}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/county-sources"] });
      toast({ title: "County source deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete county source", variant: "destructive" });
    },
  });

  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = async () => {
    if (!testAddress.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await apiRequest("POST", "/api/geo/lot-size", { address: testAddress });
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      toast({ title: "Test failed", variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleEdit = (source: CountySource) => {
    setEditingSource(source);
    setFormData({
      stateFips: source.stateFips,
      countyFips: source.countyFips,
      countyName: source.countyName,
      status: source.status,
      sourceType: source.sourceType,
      serviceUrl: source.serviceUrl || "",
      layerId: source.layerId?.toString() || "",
      supportsPointQuery: source.supportsPointQuery,
      areaFieldCandidates: (source.areaFieldCandidates || []).join(", "),
      areaUnits: source.areaUnits,
      parcelIdField: source.parcelIdField || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const data = {
      stateFips: formData.stateFips,
      countyFips: formData.countyFips,
      countyName: formData.countyName,
      status: formData.status,
      sourceType: formData.sourceType,
      serviceUrl: formData.serviceUrl || null,
      layerId: formData.layerId ? parseInt(formData.layerId) : null,
      supportsPointQuery: formData.supportsPointQuery,
      areaFieldCandidates: formData.areaFieldCandidates
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      areaUnits: formData.areaUnits,
      parcelIdField: formData.parcelIdField || null,
    };

    if (editingSource) {
      updateMutation.mutate({ countyFips: editingSource.countyFips, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "full":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Full</Badge>;
      case "partial":
        return <Badge variant="secondary" className="bg-yellow-500 text-black"><AlertCircle className="w-3 h-3 mr-1" />Partial</Badge>;
      case "none":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />None</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="admin-coverage-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Parcel Coverage Admin</h1>
          <p className="text-muted-foreground">Manage county ArcGIS endpoints for lot size lookups</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} data-testid="button-seed-data">
            {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
            Seed Default Data
          </Button>
          <Button onClick={() => { setEditingSource(null); setFormData(initialFormData); setIsDialogOpen(true); }} data-testid="button-add-source">
            <Plus className="w-4 h-4 mr-2" />
            Add County Source
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Lot Size Lookup</CardTitle>
          <CardDescription>Test the lot size resolver with an address</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="123 Main St, Bethesda, MD 20814"
              value={testAddress}
              onChange={(e) => setTestAddress(e.target.value)}
              className="flex-1"
              data-testid="input-test-address"
            />
            <Button onClick={handleTest} disabled={isTesting} data-testid="button-test-lookup">
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Test
            </Button>
          </div>
          {testResult && (
            <div className="mt-4 p-4 bg-muted rounded-md">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="font-medium">County:</span> {testResult.countyName} ({testResult.countyFips})</div>
                <div><span className="font-medium">Coverage:</span> {testResult.parcelCoverage}</div>
                <div><span className="font-medium">Lot Size:</span> {testResult.lotAreaSqft?.toLocaleString()} sqft</div>
                <div><span className="font-medium">Acres:</span> {testResult.lotAreaAcres?.toFixed(2)}</div>
                <div><span className="font-medium">Confidence:</span> {testResult.confidence}</div>
                <div><span className="font-medium">Source:</span> {testResult.source}</div>
              </div>
              {testResult.fallback?.requiresCustomerValidation && (
                <div className="mt-2 text-amber-600">
                  Customer validation required. Questions: {testResult.fallback.questions.join(" | ")}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>County Sources ({sources?.length || 0})</CardTitle>
          <CardDescription>ArcGIS endpoints for parcel lookups by county</CardDescription>
        </CardHeader>
        <CardContent>
          {!sources?.length ? (
            <p className="text-muted-foreground text-center py-8">No county sources configured. Click "Seed Default Data" to add some.</p>
          ) : (
            <div className="space-y-4">
              {sources.map((source) => (
                <div
                  key={source.countyFips}
                  className="flex items-center justify-between gap-4 p-4 border rounded-md flex-wrap"
                  data-testid={`card-county-${source.countyFips}`}
                >
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{source.countyName}</span>
                      {getStatusBadge(source.status)}
                      {source.supportsPointQuery && <Badge variant="outline">Point Query</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      FIPS: {source.stateFips}-{source.countyFips} | Type: {source.sourceType}
                      {source.serviceUrl && <span className="block truncate max-w-md">URL: {source.serviceUrl}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(source)} data-testid={`button-edit-${source.countyFips}`}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(source.countyFips)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${source.countyFips}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSource ? "Edit County Source" : "Add County Source"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>State FIPS</Label>
                <Input
                  value={formData.stateFips}
                  onChange={(e) => setFormData({ ...formData, stateFips: e.target.value })}
                  placeholder="24"
                  data-testid="input-state-fips"
                />
              </div>
              <div>
                <Label>County FIPS</Label>
                <Input
                  value={formData.countyFips}
                  onChange={(e) => setFormData({ ...formData, countyFips: e.target.value })}
                  placeholder="24031"
                  disabled={!!editingSource}
                  data-testid="input-county-fips"
                />
              </div>
            </div>
            <div>
              <Label>County Name</Label>
              <Input
                value={formData.countyName}
                onChange={(e) => setFormData({ ...formData, countyName: e.target.value })}
                placeholder="Montgomery County, MD"
                data-testid="input-county-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Source Type</Label>
                <Select value={formData.sourceType} onValueChange={(v) => setFormData({ ...formData, sourceType: v })}>
                  <SelectTrigger data-testid="select-source-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="arcgis_feature_service">ArcGIS Feature Service</SelectItem>
                    <SelectItem value="arcgis_rest">ArcGIS REST</SelectItem>
                    <SelectItem value="manual_viewer">Manual Viewer</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Service URL</Label>
              <Input
                value={formData.serviceUrl}
                onChange={(e) => setFormData({ ...formData, serviceUrl: e.target.value })}
                placeholder="https://gis.data.example.gov/arcgis/rest/services/Parcels/FeatureServer"
                data-testid="input-service-url"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Layer ID</Label>
                <Input
                  value={formData.layerId}
                  onChange={(e) => setFormData({ ...formData, layerId: e.target.value })}
                  placeholder="0"
                  type="number"
                  data-testid="input-layer-id"
                />
              </div>
              <div>
                <Label>Area Units</Label>
                <Select value={formData.areaUnits} onValueChange={(v) => setFormData({ ...formData, areaUnits: v })}>
                  <SelectTrigger data-testid="select-area-units"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sqft">Square Feet</SelectItem>
                    <SelectItem value="sqm">Square Meters</SelectItem>
                    <SelectItem value="acres">Acres</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Area Field Candidates (comma-separated)</Label>
              <Input
                value={formData.areaFieldCandidates}
                onChange={(e) => setFormData({ ...formData, areaFieldCandidates: e.target.value })}
                placeholder="Shape_Area, ACRES, LOT_AREA"
                data-testid="input-area-fields"
              />
            </div>
            <div>
              <Label>Parcel ID Field</Label>
              <Input
                value={formData.parcelIdField}
                onChange={(e) => setFormData({ ...formData, parcelIdField: e.target.value })}
                placeholder="PARCEL_ID"
                data-testid="input-parcel-id-field"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.supportsPointQuery}
                onCheckedChange={(v) => setFormData({ ...formData, supportsPointQuery: v })}
                data-testid="switch-point-query"
              />
              <Label>Supports Point Query</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingSource ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
