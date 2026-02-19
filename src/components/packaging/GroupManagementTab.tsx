import { useState, Fragment } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { 
  Loader2, Boxes, Package, Search, ChevronDown, ChevronRight,
  Truck, RotateCcw, CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface GroupWithPacks {
  id: string;
  group_id: string;
  label_count: number;
  status: string;
  created_at: string;
  packs?: {
    id: string;
    label_id: string;
    status: string;
    previous_uses: number;
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  created: "bg-blue-100 text-blue-800",
  pending: "bg-yellow-100 text-yellow-800",
  shipped: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
};

export function GroupManagementTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loadingPacks, setLoadingPacks] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: groups, isLoading, refetch } = useQuery({
    queryKey: ["label-groups", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("label_groups")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (searchQuery) {
        query = query.ilike("group_id", `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as GroupWithPacks[];
    },
  });

  const toggleGroup = async (group: GroupWithPacks) => {
    const newExpanded = new Set(expandedGroups);
    
    if (expandedGroups.has(group.id)) {
      newExpanded.delete(group.id);
      setExpandedGroups(newExpanded);
      return;
    }

    // Load packs for this group if not already loaded
    if (!group.packs) {
      setLoadingPacks((prev) => new Set(prev).add(group.id));

      try {
        const { data: packs, error } = await supabase
          .from("labels")
          .select("id, label_id, status, previous_uses")
          .eq("group_id", group.id)
          .order("label_id");

        if (error) throw error;

        // Update the group with packs data
        group.packs = packs;
      } catch (error) {
        console.error("Error loading packs:", error);
        toast({
          title: "Failed to load packs",
          description: "Could not load pack details for this group",
          variant: "destructive",
        });
      } finally {
        setLoadingPacks((prev) => {
          const next = new Set(prev);
          next.delete(group.id);
          return next;
        });
      }
    }

    newExpanded.add(group.id);
    setExpandedGroups(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "shipped":
        return <Truck className="h-4 w-4" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <Boxes className="h-4 w-4" />;
    }
  };

  const getPackStatusCounts = (packs: GroupWithPacks["packs"]) => {
    if (!packs) return {};
    return packs.reduce((acc, pack) => {
      acc[pack.status] = (acc[pack.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5" />
            Group Management
          </CardTitle>
          <CardDescription>
            View and manage all groups. Expand a group to see individual pack statuses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search group ID..."
                className="pl-9 font-mono"
              />
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : groups && groups.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Group ID</TableHead>
                  <TableHead>Packs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <Fragment key={group.id}>
                    <TableRow 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleGroup(group)}
                    >
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          {loadingPacks.has(group.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : expandedGroups.has(group.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        {group.group_id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {group.label_count}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[group.status] || "bg-gray-100 text-gray-800"}>
                          {getStatusIcon(group.status)}
                          <span className="ml-1 capitalize">{group.status}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(group.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                    {expandedGroups.has(group.id) && group.packs && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/30 p-4">
                          <div className="space-y-3">
                            <div className="flex gap-4 text-sm">
                              <span className="text-muted-foreground">Pack Status Summary:</span>
                              {Object.entries(getPackStatusCounts(group.packs)).map(([status, count]) => (
                                <Badge key={status} variant="outline">
                                  {status}: {count}
                                </Badge>
                              ))}
                            </div>
                            <div className="max-h-60 overflow-y-auto border rounded-md">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Pack ID</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Uses</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.packs.map((pack) => (
                                    <TableRow key={pack.id}>
                                      <TableCell className="font-mono text-sm">
                                        {pack.label_id}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="capitalize">
                                          {pack.status}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-1">
                                          <RotateCcw className="h-3 w-3 text-muted-foreground" />
                                          {pack.previous_uses}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Boxes className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No groups found</p>
              <p className="text-sm">Create a group by uploading pack IDs in the "Create Group" tab</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
