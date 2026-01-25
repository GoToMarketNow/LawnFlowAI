import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Check, X, Eye, Trash2 } from "lucide-react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

interface ZipArea {
  zip: string;
  center: { lat: number; lng: number };
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

interface ZipCoverageResponse {
  zipAreas: ZipArea[];
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
  cachedCount: number;
  geocodedCount: number;
}

interface ParseResult {
  validZipCodes: string[];
  invalidEntries: string[];
  duplicatesRemoved: number;
}

interface ZipServiceAreaProps {
  initialZipCodes?: string[];
  onChange?: (zipCodes: string[]) => void;
  onSave?: (zipCodes: string[]) => void;
  isSaving?: boolean;
}

function parseZipCodes(input: string): ParseResult {
  const entries = input
    .split(/[\s,\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const validZipCodes: string[] = [];
  const invalidEntries: string[] = [];
  const seen = new Set<string>();
  let duplicatesRemoved = 0;

  for (const entry of entries) {
    if (/^\d{5}$/.test(entry)) {
      if (seen.has(entry)) {
        duplicatesRemoved++;
      } else {
        seen.add(entry);
        validZipCodes.push(entry);
      }
    } else {
      invalidEntries.push(entry);
    }
  }

  return { validZipCodes, invalidEntries, duplicatesRemoved };
}

export function ZipServiceArea({ initialZipCodes = [], onChange, onSave, isSaving }: ZipServiceAreaProps) {
  const { toast } = useToast();
  const [inputText, setInputText] = useState(initialZipCodes.join(", "));
  const [parseResult, setParseResult] = useState<ParseResult>(() => parseZipCodes(initialZipCodes.join(", ")));
  const [coverage, setCoverage] = useState<ZipCoverageResponse | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const rectanglesRef = useRef<google.maps.Rectangle[]>([]);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const initialZipCodesKey = initialZipCodes.join(",");
  
  // Sync input state when initialZipCodes changes (e.g., when loading saved profile)
  useEffect(() => {
    const newText = initialZipCodes.join(", ");
    setInputText(newText);
    setParseResult(parseZipCodes(newText));
  }, [initialZipCodesKey]);
  
  // Call onChange whenever valid ZIP codes change
  useEffect(() => {
    if (onChange) {
      onChange(parseResult.validZipCodes);
    }
  }, [parseResult.validZipCodes, onChange]);

  const coverageMutation = useMutation({
    mutationFn: async (zipCodes: string[]) => {
      const res = await apiRequest("POST", "/api/geo/zip-coverage", { zipCodes });
      return res.json() as Promise<ZipCoverageResponse>;
    },
    onSuccess: (data) => {
      setCoverage(data);
      renderCoverageOnMap(data);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to fetch ZIP coverage. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = useCallback((value: string) => {
    setInputText(value);
    setParseResult(parseZipCodes(value));
  }, []);

  const handlePreview = useCallback(() => {
    if (parseResult.validZipCodes.length === 0) {
      toast({
        title: "No valid ZIP codes",
        description: "Please enter at least one valid 5-digit ZIP code.",
        variant: "destructive",
      });
      return;
    }
    coverageMutation.mutate(parseResult.validZipCodes);
  }, [parseResult.validZipCodes, coverageMutation, toast]);

  const handleClear = useCallback(() => {
    setInputText("");
    setParseResult({ validZipCodes: [], invalidEntries: [], duplicatesRemoved: 0 });
    setCoverage(null);
    clearMapOverlays();
  }, []);

  const handleSave = useCallback(() => {
    if (!onSave) return;
    if (parseResult.validZipCodes.length === 0) {
      toast({
        title: "No valid ZIP codes",
        description: "Please enter at least one valid 5-digit ZIP code.",
        variant: "destructive",
      });
      return;
    }
    onSave(parseResult.validZipCodes);
  }, [parseResult.validZipCodes, onSave, toast]);

  const clearMapOverlays = useCallback(() => {
    rectanglesRef.current.forEach((r) => r.setMap(null));
    rectanglesRef.current = [];
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
  }, []);

  const renderCoverageOnMap = useCallback((data: ZipCoverageResponse) => {
    if (!googleMapRef.current) return;

    clearMapOverlays();

    const map = googleMapRef.current;

    data.zipAreas.forEach((area) => {
      const rectangle = new google.maps.Rectangle({
        strokeColor: "#2563eb",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 0.25,
        map,
        bounds: {
          north: area.bounds.north,
          south: area.bounds.south,
          east: area.bounds.east,
          west: area.bounds.west,
        },
      });
      rectanglesRef.current.push(rectangle);

      const marker = new google.maps.Marker({
        position: area.center,
        map,
        label: {
          text: area.zip,
          color: "#1e40af",
          fontSize: "11px",
          fontWeight: "bold",
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 0,
        },
      });
      markersRef.current.push(marker);
    });

    if (data.bounds) {
      map.fitBounds({
        north: data.bounds.north,
        south: data.bounds.south,
        east: data.bounds.east,
        west: data.bounds.west,
      });
    }
  }, [clearMapOverlays]);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      setMapError("Google Maps API key not configured. Map preview unavailable.");
      return;
    }

    setOptions({
      key: apiKey,
      v: "weekly",
    } as { key: string; v: string });

    importLibrary("maps")
      .then(() => {
        if (mapRef.current && !googleMapRef.current) {
          googleMapRef.current = new google.maps.Map(mapRef.current, {
            center: { lat: 38.0293, lng: -78.4767 },
            zoom: 10,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });
          setMapLoaded(true);
        }
      })
      .catch((error: Error) => {
        console.error("Failed to load Google Maps:", error);
        setMapError("Failed to load Google Maps. Please check your API key.");
      });
  }, []);

  useEffect(() => {
    if (mapLoaded && coverage) {
      renderCoverageOnMap(coverage);
    }
  }, [mapLoaded, coverage, renderCoverageOnMap]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Service Area by ZIP Codes
        </CardTitle>
        <CardDescription>
          Enter the ZIP codes you serve. We'll highlight them on the map so you can confirm coverage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="zip-input">ZIP codes you service</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Paste ZIP codes separated by commas, spaces, or new lines. Example: 22901, 22902, 22903
          </p>
          <Textarea
            id="zip-input"
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="22901, 22902, 22903..."
            rows={4}
            data-testid="input-zip-codes"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handlePreview}
            disabled={parseResult.validZipCodes.length === 0 || coverageMutation.isPending}
            data-testid="button-preview-coverage"
          >
            {coverageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            Preview Coverage
          </Button>
          <Button variant="outline" onClick={handleClear} data-testid="button-clear-zips">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Check className="h-4 w-4 text-green-600" />
            <span>Valid: {parseResult.validZipCodes.length}</span>
          </div>
          {parseResult.invalidEntries.length > 0 && (
            <div className="flex items-center gap-1">
              <X className="h-4 w-4 text-destructive" />
              <span className="text-destructive">
                Invalid: {parseResult.invalidEntries.join(", ")}
              </span>
            </div>
          )}
          {parseResult.duplicatesRemoved > 0 && (
            <div className="text-muted-foreground">
              {parseResult.duplicatesRemoved} duplicate(s) removed
            </div>
          )}
        </div>

        {parseResult.validZipCodes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {parseResult.validZipCodes.slice(0, 20).map((zip) => (
              <Badge key={zip} variant="secondary">
                {zip}
              </Badge>
            ))}
            {parseResult.validZipCodes.length > 20 && (
              <Badge variant="outline">+{parseResult.validZipCodes.length - 20} more</Badge>
            )}
          </div>
        )}

        <div className="aspect-video bg-muted rounded-lg overflow-hidden">
          {mapError ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-4 text-center">
              {mapError}
            </div>
          ) : (
            <div ref={mapRef} className="w-full h-full" />
          )}
        </div>

        {coverage && (
          <div className="text-sm text-muted-foreground">
            Showing {coverage.zipAreas.length} ZIP code area(s).
            {coverage.cachedCount > 0 && ` (${coverage.cachedCount} from cache)`}
          </div>
        )}

        {onSave && (
          <div className="flex items-center gap-2 pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={parseResult.validZipCodes.length === 0 || isSaving}
              data-testid="button-save-zip-area"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save ZIP Codes
            </Button>
            <span className="text-xs text-muted-foreground">
              You can change these settings anytime
            </span>
          </div>
        )}
        
        {onChange && !onSave && parseResult.validZipCodes.length > 0 && (
          <div className="pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              {parseResult.validZipCodes.length} ZIP code(s) will be saved with your profile.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
