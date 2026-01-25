/**
 * Marketing Pipeline Page
 * 
 * 3-column Kanban board showing prospects by stage:
 * - Identified: Discovered prospects
 * - Engaged: Prospects who responded
 * - Converted: Prospects handed off to Lead Intake
 * 
 * Each card shows serviceability status with visual indicators
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  MessageSquare,
  MapPin,
  Calendar,
  TrendingUp,
  Search,
  Filter
} from 'lucide-react';

interface Prospect {
  id: number;
  name?: string;
  phone?: string;
  source: string;
  stage: string;
  status: string;
  serviceabilityStatus?: string;
  confidence: number;
  requestedServices?: string[];
  city?: string;
  state?: string;
  lastOutreachAt?: Date;
  createdAt: Date;
}

export default function MarketingPipelinePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [serviceabilityFilter, setServiceabilityFilter] = useState<string>('all');

  // Fetch prospects
  const { data, isLoading } = useQuery({
    queryKey: ['marketing-prospects', sourceFilter, serviceabilityFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        businessId: '1', // TODO: Get from context
      });
      
      if (sourceFilter !== 'all') {
        params.append('source', sourceFilter);
      }
      if (serviceabilityFilter !== 'all') {
        params.append('serviceabilityStatus', serviceabilityFilter);
      }

      const response = await fetch(`/api/marketing/prospects?${params}`);
      if (!response.ok) throw new Error('Failed to fetch prospects');
      return response.json();
    },
  });

  const prospects = data?.prospects || [];

  // Group by stage
  const identified = prospects.filter((p: Prospect) => p.stage === 'identified');
  const engaged = prospects.filter((p: Prospect) => p.stage === 'engaged');
  const converted = prospects.filter((p: Prospect) => p.stage === 'converted');

  // Filter by search
  const filterProspects = (prospects: Prospect[]) => {
    if (!searchQuery) return prospects;
    return prospects.filter(p => 
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone?.includes(searchQuery) ||
      p.city?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Marketing Pipeline</h1>
            <p className="text-sm text-gray-600">Track prospects from discovery to conversion</p>
          </div>
          <Button>
            <TrendingUp className="h-4 w-4 mr-2" />
            View Performance
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, phone, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="social">Social</SelectItem>
              <SelectItem value="referral">Referral</SelectItem>
            </SelectContent>
          </Select>

          <Select value={serviceabilityFilter} onValueChange={setServiceabilityFilter}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Serviceability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="serviceable">Serviceable</SelectItem>
              <SelectItem value="maybe_serviceable">Maybe</SelectItem>
              <SelectItem value="not_serviceable">Not Serviceable</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pipeline Board */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-3 gap-6 h-full">
          {/* Identified Column */}
          <div className="flex flex-col">
            <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Identified</h3>
                <Badge variant="secondary">{filterProspects(identified).length}</Badge>
              </div>
              <p className="text-xs text-gray-500 mt-1">New prospects discovered</p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {filterProspects(identified).map((prospect) => (
                <ProspectCard key={prospect.id} prospect={prospect} />
              ))}
            </div>
          </div>

          {/* Engaged Column */}
          <div className="flex flex-col">
            <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Engaged</h3>
                <Badge variant="secondary">{filterProspects(engaged).length}</Badge>
              </div>
              <p className="text-xs text-gray-500 mt-1">Prospects responded</p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {filterProspects(engaged).map((prospect) => (
                <ProspectCard key={prospect.id} prospect={prospect} />
              ))}
            </div>
          </div>

          {/* Converted Column */}
          <div className="flex flex-col">
            <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Converted</h3>
                <Badge variant="secondary">{filterProspects(converted).length}</Badge>
              </div>
              <p className="text-xs text-gray-500 mt-1">Handed to Lead Intake</p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {filterProspects(converted).map((prospect) => (
                <ProspectCard key={prospect.id} prospect={prospect} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProspectCard({ prospect }: { prospect: Prospect }) {
  const getServiceabilityIcon = () => {
    switch (prospect.serviceabilityStatus) {
      case 'serviceable':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'maybe_serviceable':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'not_serviceable':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getServiceabilityBadge = () => {
    switch (prospect.serviceabilityStatus) {
      case 'serviceable':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Serviceable</Badge>;
      case 'maybe_serviceable':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Needs Info</Badge>;
      case 'not_serviceable':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Out of Area</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getSourceBadge = () => {
    const colors = {
      social: 'bg-blue-100 text-blue-800 border-blue-200',
      referral: 'bg-purple-100 text-purple-800 border-purple-200',
    };
    return (
      <Badge className={colors[prospect.source as keyof typeof colors] || 'bg-gray-100'}>
        {prospect.source === 'social' ? '🌐 Social' : '🤝 Referral'}
      </Badge>
    );
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-medium">
              {prospect.name || prospect.phone || 'Unknown'}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              {getSourceBadge()}
              <Badge variant="outline" className="text-xs">
                {Math.round(prospect.confidence * 100)}% confidence
              </Badge>
            </div>
          </div>
          {getServiceabilityIcon()}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Serviceability Status */}
        <div className="flex items-center justify-between">
          {getServiceabilityBadge()}
        </div>

        {/* Services */}
        {prospect.requestedServices && prospect.requestedServices.length > 0 && (
          <div className="text-xs text-gray-600">
            {prospect.requestedServices.slice(0, 2).join(', ')}
            {prospect.requestedServices.length > 2 && ` +${prospect.requestedServices.length - 2}`}
          </div>
        )}

        {/* Location */}
        {(prospect.city || prospect.state) && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="h-3 w-3" />
            {[prospect.city, prospect.state].filter(Boolean).join(', ')}
          </div>
        )}

        {/* Last Activity */}
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Calendar className="h-3 w-3" />
          {prospect.lastOutreachAt 
            ? `Last contact: ${new Date(prospect.lastOutreachAt).toLocaleDateString()}`
            : `Added: ${new Date(prospect.createdAt).toLocaleDateString()}`
          }
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" className="flex-1 text-xs">
            <MessageSquare className="h-3 w-3 mr-1" />
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
