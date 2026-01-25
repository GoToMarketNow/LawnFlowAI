// ============================================
// Campaign Proposal Component
// Display and approve winter campaign proposals
// ============================================

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Snowflake,
  Users,
  DollarSign,
  Send,
  Clock,
  Target,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings
} from 'lucide-react';

export interface WinterEvent {
  eventId: string;
  eventType: string;
  windowStart: string;
  windowEnd: string;
  confidence: number;
  drivers?: {
    snowInches?: number;
    iceProbability?: number;
    tempMin?: number;
  };
}

export interface CampaignProposalData {
  campaignId: string;
  eventId: string;
  segment: {
    estimatedCustomers: number;
    filtersApplied: string[];
  };
  offer: {
    serviceType: string;
    pricingModel: string;
    basePrice?: number;
  };
  capacity: {
    maxAcceptsTotal: number;
    maxAcceptsPerHour: number;
  };
  throttle: {
    batchSize: number;
    delayBetweenBatchesSec: number;
  };
  metricsEstimate: {
    expectedConversionRate: number;
    expectedRevenue: number;
    expectedMargin: number;
  };
}

interface CampaignProposalProps {
  event: WinterEvent;
  proposal: CampaignProposalData;
  onApprove: (modifiedThrottle?: { maxAcceptsTotal?: number; batchSize?: number }) => void;
  onReject: (reason: string) => void;
  isLoading?: boolean;
  className?: string;
}

function formatEventType(type: string): string {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function CampaignProposal({
  event,
  proposal,
  onApprove,
  onReject,
  isLoading = false,
  className
}: CampaignProposalProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [maxAccepts, setMaxAccepts] = useState(proposal.capacity.maxAcceptsTotal);
  const [batchSize, setBatchSize] = useState(proposal.throttle.batchSize);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const handleApprove = () => {
    const modified = 
      maxAccepts !== proposal.capacity.maxAcceptsTotal || 
      batchSize !== proposal.throttle.batchSize
        ? { maxAcceptsTotal: maxAccepts, batchSize }
        : undefined;
    onApprove(modified);
  };

  const handleReject = () => {
    onReject(rejectReason || 'Rejected by operator');
    setShowRejectDialog(false);
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header with event info */}
      <CardHeader className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Snowflake className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {formatEventType(event.eventType)} Campaign
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(event.windowStart)} - {formatDateTime(event.windowEnd)}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50">
            {Math.round(event.confidence * 100)}% confidence
          </Badge>
        </div>

        {/* Event details */}
        {event.drivers && (
          <div className="flex gap-4 mt-3 text-sm">
            {event.drivers.snowInches && (
              <span className="flex items-center gap-1">
                <Snowflake className="h-4 w-4" />
                {event.drivers.snowInches}" expected
              </span>
            )}
            {event.drivers.iceProbability && (
              <span>Ice: {event.drivers.iceProbability}%</span>
            )}
            {event.drivers.tempMin && (
              <span>Low: {event.drivers.tempMin}°F</span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Segment info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Target Audience
            </div>
            <p className="text-2xl font-bold">{proposal.segment.estimatedCustomers}</p>
            <p className="text-xs text-muted-foreground">eligible customers</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              Capacity
            </div>
            <p className="text-2xl font-bold">{proposal.capacity.maxAcceptsTotal}</p>
            <p className="text-xs text-muted-foreground">max accepts</p>
          </div>
        </div>

        <Separator />

        {/* Projected metrics */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Projected Results
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-lg font-semibold">
                {Math.round(proposal.metricsEstimate.expectedConversionRate * 100)}%
              </p>
              <p className="text-xs text-muted-foreground">Conversion</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                ${proposal.metricsEstimate.expectedRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Revenue</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                ${proposal.metricsEstimate.expectedMargin.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Margin</p>
            </div>
          </div>
        </div>

        {/* Offer details */}
        <div className="text-sm">
          <h4 className="font-medium mb-2">Offer Details</h4>
          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
            <div>Service: {proposal.offer.serviceType.replace(/_/g, ' ')}</div>
            <div>Pricing: {proposal.offer.pricingModel}</div>
            {proposal.offer.basePrice && (
              <div>Base Price: ${proposal.offer.basePrice}</div>
            )}
          </div>
        </div>

        {/* Throttle settings */}
        {showSettings && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Campaign Settings
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="maxAccepts" className="text-xs">Max Accepts</Label>
                <Input
                  id="maxAccepts"
                  type="number"
                  value={maxAccepts}
                  onChange={(e) => setMaxAccepts(Number(e.target.value))}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="batchSize" className="text-xs">Batch Size</Label>
                <Input
                  id="batchSize"
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="h-8"
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between gap-2 bg-muted/30 pt-4">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4 mr-1" />
            {showSettings ? 'Hide' : 'Settings'}
          </Button>
        </div>

        <div className="flex gap-2">
          <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isLoading}>
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject Campaign</DialogTitle>
                <DialogDescription>
                  Are you sure you want to reject this winter campaign? Customers will not be notified.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Input
                  id="reason"
                  placeholder="Why are you rejecting this campaign?"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="mt-2"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleReject}>
                  Reject Campaign
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button 
            size="sm" 
            onClick={handleApprove} 
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Clock className="h-4 w-4 mr-1 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Approve & Send
              </>
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
