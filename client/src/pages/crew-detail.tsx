import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useUserRole } from "@/components/role-gate";
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
  Wrench,
  Star,
  Truck,
  ClipboardList,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { Crew, CrewMember, User, Skill, Equipment, CrewSkill, CrewEquipment } from "@shared/schema";
import { format } from "date-fns";

type CrewSkillWithSkill = CrewSkill & { skill: Skill };
type CrewEquipmentWithEquipment = CrewEquipment & { equipment: Equipment };

type CrewWithMembers = Crew & {
  members?: CrewMember[];
  memberCount?: number;
  leader?: CrewMember | null;
};

export default function CrewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const userRole = useUserRole();
  const canEdit = userRole === "OWNER" || userRole === "ADMIN";
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showRemoveMemberDialog, setShowRemoveMemberDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CrewMember | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [memberRole, setMemberRole] = useState<"WORKER" | "DRIVER">("WORKER");
  
  const [showAddSkillDialog, setShowAddSkillDialog] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [proficiencyLevel, setProficiencyLevel] = useState("3");
  
  const [showAddEquipmentDialog, setShowAddEquipmentDialog] = useState(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [capacityHours, setCapacityHours] = useState("");
  const [maxJobs, setMaxJobs] = useState("");

  const { data: crew, isLoading, refetch } = useQuery<CrewWithMembers>({
    queryKey: ["/api/ops/crews", id],
  });

  const { data: availableUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: allSkills } = useQuery<Skill[]>({
    queryKey: ["/api/ops/skills"],
  });

  const { data: allEquipment } = useQuery<Equipment[]>({
    queryKey: ["/api/ops/equipment"],
  });

  const { data: crewSkills } = useQuery<CrewSkillWithSkill[]>({
    queryKey: ["/api/ops/crews", id, "skills"],
    enabled: !!id,
  });

  const { data: crewEquipmentList } = useQuery<CrewEquipmentWithEquipment[]>({
    queryKey: ["/api/ops/crews", id, "equipment"],
    enabled: !!id,
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

  const addSkillMutation = useMutation({
    mutationFn: async (data: { skillId: number; proficiencyLevel: number }) => {
      return apiRequest("POST", `/api/ops/crews/${id}/skills`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/crews", id, "skills"] });
      setShowAddSkillDialog(false);
      setSelectedSkillId("");
      setProficiencyLevel("3");
      toast({ title: "Skill added to crew" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add skill", description: error.message, variant: "destructive" });
    },
  });

  const removeSkillMutation = useMutation({
    mutationFn: async (skillId: number) => {
      return apiRequest("DELETE", `/api/ops/crews/${id}/skills/${skillId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/crews", id, "skills"] });
      toast({ title: "Skill removed from crew" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove skill", description: error.message, variant: "destructive" });
    },
  });

  const addEquipmentMutation = useMutation({
    mutationFn: async (equipmentId: number) => {
      return apiRequest("POST", `/api/ops/crews/${id}/equipment`, { equipmentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/crews", id, "equipment"] });
      setShowAddEquipmentDialog(false);
      setSelectedEquipmentId("");
      toast({ title: "Equipment assigned to crew" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to assign equipment", description: error.message, variant: "destructive" });
    },
  });

  const removeEquipmentMutation = useMutation({
    mutationFn: async (equipmentId: number) => {
      return apiRequest("DELETE", `/api/ops/crews/${id}/equipment/${equipmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/crews", id, "equipment"] });
      toast({ title: "Equipment removed from crew" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove equipment", description: error.message, variant: "destructive" });
    },
  });

  const updateCapacityMutation = useMutation({
    mutationFn: async (data: { dailyCapacityMinutes: number; maxJobsPerDay: number }) => {
      return apiRequest("PATCH", `/api/ops/crews/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/crews", id] });
      setEditingCapacity(false);
      toast({ title: "Capacity updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update capacity", description: error.message, variant: "destructive" });
    },
  });

  const assignedSkillIds = crewSkills?.map(cs => cs.skillId) ?? [];
  const availableSkillsToAdd = allSkills?.filter(s => !assignedSkillIds.includes(s.id)) ?? [];
  
  const assignedEquipmentIds = crewEquipmentList?.map(ce => ce.equipmentId) ?? [];
  const availableEquipmentToAdd = allEquipment?.filter(e => !assignedEquipmentIds.includes(e.id)) ?? [];

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
          {canEdit && (
            <Button 
              onClick={() => setShowAddMemberDialog(true)}
              data-testid="button-add-member"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          )}
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
                {canEdit ? "Add team members to this crew to get started" : "No members assigned to this crew yet"}
              </p>
              {canEdit && (
                <Button 
                  className="mt-4" 
                  onClick={() => setShowAddMemberDialog(true)}
                  data-testid="button-add-first-member"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              )}
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
                      {canEdit && (
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
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Skills
                </CardTitle>
                <CardDescription>
                  {crewSkills?.length ?? 0} skill{(crewSkills?.length ?? 0) !== 1 ? "s" : ""} assigned
                </CardDescription>
              </div>
              {canEdit && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowAddSkillDialog(true)}
                  disabled={availableSkillsToAdd.length === 0}
                  data-testid="button-add-skill"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Skill
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!crewSkills || crewSkills.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Star className="h-8 w-8 mx-auto opacity-30 mb-2" />
                <p className="text-sm">No skills assigned</p>
              </div>
            ) : (
              <div className="space-y-2">
                {crewSkills.map((cs) => (
                  <div 
                    key={cs.id} 
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    data-testid={`skill-item-${cs.skillId}`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {cs.skill.category}
                      </Badge>
                      <span className="text-sm font-medium">{cs.skill.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <Star 
                            key={level}
                            className={`h-3 w-3 ${level <= cs.proficiencyLevel ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                      {canEdit && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7"
                          onClick={() => removeSkillMutation.mutate(cs.skillId)}
                          data-testid={`button-remove-skill-${cs.skillId}`}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Equipment
                </CardTitle>
                <CardDescription>
                  {crewEquipmentList?.length ?? 0} item{(crewEquipmentList?.length ?? 0) !== 1 ? "s" : ""} assigned
                </CardDescription>
              </div>
              {canEdit && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowAddEquipmentDialog(true)}
                  disabled={availableEquipmentToAdd.length === 0}
                  data-testid="button-add-equipment"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Equipment
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!crewEquipmentList || crewEquipmentList.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Truck className="h-8 w-8 mx-auto opacity-30 mb-2" />
                <p className="text-sm">No equipment assigned</p>
              </div>
            ) : (
              <div className="space-y-2">
                {crewEquipmentList.map((ce) => (
                  <div 
                    key={ce.id} 
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    data-testid={`equipment-item-${ce.equipmentId}`}
                  >
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{ce.equipment.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {ce.equipment.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={ce.equipment.status === "available" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {ce.equipment.status}
                      </Badge>
                      {canEdit && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7"
                          onClick={() => removeEquipmentMutation.mutate(ce.equipmentId)}
                          data-testid={`button-remove-equipment-${ce.equipmentId}`}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Capacity Settings
              </CardTitle>
              <CardDescription>
                Configure daily work capacity for scheduling
              </CardDescription>
            </div>
            {canEdit && !editingCapacity && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  setCapacityHours(String(Math.floor((crew.dailyCapacityMinutes ?? 420) / 60)));
                  setMaxJobs(String(crew.maxJobsPerDay ?? 8));
                  setEditingCapacity(true);
                }}
                data-testid="button-edit-capacity"
              >
                Edit Capacity
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingCapacity ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="capacity-hours">Daily Hours</Label>
                  <Input 
                    id="capacity-hours"
                    type="number"
                    min="1"
                    max="16"
                    value={capacityHours}
                    onChange={(e) => setCapacityHours(e.target.value)}
                    data-testid="input-capacity-hours"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-jobs">Max Jobs/Day</Label>
                  <Input 
                    id="max-jobs"
                    type="number"
                    min="1"
                    max="50"
                    value={maxJobs}
                    onChange={(e) => setMaxJobs(e.target.value)}
                    data-testid="input-max-jobs"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm"
                  onClick={() => updateCapacityMutation.mutate({
                    dailyCapacityMinutes: parseInt(capacityHours) * 60,
                    maxJobsPerDay: parseInt(maxJobs),
                  })}
                  disabled={updateCapacityMutation.isPending}
                  data-testid="button-save-capacity"
                >
                  {updateCapacityMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingCapacity(false)}
                  data-testid="button-cancel-capacity"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Daily Capacity</div>
                  <div className="text-lg font-semibold">
                    {Math.floor((crew.dailyCapacityMinutes ?? 420) / 60)} hours
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Max Jobs/Day</div>
                  <div className="text-lg font-semibold">
                    {crew.maxJobsPerDay ?? 8} jobs
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddSkillDialog} onOpenChange={setShowAddSkillDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Skill to Crew</DialogTitle>
            <DialogDescription>
              Assign a skill with proficiency level
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Skill</Label>
              <Select value={selectedSkillId} onValueChange={setSelectedSkillId}>
                <SelectTrigger data-testid="select-skill">
                  <SelectValue placeholder="Choose a skill..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSkillsToAdd.map((skill) => (
                    <SelectItem 
                      key={skill.id} 
                      value={skill.id.toString()}
                      data-testid={`option-skill-${skill.id}`}
                    >
                      {skill.name} ({skill.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Proficiency Level (1-5)</Label>
              <Select value={proficiencyLevel} onValueChange={setProficiencyLevel}>
                <SelectTrigger data-testid="select-proficiency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Beginner</SelectItem>
                  <SelectItem value="2">2 - Basic</SelectItem>
                  <SelectItem value="3">3 - Intermediate</SelectItem>
                  <SelectItem value="4">4 - Advanced</SelectItem>
                  <SelectItem value="5">5 - Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowAddSkillDialog(false)}
              data-testid="button-cancel-add-skill"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => addSkillMutation.mutate({ 
                skillId: parseInt(selectedSkillId), 
                proficiencyLevel: parseInt(proficiencyLevel),
              })}
              disabled={!selectedSkillId || addSkillMutation.isPending}
              data-testid="button-confirm-add-skill"
            >
              {addSkillMutation.isPending ? "Adding..." : "Add Skill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddEquipmentDialog} onOpenChange={setShowAddEquipmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Equipment to Crew</DialogTitle>
            <DialogDescription>
              Assign available equipment to this crew
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Equipment</Label>
              <Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId}>
                <SelectTrigger data-testid="select-equipment">
                  <SelectValue placeholder="Choose equipment..." />
                </SelectTrigger>
                <SelectContent>
                  {availableEquipmentToAdd.map((equip) => (
                    <SelectItem 
                      key={equip.id} 
                      value={equip.id.toString()}
                      data-testid={`option-equipment-${equip.id}`}
                    >
                      {equip.name} ({equip.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowAddEquipmentDialog(false)}
              data-testid="button-cancel-add-equipment"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => addEquipmentMutation.mutate(parseInt(selectedEquipmentId))}
              disabled={!selectedEquipmentId || addEquipmentMutation.isPending}
              data-testid="button-confirm-add-equipment"
            >
              {addEquipmentMutation.isPending ? "Assigning..." : "Assign Equipment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
