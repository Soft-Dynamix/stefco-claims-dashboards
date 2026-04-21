"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Mail,
  Building2,
  Brain,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Printer,
} from "lucide-react";

interface DashboardData {
  stats: {
    totalClaims: number;
    pendingClaims: number;
    completedClaims: number;
    emailQueuePending: number;
    emailQueueAnalyzed: number;
    insuranceCompanies: number;
    learningPatterns: number;
    senderProfiles: number;
    accuracyRate: string;
  };
  recentClaims: Array<{
    id: string;
    claimNumber: string;
    clientName: string | null;
    status: string;
    createdAt: string;
    insuranceCompany: { name: string } | null;
  }>;
  claimsByStatus: Array<{ status: string; count: number }>;
  claimsByType: Array<{ type: string; count: number }>;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string | null;
    createdAt: string;
    status: string;
  }>;
  printQueueStats: Array<{ status: string; count: number }>;
}

export function DashboardSection() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error("Failed to fetch dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Failed to load dashboard data</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    NEW: "bg-blue-500",
    IN_PROGRESS: "bg-yellow-500",
    PENDING_INFO: "bg-orange-500",
    COMPLETED: "bg-green-500",
    CLOSED: "bg-gray-500",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your claims processing system
          </p>
        </div>
        <Button onClick={() => window.location.href = "#inbox"}>
          <Mail className="mr-2 h-4 w-4" />
          Check Inbox
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.totalClaims}</div>
            <p className="text-xs text-muted-foreground">
              {data.stats.pendingClaims} pending review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Queue</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.emailQueuePending}</div>
            <p className="text-xs text-muted-foreground">
              {data.stats.emailQueueAnalyzed} analyzed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Accuracy</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.accuracyRate}%</div>
            <Progress value={parseFloat(data.stats.accuracyRate)} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Learning Data</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.learningPatterns}</div>
            <p className="text-xs text-muted-foreground">
              {data.stats.senderProfiles} sender profiles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Insurance Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.insuranceCompanies}</div>
            <p className="text-xs text-muted-foreground">Active companies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Claims</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.completedClaims}</div>
            <p className="text-xs text-muted-foreground">Successfully processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Print Queue</CardTitle>
            <Printer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.printQueueStats.find(p => p.status === "QUEUED")?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">Documents pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Claims by Status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Claims by Status</CardTitle>
            <CardDescription>Distribution of claims across statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.claimsByStatus.map((item) => (
                <div key={item.status} className="flex items-center">
                  <div className={`w-3 h-3 rounded-full ${statusColors[item.status] || "bg-gray-400"} mr-2`} />
                  <span className="flex-1">{item.status.replace("_", " ")}</span>
                  <Badge variant="secondary">{item.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Claims by Type</CardTitle>
            <CardDescription>Distribution by claim category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.claimsByType.slice(0, 6).map((item) => (
                <div key={item.type} className="flex items-center">
                  <span className="flex-1">{item.type}</span>
                  <Badge variant="secondary">{item.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Claims */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Claims</CardTitle>
          <CardDescription>Latest claims processed by the system</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim Number</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Insurance Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentClaims.map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell className="font-medium">{claim.claimNumber}</TableCell>
                  <TableCell>{claim.clientName || "-"}</TableCell>
                  <TableCell>{claim.insuranceCompany?.name || "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        claim.status === "COMPLETED"
                          ? "default"
                          : claim.status === "NEW"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {claim.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(claim.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>System audit trail</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-64 overflow-y-auto">
            {data.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                {activity.status === "SUCCESS" ? (
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                ) : activity.status === "WARNING" ? (
                  <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.action.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(activity.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
