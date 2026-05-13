import React from "react";
import { AppLayout } from "@/components/layout";
import { StatCard } from "@/components/stat-card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ShieldAlert, DollarSign, Users, AlertTriangle, ClipboardCheck, Clock3, Loader2 } from "lucide-react";
import RiskHeatmap from "@/components/dashboard/RiskHeatMap";
import { Link } from "wouter";

interface DashboardStats {
  totalClients: number;
  totalTransactions: number;
  openFlags: number;
  estimatedExposure: number;
  highRiskCompanies: number;
  recentUploads: number;
}

interface Risk {
  id: string;
  severity?: string | null;
  category?: string | null;
  estimatedExposure?: number | null;
  status?: string | null;
  clientName?: string;
}

interface AdvisorDashboard {
  workflowCounts: { open: number; reviewed: number; resolved: number };
  recentActivity: { id: string; action: string; entityType: string; companyName?: string | null; createdAt: string }[];
  reviewBacklog: { id: string; companyName?: string | null; description?: string | null; severity?: string | null }[];
}

interface Company {
  id: string;
  companyName: string;
  status?: string | null;
  riskLevel?: string | null;
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get("/dashboard/stats"),
  });

  const { data: allRisks } = useQuery<{ data: Risk[] }>({
    queryKey: ["risks-all"],
    queryFn: () => api.get("/risks?limit=200"),
  });

  const { data: advisor } = useQuery<AdvisorDashboard>({
    queryKey: ["dashboard-advisor"],
    queryFn: () => api.get("/dashboard/advisor"),
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: () => api.get("/companies"),
  });

  const runScanMutation = useMutation({
    mutationFn: async () => {
      const activeCompanies = (companies ?? []).filter(
        (company) => company.status !== "suspended" && company.riskLevel !== "suspended",
      );
      if (activeCompanies.length === 0) {
        throw new Error("No active clients available for scanning");
      }

      return Promise.all(
        activeCompanies.map((company) =>
          api.post("/analysis/run", { companyId: company.id, clearExisting: true }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-advisor"] });
      queryClient.invalidateQueries({ queryKey: ["risks-all"] });
      queryClient.invalidateQueries({ queryKey: ["risks"] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });

  const risks = allRisks?.data || [];

  const highRisk = risks.filter(
    (r) => r.severity === "high" && r.status !== "resolved",
  );

  const formatCurrency = (val: number) =>
    `UGX ${new Intl.NumberFormat("en-UG").format(val)}`;

  const complianceScore = stats ? Math.max(0, 100 - stats.openFlags * 2) : 0;

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Compliance Overview</h1>
            <p className="text-sm text-muted-foreground">
              Monitor tax exposure and detect risks before audits occur
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/reports">Export Report</Link>
            </Button>
            <Button
              onClick={() => runScanMutation.mutate()}
              disabled={runScanMutation.isPending || !companies || companies.length === 0}
            >
              {runScanMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Run Risk Scan
            </Button>
          </div>
        </div>

        {runScanMutation.isError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {runScanMutation.error instanceof Error ? runScanMutation.error.message : "Risk scan failed"}
          </div>
        )}

        {runScanMutation.isSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Risk scan completed.
          </div>
        )}

        {highRisk.length > 0 && (
          <div className="border border-red-200 bg-red-50 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-red-700">High Audit Risk Detected</p>
              <p className="text-xs text-red-600">
                {highRisk.length} high-severity issues require immediate attention
              </p>
            </div>
            <Button variant="destructive" asChild>
              <Link href="/risks">Review Risks</Link>
            </Button>
          </div>
        )}

        {!isLoading && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              title="Compliance Score"
              value={`${complianceScore}%`}
              icon={ShieldAlert}
              description="Overall tax compliance health"
            />
            <StatCard
              title="Total Exposure"
              value={formatCurrency(stats.estimatedExposure)}
              icon={DollarSign}
            />
            <StatCard
              title="Unresolved Risks"
              value={stats.openFlags}
              icon={AlertTriangle}
            />
            <StatCard
              title="Active Clients"
              value={stats.totalClients}
              icon={Users}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-semibold mb-1">Risk Distribution Matrix</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Identifies concentration of audit risk by likelihood and impact
            </p>
            <RiskHeatmap risks={risks} />
          </div>

          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Requires Immediate Attention</h3>
            <div className="space-y-3">
              {highRisk.slice(0, 5).map((risk) => (
                <div key={risk.id} className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">{risk.clientName || "Client"}</p>
                    <p className="text-xs text-muted-foreground">
                      {risk.category} • {formatCurrency(risk.estimatedExposure || 0)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/risks">Review</Link>
                  </Button>
                </div>
              ))}
              {highRisk.length === 0 && (
                <p className="text-sm text-muted-foreground">No high-risk issues detected.</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-semibold mb-1">Exposure Trend</h3>
            <p className="text-xs text-muted-foreground mb-4">Monthly tax exposure based on detected anomalies</p>
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Upload transactions to see exposure trend
            </div>
          </div>
          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-semibold mb-1">Risk by Tax Type</h3>
            <p className="text-xs text-muted-foreground mb-4">Distribution of risks across tax categories</p>
            <div className="space-y-2">
              {["VAT", "Withholding Tax", "PAYE", "Expense", "Revenue"].map(cat => {
                const count = risks.filter(r => r.category === cat).length;
                const pct = risks.length > 0 ? Math.round((count / risks.length) * 100) : 0;
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-28 shrink-0">{cat}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full">
                      <div className="h-2 bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Advisory Workflow</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Open", advisor?.workflowCounts?.open ?? stats?.openFlags ?? 0, "text-rose-700 bg-rose-50 border-rose-100"],
                ["Reviewed", advisor?.workflowCounts?.reviewed ?? 0, "text-amber-700 bg-amber-50 border-amber-100"],
                ["Resolved", advisor?.workflowCounts?.resolved ?? 0, "text-emerald-700 bg-emerald-50 border-emerald-100"],
              ].map(([label, value, cls]) => (
                <div key={label} className={`rounded-lg border p-3 ${cls}`}>
                  <p className="text-xs font-semibold uppercase tracking-wider">{label}</p>
                  <p className="text-2xl font-bold mt-1">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {(advisor?.reviewBacklog ?? []).slice(0, 4).map(item => (
                <div key={item.id} className="flex items-start gap-2 text-sm">
                  <ClipboardCheck className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">{item.companyName ?? "Client"}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                  </div>
                </div>
              ))}
              {(advisor?.reviewBacklog ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No reviewed items waiting for closure.</p>
              )}
            </div>
          </div>

          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Recent Advisory Activity</h3>
            <div className="space-y-3">
              {(advisor?.recentActivity ?? []).slice(0, 6).map(item => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Clock3 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium capitalize">{item.action.replaceAll(".", " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.companyName ?? item.entityType} | {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {(advisor?.recentActivity ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No recent activity captured yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
