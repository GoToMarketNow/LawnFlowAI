import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Download, 
  FileText, 
  Calendar,
  Users,
  Briefcase,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExportType {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  formats: string[];
}

const exportTypes: ExportType[] = [
  {
    id: 'customers',
    name: 'Customers',
    description: 'Export customer data including contact info and service history',
    icon: Users,
    formats: ['CSV', 'JSON', 'Excel'],
  },
  {
    id: 'jobs',
    name: 'Jobs',
    description: 'Export job records with status, crew assignments, and completion data',
    icon: Briefcase,
    formats: ['CSV', 'JSON', 'Excel'],
  },
  {
    id: 'quotes',
    name: 'Quotes',
    description: 'Export quote history with pricing and conversion metrics',
    icon: FileText,
    formats: ['CSV', 'JSON', 'Excel'],
  },
  {
    id: 'schedule',
    name: 'Schedule',
    description: 'Export scheduling data for a date range',
    icon: Calendar,
    formats: ['CSV', 'iCal', 'JSON'],
  },
  {
    id: 'audit-log',
    name: 'Audit Log',
    description: 'Export system activity and agent actions log',
    icon: Clock,
    formats: ['CSV', 'JSON'],
  },
];

function ExportCard({ exportType }: { exportType: ExportType }) {
  const [format, setFormat] = useState(exportType.formats[0]);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const Icon = exportType.icon;

  const handleExport = async () => {
    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsExporting(false);
    toast({
      title: "Export started",
      description: `Your ${exportType.name} export will be ready shortly.`,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">{exportType.name}</CardTitle>
            <CardDescription className="text-sm">{exportType.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="w-[120px]" data-testid={`select-format-${exportType.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {exportType.formats.map(f => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={handleExport} 
            disabled={isExporting}
            data-testid={`button-export-${exportType.id}`}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsExportsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="page-title-exports">Data Exports</h1>
        <p className="text-sm text-muted-foreground">
          Export your data in various formats for backup or analysis
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {exportTypes.map(exportType => (
          <ExportCard key={exportType.id} exportType={exportType} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scheduled Exports</CardTitle>
          <CardDescription>
            Set up automatic exports on a recurring schedule
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No scheduled exports configured. Contact support to set up automated exports.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
