import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MapPin, Home, Navigation, Eye, EyeOff } from "lucide-react";
import type { Crew, JobRequest } from "@shared/schema";

interface OpsMapProps {
  crews: Crew[];
  selectedJob: JobRequest | null;
  onCrewClick?: (crewId: number) => void;
}

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

function PlaceholderMap({ crews, selectedJob, showCrews }: { 
  crews: Crew[]; 
  selectedJob: JobRequest | null;
  showCrews: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.fillStyle = "hsl(var(--muted))";
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    ctx.strokeStyle = "hsl(var(--border))";
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < rect.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.stroke();
    }
    for (let y = 0; y < rect.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const scale = 15;
    
    if (showCrews && crews.length > 0) {
      crews.forEach((crew, i) => {
        const angle = (i / crews.length) * Math.PI * 2;
        const radius = 80;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        ctx.fillStyle = "hsl(var(--primary))";
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = "hsl(var(--primary-foreground))";
        ctx.font = "10px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((i + 1).toString(), x, y);
        
        if (selectedJob) {
          ctx.strokeStyle = "hsl(var(--primary) / 0.3)";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(centerX, centerY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    }
    
    if (selectedJob) {
      ctx.fillStyle = "hsl(var(--destructive))";
      ctx.beginPath();
      ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = "hsl(var(--destructive-foreground))";
      ctx.font = "bold 14px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("J", centerX, centerY);
    }
    
  }, [crews, selectedJob, showCrews]);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full rounded-md"
      style={{ minHeight: 300 }}
    />
  );
}

function GoogleMap({ crews, selectedJob, showCrews }: { 
  crews: Crew[]; 
  selectedJob: JobRequest | null;
  showCrews: boolean;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const linesRef = useRef<google.maps.Polyline[]>([]);
  
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    
    const defaultCenter = selectedJob && selectedJob.lat != null && selectedJob.lng != null
      ? { lat: selectedJob.lat, lng: selectedJob.lng }
      : { lat: 33.749, lng: -84.388 };
    
    if (!mapInstance.current) {
      mapInstance.current = new google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });
    }
    
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    linesRef.current.forEach(l => l.setMap(null));
    linesRef.current = [];
    
    if (selectedJob && selectedJob.lat != null && selectedJob.lng != null) {
      const jobMarker = new google.maps.Marker({
        position: { lat: selectedJob.lat, lng: selectedJob.lng },
        map: mapInstance.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: "#ef4444",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        title: selectedJob.customerName || "Job Location",
      });
      markersRef.current.push(jobMarker);
      
      mapInstance.current.panTo({ lat: selectedJob.lat, lng: selectedJob.lng });
    }
    
    if (showCrews) {
      crews.forEach((crew, i) => {
        if (crew.homeBaseLat == null || crew.homeBaseLng == null) return;
        
        const crewMarker = new google.maps.Marker({
          position: { lat: crew.homeBaseLat, lng: crew.homeBaseLng },
          map: mapInstance.current!,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#3b82f6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
          label: {
            text: (i + 1).toString(),
            color: "#ffffff",
            fontSize: "10px",
            fontWeight: "bold",
          },
          title: crew.name,
        });
        markersRef.current.push(crewMarker);
        
        if (selectedJob && selectedJob.lat != null && selectedJob.lng != null) {
          const line = new google.maps.Polyline({
            path: [
              { lat: crew.homeBaseLat, lng: crew.homeBaseLng },
              { lat: selectedJob.lat, lng: selectedJob.lng },
            ],
            geodesic: true,
            strokeColor: "#3b82f6",
            strokeOpacity: 0.4,
            strokeWeight: 2,
            map: mapInstance.current!,
          });
          linesRef.current.push(line);
        }
      });
    }
    
  }, [crews, selectedJob, showCrews]);
  
  return <div ref={mapRef} className="w-full h-full min-h-[300px] rounded-md" />;
}

export function OpsMap({ crews, selectedJob, onCrewClick }: OpsMapProps) {
  const [showCrews, setShowCrews] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(!!window.google?.maps);
  
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || window.google?.maps) {
      setMapLoaded(!!window.google?.maps);
      return;
    }
    
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
    
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Navigation className="h-4 w-4" />
          Route Map
        </CardTitle>
        <div className="flex items-center gap-2">
          <Switch
            id="show-crews"
            checked={showCrews}
            onCheckedChange={setShowCrews}
            data-testid="switch-show-crews"
          />
          <Label htmlFor="show-crews" className="text-sm">
            {showCrews ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Label>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-2">
        {GOOGLE_MAPS_KEY && mapLoaded ? (
          <GoogleMap crews={crews} selectedJob={selectedJob} showCrews={showCrews} />
        ) : (
          <PlaceholderMap crews={crews} selectedJob={selectedJob} showCrews={showCrews} />
        )}
        
        {selectedJob && (
          <div className="mt-2 p-2 bg-muted rounded-md">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-destructive" />
              <span className="font-medium">{selectedJob.customerName}</span>
              <Badge variant="outline" className="ml-auto">
                {selectedJob.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {selectedJob.address}
            </p>
          </div>
        )}
        
        {showCrews && crews.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {crews.map((crew, i) => (
              <Badge
                key={crew.id}
                variant="secondary"
                className="text-xs cursor-pointer"
                onClick={() => onCrewClick?.(crew.id)}
                data-testid={`badge-crew-${crew.id}`}
              >
                <Home className="h-3 w-3 mr-1" />
                {i + 1}. {crew.name}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
