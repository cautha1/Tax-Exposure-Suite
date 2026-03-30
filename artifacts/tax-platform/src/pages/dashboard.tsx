import React from 'react';
import { AppLayout } from '@/components/layout';
import { StatCard } from '@/components/stat-card';
import { useGetDashboardStats, useGetDashboardCharts } from '@workspace/api-client-react';
import { 
  Building2, Receipt, ShieldAlert, DollarSign, UploadCloud 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { motion } from 'framer-motion';

const COLORS = ['#3b5bdb', '#4dabf7', '#38d9a9', '#f06595', '#ff922b'];
const SEVERITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981'
};

export default function Dashboard() {
  const { data: stats, isLoading: isStatsLoading } = useGetDashboardStats();
  const { data: charts, isLoading: isChartsLoading } = useGetDashboardCharts();

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

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
          {/* Exposure Trend */}
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
                    <YAxis tickFormatter={(val) => `$${val/1000}k`} axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} />
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

          {/* Risk by Category */}
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
            {/* Custom Legend */}
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
      </div>
    </AppLayout>
  );
}
