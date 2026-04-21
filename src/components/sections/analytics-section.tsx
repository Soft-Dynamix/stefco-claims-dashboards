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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Building2,
} from "lucide-react";

interface AnalyticsData {
  dailyStats: Array<{
    date: string;
    emailsReceived: number;
    claimsCreated: number;
    avgConfidenceScore: number;
  }>;
  claimsByInsurance: Array<{
    name: string;
    count: number;
  }>;
  avgProcessingTime: string;
  feedbackStats: Array<{
    type: string;
    count: number;
  }>;
}

export function AnalyticsSection() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30");

  useEffect(() => {
    fetchAnalytics();
  }, [range]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?range=${range}`);
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
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
        <p className="text-muted-foreground">Failed to load analytics</p>
      </div>
    );
  }

  // Calculate totals from daily stats
  const totalEmails = data.dailyStats.reduce((sum, d) => sum + d.emailsReceived, 0);
  const totalClaims = data.dailyStats.reduce((sum, d) => sum + d.claimsCreated, 0);
  const avgConfidence = data.dailyStats.reduce((sum, d) => sum + (d.avgConfidenceScore || 0), 0) / (data.dailyStats.length || 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            System performance and metrics
          </p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmails}</div>
            <p className="text-xs text-muted-foreground">Processed in period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Claims Created</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClaims}</div>
            <p className="text-xs text-muted-foreground">From email processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.avgProcessingTime}</div>
            <p className="text-xs text-muted-foreground">Days per claim</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg AI Confidence</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgConfidence.toFixed(1)}%</div>
            <Progress value={avgConfidence} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="insurance">By Insurance</TabsTrigger>
          <TabsTrigger value="accuracy">Accuracy</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {/* Daily Activity Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Activity</CardTitle>
              <CardDescription>
                Emails received and claims created over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-end gap-2">
                {data.dailyStats.slice(-14).map((day, i) => (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-full bg-primary/20 rounded-t"
                      style={{
                        height: `${Math.max(10, (day.emailsReceived / Math.max(...data.dailyStats.map(d => d.emailsReceived), 1)) * 200)}px`,
                      }}
                    />
                    <div
                      className="w-full bg-green-500/50 rounded-t"
                      style={{
                        height: `${Math.max(5, (day.claimsCreated / Math.max(...data.dailyStats.map(d => d.claimsCreated), 1)) * 100)}px`,
                      }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {new Date(day.date).getDate()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-primary/20 rounded" />
                  <span>Emails Received</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500/50 rounded" />
                  <span>Claims Created</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insurance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Claims by Insurance Company</CardTitle>
              <CardDescription>
                Distribution of claims across insurance providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.claimsByInsurance.map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{item.name}</span>
                    <div className="w-32">
                      <Progress
                        value={(item.count / Math.max(...data.claimsByInsurance.map(c => c.count), 1)) * 100}
                      />
                    </div>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accuracy" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Accuracy Metrics</CardTitle>
              <CardDescription>
                Feedback-based accuracy tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {data.feedbackStats.map((stat, i) => (
                  <Card key={i}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        {stat.type === "confirmed" ? (
                          <CheckCircle className="h-8 w-8 text-green-500" />
                        ) : stat.type === "corrected" ? (
                          <XCircle className="h-8 w-8 text-yellow-500" />
                        ) : (
                          <XCircle className="h-8 w-8 text-red-500" />
                        )}
                        <div>
                          <p className="text-2xl font-bold">{stat.count}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {stat.type}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="mt-6">
                <h3 className="font-semibold mb-2">Accuracy Rate</h3>
                <div className="flex items-center gap-4">
                  <Progress
                    value={
                      data.feedbackStats.length > 0
                        ? (data.feedbackStats.find(f => f.type === "confirmed")?.count || 0) /
                          data.feedbackStats.reduce((sum, f) => sum + f.count, 0) *
                          100
                        : 0
                    }
                    className="flex-1"
                  />
                  <span className="font-medium">
                    {data.feedbackStats.length > 0
                      ? (
                          ((data.feedbackStats.find(f => f.type === "confirmed")?.count || 0) /
                            data.feedbackStats.reduce((sum, f) => sum + f.count, 0)) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
