/// <reference types="@types/google.maps" />
import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const VALID_MAX_DISTANCES = [5, 10, 20, 40] as const;
const MILES_TO_METERS = 1609.344;

export interface ServiceAreaData {
  centerLat: number | null;
  centerLng: number | null;
  radiusMi: number | null;
  maxMi: number | null;
  allowExtended: boolean;
}

interface ServiceAreaMapProps {
  value: ServiceAreaData;
  onChange: (data: ServiceAreaData) => void;
  defaultCenter?: { lat: number; lng: number };
}

export function ServiceAreaMap({
  value,
  onChange,
  defaultCenter = { lat: 33.749, lng: -84.388 },
}: ServiceAreaMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [radiusError, setRadiusError] = useState<string | null>(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const currentCenter = {
    lat: value.centerLat ?? defaultCenter.lat,
    lng: value.centerLng ?? defaultCenter.lng,
  };
  const currentRadius = value.radiusMi ?? 10;
  const currentMax = value.maxMi ?? 20;
  const currentAllowExtended = value.allowExtended ?? true;

  const updateCircle = useCallback(() => {
    if (circleRef.current && googleMapRef.current) {
      const radiusMeters = currentRadius * MILES_TO_METERS;
      circleRef.current.setRadius(radiusMeters);
      circleRef.current.setCenter(currentCenter);
    }
  }, [currentCenter.lat, currentCenter.lng, currentRadius]);

  useEffect(() => {
    if (!apiKey) {
      setLoadError("Google Maps API key is not configured. Add VITE_GOOGLE_MAPS_API_KEY to your environment.");
      return;
    }

    if (window.google?.maps) {
      initializeMap();
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', initializeMap);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = initializeMap;
    script.onerror = () => {
      setLoadError("Failed to load Google Maps. Please check your API key configuration.");
    };
    document.head.appendChild(script);

    function initializeMap() {
      if (!mapRef.current || !window.google?.maps) return;

      const map = new window.google.maps.Map(mapRef.current, {
        center: currentCenter,
        zoom: 10,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      googleMapRef.current = map;

      const marker = new window.google.maps.Marker({
        map,
        position: currentCenter,
        draggable: true,
        title: "Drag to set service area center",
      });

      markerRef.current = marker;

      marker.addListener("dragend", () => {
        const position = marker.getPosition();
        if (position) {
          onChange({
            ...value,
            centerLat: position.lat(),
            centerLng: position.lng(),
          });
        }
      });

      const circle = new window.google.maps.Circle({
        map,
        center: currentCenter,
        radius: currentRadius * MILES_TO_METERS,
        fillColor: "#3B82F6",
        fillOpacity: 0.15,
        strokeColor: "#2563EB",
        strokeOpacity: 0.8,
        strokeWeight: 2,
      });

      circleRef.current = circle;
      setMapLoaded(true);
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
      if (circleRef.current) {
        circleRef.current.setMap(null);
      }
    };
  }, [apiKey]);

  useEffect(() => {
    if (mapLoaded) {
      updateCircle();
      if (markerRef.current) {
        markerRef.current.setPosition(currentCenter);
      }
    }
  }, [mapLoaded, updateCircle, currentCenter.lat, currentCenter.lng]);

  const handleRadiusChange = (values: number[]) => {
    let newRadius = values[0];
    if (newRadius > currentMax) {
      newRadius = currentMax;
      setRadiusError(`Radius clamped to max travel limit of ${currentMax} miles`);
    } else {
      setRadiusError(null);
    }
    onChange({
      ...value,
      radiusMi: newRadius,
      centerLat: currentCenter.lat,
      centerLng: currentCenter.lng,
    });
  };

  const handleMaxChange = (newMax: string) => {
    const maxMi = parseInt(newMax, 10) as typeof VALID_MAX_DISTANCES[number];
    let radiusMi = currentRadius;
    if (radiusMi > maxMi) {
      radiusMi = maxMi;
      setRadiusError(`Radius clamped to new max travel limit of ${maxMi} miles`);
    } else {
      setRadiusError(null);
    }
    onChange({
      ...value,
      maxMi,
      radiusMi,
      centerLat: currentCenter.lat,
      centerLng: currentCenter.lng,
    });
  };

  const handleAllowExtendedChange = (checked: boolean) => {
    onChange({
      ...value,
      allowExtended: checked,
      centerLat: currentCenter.lat,
      centerLng: currentCenter.lng,
    });
  };

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Service Area
          </CardTitle>
          <CardDescription>
            Define your core service area and maximum travel distance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Service Area
        </CardTitle>
        <CardDescription>
          Drag the marker to set your business location. Use the slider to define your core service area.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          ref={mapRef}
          className="w-full h-64 rounded-md border bg-muted"
          data-testid="map-service-area"
        />

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="radius-slider">Core Service Radius</Label>
              <span className="text-sm font-medium" data-testid="text-radius-value">
                {currentRadius} miles
              </span>
            </div>
            <Slider
              id="radius-slider"
              min={1}
              max={currentMax}
              step={1}
              value={[currentRadius]}
              onValueChange={handleRadiusChange}
              data-testid="slider-radius"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-distance">Max Travel Limit</Label>
            <Select
              value={currentMax.toString()}
              onValueChange={handleMaxChange}
            >
              <SelectTrigger id="max-distance" data-testid="select-max-distance">
                <SelectValue placeholder="Select max distance" />
              </SelectTrigger>
              <SelectContent>
                {VALID_MAX_DISTANCES.map((distance) => (
                  <SelectItem key={distance} value={distance.toString()}>
                    {distance} miles
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="allow-extended" className="text-base">
                Allow Extended Area
              </Label>
              <p className="text-sm text-muted-foreground">
                Accept requests beyond core radius up to max travel limit
              </p>
            </div>
            <Switch
              id="allow-extended"
              checked={currentAllowExtended}
              onCheckedChange={handleAllowExtendedChange}
              data-testid="switch-allow-extended"
            />
          </div>

          {radiusError && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{radiusError}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg bg-muted p-4 space-y-1">
            <p className="text-sm">
              <span className="font-medium">Core coverage:</span> {currentRadius} miles
            </p>
            <p className="text-sm">
              <span className="font-medium">Max travel limit:</span> {currentMax} miles
            </p>
            {currentAllowExtended && currentRadius < currentMax && (
              <p className="text-sm text-muted-foreground">
                Extended area: {currentRadius} - {currentMax} miles (requires approval)
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
