import React, { useState } from 'react';
import { AppLayout } from '@/components/layout';
import { StatCard } from '@/components/stat-card';
import { useGetDashboardStats, useGetDashboardCharts } from '@workspace/api-client-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { 
  Building2, Receipt, ShieldAlert, DollarSign 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { motion } from 'framer-motion';

const COLORS = ['#3b5bdb', '#4dabf7', '#38d9a9', '#f06595', '#ff922b'];

const LIKELIHOOD_LABELS = ['Low', 'Medium', 'High'];
const IMPACT_LABELS = ['Low', 'Medium', 'High'];

interface Risk {
  id: string;
  severity?: string | null;
  category?: string | null;
  estimatedExposure?: number | null;
  status?: string | null;
}

function RiskHeatmap({ risks }: { risks: Risk[] }) {
  const [hoveredCell, setHoveredCell] = useState<{ li: number; im: number; count: number } | null>(null);

  const categoryToLikelihood = (category: string | null | undefined): number => {
    switch (category) {
      case 'VAT': return 2;
      case 'Withholding Tax': return 2;
      case 'Revenue': return 1;
      case 'PAYE': return 2;
      case 'Expense': return 1;
      default: return 0;
    }
  };

  const severityToImpact = (severity: string | null | undefined): number => {
    if (severity === 'high') return 2;
    if (severity === 'medium') return 1;
    return 0;
  };

  const grid: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (const r of risks) {
    if (r.status === 'resolved') continue;
    const li = categoryToLikelihood(r.category);
    const im = severityToImpact(r.severity);
    grid[im][li]++;
  }

  const maxCount = Math.max(1, ...grid.flat());

  const cellColor = (count: number) => {
    if (count === 0) return { bg: '#f8fafc', border: '#e2e8f0', text: '#94a3b8' };
    const intensity = count / maxCount;
    if (intensity > 0.75) return { bg: '#fecdd3', border: '#fda4af', text: '#9f1239' };
    if (intensity > 0.4) return { bg: '#fee2e2', border: '#fca5a5', text: '#dc2626' };
    return { bg: '#fff1f2', border: '#fecdd3', text: '#e11d48' };
  };

  const riskZone = (li: number, im: number): string => {
    const score = li + im;
    if (score >= 4) return 'Critical';
    if (score >= 3) return 'High';
    if (score >= 2) return 'Medium';
    return 'Low';
  };

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-lg font-bold text-foreground">Risk Heatmap</h3>
        <p className="text-xs text-muted-foreground mt-1">Likelihood × Impact distribution by risk category and severity</p>
      </div>

      <div className="flex gap-6 items-start">
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '160px', display: 'flex', alignItems: 'center' }}>
            Impact →
          </div>
        </div>

        <div className="flex-1">
          <div className="grid gap-2" style={{ gridTemplateColumns: 'auto repeat(3, 1fr)' }}>
            <div />
            {LIKELIHOOD_LABELS.map(l => (
              <div key={l} className="text-center text-xs font-semibold text-muted-foreground pb-1">{l}</div>
            ))}

            {[2, 1, 0].map(im => (
              <React.Fragment key={im}>
                <div className="flex items-center justify-end pr-2 text-xs font-semibold text-muted-foreground">{IMPACT_LABELS[im]}</div>
                {[0, 1, 2].map(li => {
                  const count = grid[im][li];
                  const colors = cellColor(count);
                  const zone = riskZone(li, im);
                  const isHovered = hoveredCell?.li === li && hoveredCell?.im === im;

                  return (
                    <div
                      key={li}
                      className="relative rounded-xl flex flex-col items-center justify-center cursor-default transition-all duration-150"
                      style={{
                        height: '72px',
                        background: colors.bg,
                        border: `2px solid ${isHovered ? '#6366f1' : colors.border}`,
                        transform: isHovered ? 'scale(1.03)' : 'scale(1)',
                        boxShadow: isHovered ? '0 4px 12px rgba(99,102,241,0.2)' : 'none',
                      }}
                      onMouseEnter={() => setHoveredCell({ li, im, count })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <span className="text-2xl font-bold" style={{ color: colors.text }}>{count}</span>
                      <span className="text-[10px] font-medium" style={{ color: colors.text }}>{zone}</span>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          <div className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-3">
            Likelihood →
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-border">
        <div className="text-xs text-muted-foreground font-semibold">Legend:</div>
        {[
          { color: '#fff1f2', border: '#fecdd3', text: '#e11d48', label: 'Low density' },
          { color: '#fee2e2', border: '#fca5a5', text: '#dc2626', label: 'Medium density' },
          { color: '#fecdd3', border: '#fda4af', text: '#9f1239', label: 'High density' },
        ].map(({ color, border, text, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-4 h-4 rounded" style={{ background: color, border: `1.5px solid ${border}` }} />
            {label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-4 h-4 rounded" style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0' }} />
          No risks
        </div>
      </div>

      {hoveredCell && (
        <div className="mt-3 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-700 font-medium">
          {LIKELIHOOD_LABELS[hoveredCell.li]} likelihood × {IMPACT_LABELS[hoveredCell.im]} impact: <strong>{hoveredCell.count} risk{hoveredCell.count !== 1 ? 's' : ''}</strong>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: isStatsLoading } = useGetDashboardStats();
  const { data: charts, isLoading: isChartsLoading } = useGetDashboardCharts();

  const { data: allRisks } = useQuery<{ data: Risk[] }>({
    queryKey: ['risks-all-for-heatmap'],
    queryFn: () => api.get<{ data: Risk[] }>('/risks?limit=200'),
  });

  const formatCurrency = (val: number) =>
    `UGX ${new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(val)}`;

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform overview and aggregated risk intelligence.</p>
        </motion.div>

        {isStatsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
            {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted rounded-2xl" />)}
          </div>
        ) : stats ? (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            <StatCard 
              title="Total Clients" 
              value={stats.totalClients} 
              icon={Building2} 
              trend={{ value: 12, isPositive: true }}
            />
            <StatCard 
              title="Transactions Analyzed" 
              value={new Intl.NumberFormat('en-US').format(stats.totalTransactions)} 
              icon={Receipt} 
              trend={{ value: 45, isPositive: true }}
            />
            <StatCard 
              title="Open Tax Flags" 
              value={stats.openFlags} 
              icon={ShieldAlert} 
              description={`${stats.highRiskCompanies} clients with high risk`}
            />
            <StatCard 
              title="Est. Exposure" 
              value={formatCurrency(stats.estimatedExposure)} 
              icon={DollarSign} 
            />
          </motion.div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-foreground mb-6">Exposure Trend</h3>
            <div className="h-[300px] w-full">
              {isChartsLoading ? <div className="w-full h-full bg-muted/50 rounded animate-pulse" /> : charts && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.monthlyExposure} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorExposure" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} dy={10} />
                    <YAxis tickFormatter={(val) => `UGX ${(val/1000).toFixed(0)}k`} axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} />
                    <Tooltip 
                      formatter={(val: number) => formatCurrency(val)}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                    />
                    <Area type="monotone" dataKey="exposure" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorExposure)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-foreground mb-6">Flags by Category</h3>
            <div className="h-[300px] w-full flex items-center justify-center">
              {isChartsLoading ? <div className="w-full h-full bg-muted/50 rounded animate-pulse" /> : charts && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts.riskByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="category"
                    >
                      {charts.riskByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {charts && (
              <div className="flex flex-wrap justify-center gap-4 mt-2">
                {charts.riskByCategory.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                    {item.category}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <RiskHeatmap risks={allRisks?.data ?? []} />
        </motion.div>
      </div>
    </AppLayout>
  );
}
