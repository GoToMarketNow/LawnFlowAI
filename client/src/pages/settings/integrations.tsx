import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Plug, 
  CheckCircle, 
  XCircle, 
  ExternalLink,
  RefreshCw,
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  icon?: React.ReactNode;
}

const integrations: Integration[] = [
  {
    id: 'jobber',
    name: 'Jobber',
    description: 'Field service management and scheduling',
    status: 'connected',
    lastSync: '5 minutes ago',
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'SMS and voice communications',
    status: 'connected',
    lastSync: '1 minute ago',
  },
  {
    id: 'google-maps',
    name: 'Google Maps',
    description: 'Route optimization and geocoding',
    status: 'connected',
    lastSync: '2 minutes ago',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing',
    status: 'disconnected',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Accounting and invoicing',
    status: 'disconnected',
  },
];

function IntegrationCard({ integration }: { integration: Integration }) {
  const statusColor = {
    connected: 'bg-green-500',
    disconnected: 'bg-muted-foreground',
    error: 'bg-destructive',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            <Plug className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">{integration.name}</CardTitle>
            <CardDescription className="text-sm">{integration.description}</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${statusColor[integration.status]}`} />
          <Badge variant={integration.status === 'connected' ? 'secondary' : 'outline'}>
            {integration.status === 'connected' ? 'Connected' : 'Not Connected'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          {integration.status === 'connected' ? (
            <>
              <span className="text-xs text-muted-foreground">
                Last sync: {integration.lastSync}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" data-testid={`button-sync-${integration.id}`}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Sync
                </Button>
                <Button variant="ghost" size="sm" data-testid={`button-settings-${integration.id}`}>
                  Settings
                </Button>
              </div>
            </>
          ) : (
            <Button variant="outline" size="sm" data-testid={`button-connect-${integration.id}`}>
              <Plug className="h-4 w-4 mr-2" />
              Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsIntegrationsPage() {
  const connected = integrations.filter(i => i.status === 'connected');
  const available = integrations.filter(i => i.status !== 'connected');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="page-title-integrations">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect external services to enhance LawnFlow capabilities
        </p>
      </div>

      {connected.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Connected ({connected.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {connected.map(integration => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </div>
      )}

      {available.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Available Integrations</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {available.map(integration => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
