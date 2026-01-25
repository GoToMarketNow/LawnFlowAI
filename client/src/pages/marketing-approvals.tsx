/**
 * Marketing Approvals Page
 * 
 * Human-in-the-loop approvals for medium-confidence outreach (0.5-0.8)
 * Shows AI reasoning, allows message editing, and approve/reject actions
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  CheckCircle, 
  XCircle, 
  MessageSquare,
  Lightbulb,
  MapPin,
  Phone,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Approval {
  approval: {
    id: number;
    prospectId: number;
    approvalType: string;
    proposedMessage: string;
    proposedChannel: string;
    confidence: number;
    reasoning?: string;
    contextData?: any;
    status: string;
    createdAt: Date;
  };
  prospect: {
    id: number;
    name?: string;
    phone?: string;
    source: string;
    requestedServices?: string[];
    city?: string;
    state?: string;
    serviceabilityStatus?: string;
  };
}

export default function MarketingApprovalsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [editedMessage, setEditedMessage] = useState('');

  // Fetch pending approvals
  const { data, isLoading } = useQuery({
    queryKey: ['marketing-approvals'],
    queryFn: async () => {
      const response = await fetch('/api/marketing/approvals?businessId=1&status=pending');
      if (!response.ok) throw new Error('Failed to fetch approvals');
      return response.json();
    },
    refetchInterval: 10000, // Poll every 10 seconds
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, message }: { id: number; message: string }) => {
      const response = await fetch(`/api/marketing/approvals/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, reviewedBy: 'current_user' }),
      });
      if (!response.ok) throw new Error('Failed to approve');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-approvals'] });
      setSelectedApproval(null);
      toast({ title: 'Approved', description: 'Outreach message sent successfully' });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const response = await fetch(`/api/marketing/approvals/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, reviewedBy: 'current_user' }),
      });
      if (!response.ok) throw new Error('Failed to reject');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-approvals'] });
      setSelectedApproval(null);
      toast({ title: 'Rejected', description: 'Outreach cancelled' });
    },
  });

  const approvals: Approval[] = data?.approvals || [];

  const handleApprovalClick = (approval: Approval) => {
    setSelectedApproval(approval);
    setEditedMessage(approval.approval.proposedMessage);
  };

  const handleApprove = () => {
    if (!selectedApproval) return;
    approveMutation.mutate({
      id: selectedApproval.approval.id,
      message: editedMessage,
    });
  };

  const handleReject = () => {
    if (!selectedApproval) return;
    rejectMutation.mutate({
      id: selectedApproval.approval.id,
      reason: 'Rejected by operator',
    });
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left: Approval Queue */}
      <div className="w-1/3 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">Outreach Approvals</h1>
          <p className="text-sm text-gray-600 mt-1">
            {approvals.length} pending {approvals.length === 1 ? 'approval' : 'approvals'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : approvals.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-600">All caught up!</p>
              <p className="text-sm text-gray-500 mt-1">No pending approvals</p>
            </div>
          ) : (
            <div className="divide-y">
              {approvals.map((approval) => (
                <div
                  key={approval.approval.id}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                    selectedApproval?.approval.id === approval.approval.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleApprovalClick(approval)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">
                        {approval.prospect.name || approval.prospect.phone || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {approval.prospect.source === 'social' ? '🌐 Social' : '🤝 Referral'}
                        {approval.prospect.city && ` • ${approval.prospect.city}`}
                      </p>
                    </div>
                    <Badge variant={approval.approval.confidence >= 0.7 ? 'default' : 'secondary'}>
                      {Math.round(approval.approval.confidence * 100)}%
                    </Badge>
                  </div>

                  {/* Serviceability Badge */}
                  {approval.prospect.serviceabilityStatus === 'serviceable' && (
                    <Badge className="bg-green-100 text-green-800 text-xs mb-2">✓ Serviceable</Badge>
                  )}

                  {/* Message Preview */}
                  <p className="text-sm text-gray-700 line-clamp-2 mt-2">
                    {approval.approval.proposedMessage}
                  </p>

                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(approval.approval.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Approval Detail */}
      <div className="flex-1 flex flex-col">
        {selectedApproval ? (
          <>
            {/* Header */}
            <div className="p-6 border-b bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">
                    {selectedApproval.prospect.name || selectedApproval.prospect.phone || 'Unknown Prospect'}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge>
                      {selectedApproval.prospect.source === 'social' ? '🌐 Social' : '🤝 Referral'}
                    </Badge>
                    <Badge variant="outline">
                      {Math.round(selectedApproval.approval.confidence * 100)}% confidence
                    </Badge>
                    {selectedApproval.prospect.serviceabilityStatus === 'serviceable' && (
                      <Badge className="bg-green-100 text-green-800">✓ Serviceable</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* AI Reasoning */}
              {selectedApproval.approval.reasoning && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-yellow-500" />
                      AI Reasoning
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-700">{selectedApproval.approval.reasoning}</p>
                  </CardContent>
                </Card>
              )}

              {/* Prospect Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Prospect Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedApproval.prospect.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{selectedApproval.prospect.phone}</span>
                    </div>
                  )}
                  {(selectedApproval.prospect.city || selectedApproval.prospect.state) && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span>
                        {[selectedApproval.prospect.city, selectedApproval.prospect.state]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                  {selectedApproval.prospect.requestedServices && 
                   selectedApproval.prospect.requestedServices.length > 0 && (
                    <div className="text-sm">
                      <span className="text-gray-600">Services: </span>
                      <span>{selectedApproval.prospect.requestedServices.join(', ')}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Message Editor */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Outreach Message
                  </CardTitle>
                  <CardDescription>
                    Edit the message below, then approve or reject
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={editedMessage}
                    onChange={(e) => setEditedMessage(e.target.value)}
                    rows={6}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Will be sent via {selectedApproval.approval.proposedChannel.toUpperCase()}
                  </p>
                </CardContent>
              </Card>

              {/* Context Data */}
              {selectedApproval.approval.contextData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Additional Context</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                      {JSON.stringify(selectedApproval.approval.contextData, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t bg-white flex gap-3">
              <Button
                onClick={handleReject}
                variant="outline"
                className="flex-1"
                disabled={rejectMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={approveMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve & Send
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p>Select an approval to review</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
