import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Users, 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Plus,
  MoreHorizontal,
  Trash2,
  Crown,
  CircleDot,
  RefreshCw,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { Crew, CrewMember, User } from "@shared/schema";
import { format } from "date-fns";

type CrewWithMembers = Crew & {
  members?: CrewMember[];
  memberCount?: number;
  leader?: CrewMember | null;
};

export default function CrewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showRemoveMemberDialog, setShowRemoveMemberDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CrewMember | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [memberRole, setMemberRole] = useState<"WORKER" | "DRIVER">("WORKER");

  const { data: crew, isLoading, refetch } = useQuery<CrewWithMembers>({
    queryKey: ["/api/ops/crews", id],
  });

  const { data: availableUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const addMemberMutation = useMutation({
    mutationFn: async (data: { userId: number; role: string }) => {
      return apiRequest("POST", `/api/ops/crews/${id}/members`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/crews", id] });
      setShowAddMemberDialog(false);
      setSelectedUserId("");
      setMemberRole("WORKER");
      toast({ title: "Member added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add member", description: error.message, variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: number) => {
      return apiRequest("DELETE", `/api/ops/crews/${id}/members/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/crews", id] });
      setShowRemoveMemberDialog(false);
      setSelectedMember(null);
      toast({ title: "Member removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove member", description: error.message, variant: "destructive" });
    },
  });

  const setLeaderMutation = useMutation({
    mutationFn: async (memberId: number) => {
      return apiRequest("POST", `/api/ops/crews/${id}/leader`, { memberId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/crews", id] });
      toast({ title: "Crew leader updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to set leader", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!crew) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
          <h3 className="mt-4 text-lg font-medium">Crew not found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            The crew you're looking for doesn't exist or has been deleted.
          </p>
          <Link href="/operations/crews">
            <Button className="mt-4" data-testid="button-back-to-crews">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Crews
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const members = crew.members ?? [];
  const activeMembers = members.filter(m => m.isActive);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/operations/crews">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold" data-testid="text-crew-name">{crew.name}</h1>
              <Badge 
                variant={crew.status === "ACTIVE" ? "default" : "secondary"}
                data-testid="badge-crew-status"
              >
                {crew.status ?? "ACTIVE"}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Crew ID: {crew.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => refetch()}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button 
            onClick={() => setShowAddMemberDialog(true)}
            data-testid="button-add-member"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crew Details</CardTitle>
            <CardDescription>Basic information and configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">Home Base</div>
                <div className="text-muted-foreground">
                  {crew.homeBaseAddress || "Not configured"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CircleDot className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">Service Radius</div>
                <div className="text-muted-foreground">
                  {crew.serviceRadiusMiles ?? 20} miles
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="font-medium">Daily Capacity</div>
                <div className="text-muted-foreground">
                  {crew.dailyCapacityMinutes ? `${Math.floor(crew.dailyCapacityMinutes / 60)} hours` : "7 hours"}
                </div>
              </div>
            </div>
            {crew.homeBaseLat && crew.homeBaseLng && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Coordinates</div>
                  <div className="text-muted-foreground font-mono text-xs">
                    {crew.homeBaseLat.toFixed(4)}, {crew.homeBaseLng.toFixed(4)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crew Leader</CardTitle>
            <CardDescription>The designated lead for this crew</CardDescription>
          </CardHeader>
          <CardContent>
            {crew.leader ? (
              <div className="flex items-center gap-3 p-3 rounded-md bg-primary/5 border border-primary/10">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Crown className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{crew.leader.displayName}</div>
                  <div className="text-sm text-muted-foreground">
                    Crew Leader since {crew.leader.startAt ? format(new Date(crew.leader.startAt), "MMM d, yyyy") : "N/A"}
                  </div>
                </div>
                <Badge variant="outline">{crew.leader.role}</Badge>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Crown className="h-8 w-8 mx-auto opacity-30 mb-2" />
                <p className="text-sm">No crew leader assigned</p>
                <p className="text-xs">Assign a leader from the members list below</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Crew Members</CardTitle>
              <CardDescription>
                {activeMembers.length} active member{activeMembers.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-medium">No members yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Add team members to this crew to get started
              </p>
              <Button 
                className="mt-4" 
                onClick={() => setShowAddMemberDialog(true)}
                data-testid="button-add-first-member"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow 
                    key={member.id}
                    data-testid={`row-member-${member.id}`}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          {crew.leader?.id === member.id ? (
                            <Crown className="h-4 w-4 text-primary" />
                          ) : (
                            <Users className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            {member.displayName}
                            {crew.leader?.id === member.id && (
                              <Badge variant="outline" className="text-xs">Leader</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" data-testid={`badge-role-${member.id}`}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={member.isActive ? "default" : "secondary"}
                        data-testid={`badge-status-${member.id}`}
                      >
                        {member.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.startAt ? format(new Date(member.startAt), "MMM d, yyyy") : "N/A"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-menu-${member.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {crew.leader?.id !== member.id && (
                            <DropdownMenuItem 
                              onClick={() => setLeaderMutation.mutate(member.id)}
                              data-testid={`menu-set-leader-${member.id}`}
                            >
                              <Crown className="h-4 w-4 mr-2" />
                              Set as Leader
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setSelectedMember(member);
                              setShowRemoveMemberDialog(true);
                            }}
                            data-testid={`menu-remove-${member.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove from Crew
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Crew Member</DialogTitle>
            <DialogDescription>
              Add an existing user to this crew
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger data-testid="select-user">
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers?.map((user) => (
                    <SelectItem 
                      key={user.id} 
                      value={user.id.toString()}
                      data-testid={`option-user-${user.id}`}
                    >
                      {user.displayName || user.phoneE164 || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={memberRole} onValueChange={(v) => setMemberRole(v as "WORKER" | "DRIVER")}>
                <SelectTrigger data-testid="select-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WORKER">Worker</SelectItem>
                  <SelectItem value="DRIVER">Driver</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowAddMemberDialog(false)}
              data-testid="button-cancel-add"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => addMemberMutation.mutate({ 
                userId: parseInt(selectedUserId), 
                role: memberRole 
              })}
              disabled={!selectedUserId || addMemberMutation.isPending}
              data-testid="button-confirm-add"
            >
              {addMemberMutation.isPending ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRemoveMemberDialog} onOpenChange={setShowRemoveMemberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Crew Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove "{selectedMember?.displayName}" from this crew?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowRemoveMemberDialog(false)}
              data-testid="button-cancel-remove"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => selectedMember && removeMemberMutation.mutate(selectedMember.id)}
              disabled={removeMemberMutation.isPending}
              data-testid="button-confirm-remove"
            >
              {removeMemberMutation.isPending ? "Removing..." : "Remove Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
