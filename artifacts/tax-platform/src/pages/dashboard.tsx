import React from "react";
import { AppLayout } from "@/components/layout";
import { StatCard } from "@/components/stat-card";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ShieldAlert, DollarSign, Users, AlertTriangle } from "lucide-react";
import RiskHeatmap from "@/components/dashboard/RiskHeatMap";

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

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get("/dashboard/stats"),
  });

  const { data: allRisks } = useQuery<{ data: Risk[] }>({
    queryKey: ["risks-all"],
    queryFn: () => api.get("/risks?limit=200"),
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
            <Button variant="outline">Export Report</Button>
            <Button>Run Risk Scan</Button>
          </div>
        </div>

        {highRisk.length > 0 && (
          <div className="border border-red-200 bg-red-50 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-red-700">High Audit Risk Detected</p>
              <p className="text-xs text-red-600">
                {highRisk.length} high-severity issues require immediate attention
              </p>
            </div>
            <Button variant="destructive">Review Risks</Button>
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
                  <Button size="sm" variant="outline">Review</Button>
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
      </div>
    </AppLayout>
  );
}
