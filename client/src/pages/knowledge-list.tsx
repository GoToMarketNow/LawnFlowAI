import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Search,
  Plus,
  Filter,
  BookOpen,
  FileText,
  CreditCard,
  Settings,
  Camera,
  MessageSquare,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
  Archive,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getQueryFn, apiRequest } from "@/lib/queryClient";

interface KnowledgeItem {
  id: number;
  itemType: string;
  title: string;
  slug: string;
  category: string;
  status: string;
  currentVersionId: number | null;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
}

const itemTypeIcons: Record<string, React.ReactNode> = {
  policy: <BookOpen className="h-4 w-4" />,
  service: <Settings className="h-4 w-4" />,
  payment: <CreditCard className="h-4 w-4" />,
  operations: <FileText className="h-4 w-4" />,
  proof_of_work: <Camera className="h-4 w-4" />,
  macro: <MessageSquare className="h-4 w-4" />,
};

const itemTypeLabels: Record<string, string> = {
  policy: "Policy",
  service: "Service",
  payment: "Payment FAQ",
  operations: "Operations",
  proof_of_work: "Proof of Work",
  macro: "Macro Template",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  review: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  published: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
  retired: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
};

function KnowledgeItemCard({ item }: { item: KnowledgeItem }) {
  const queryClient = useQueryClient();

  const retireMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/knowledge/items/${item.id}/retire`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/items"] });
    },
  });

  const handleRetire = () => {
    if (confirm(`Are you sure you want to retire "${item.title}"?`)) {
      retireMutation.mutate();
    }
  };

  const updatedAt = new Date(item.updatedAt);
  const timeAgo = getTimeAgo(updatedAt);

  return (
    <Card className="hover-elevate transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              {itemTypeIcons[item.itemType] || <FileText className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <Link href={`/knowledge/${item.id}`}>
                <h3 className="text-sm font-medium hover:text-primary cursor-pointer truncate">
                  {item.title}
                </h3>
              </Link>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.category} • {item.slug}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {itemTypeLabels[item.itemType] || item.itemType}
                </Badge>
                <Badge variant="outline" className={statusColors[item.status]}>
                  {item.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Updated {timeAgo}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  •••
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/knowledge/${item.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/knowledge/${item.id}/edit`}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                {item.status === "published" && (
                  <DropdownMenuItem onClick={handleRetire}>
                    <Archive className="h-4 w-4 mr-2" />
                    Retire
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function KnowledgeListPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: items, isLoading } = useQuery<KnowledgeItem[]>({
    queryKey: ["/api/knowledge/items", { status: statusFilter, type: typeFilter }],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const filteredItems = items?.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.slug.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesType = typeFilter === "all" || item.itemType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const stats = {
    total: items?.length || 0,
    published: items?.filter((i) => i.status === "published").length || 0,
    draft: items?.filter((i) => i.status === "draft").length || 0,
    review: items?.filter((i) => i.status === "review").length || 0,
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Knowledge Base</h1>
            <p className="text-muted-foreground mt-1">
              Manage policies, services, FAQs, and support templates
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/knowledge/builder">
                <Plus className="h-4 w-4 mr-2" />
                Auto-Generate
              </Link>
            </Button>
            <Button asChild>
              <Link href="/knowledge/new">
                <Plus className="h-4 w-4 mr-2" />
                Create New
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Items</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{stats.published}</div>
              <div className="text-sm text-muted-foreground">Published</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.review}</div>
              <div className="text-sm text-muted-foreground">Pending Review</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
              <div className="text-sm text-muted-foreground">Drafts</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title, category, or slug..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="review">Pending Review</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="policy">Policy</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="payment">Payment FAQ</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
                <SelectItem value="proof_of_work">Proof of Work</SelectItem>
                <SelectItem value="macro">Macro Template</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Knowledge Items List */}
      <div className="space-y-3">
        {isLoading ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-3 w-[200px]" />
                      <Skeleton className="h-3 w-[150px]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : filteredItems && filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <KnowledgeItemCard key={item.id} item={item} />
          ))
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No knowledge items found</h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                  ? "Try adjusting your filters or search term"
                  : "Get started by creating your first knowledge item or using the auto-generator"}
              </p>
              {!searchTerm && statusFilter === "all" && typeFilter === "all" && (
                <div className="flex gap-2 justify-center">
                  <Button asChild variant="outline">
                    <Link href="/knowledge/builder">Auto-Generate</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/knowledge/new">Create New</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
