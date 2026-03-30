import React, { useState } from 'react';
import { AppLayout } from '@/components/layout';
import { useListRisks, useResolveRisk } from '@workspace/api-client-react';
import { ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function Risks() {
  const [statusFilter, setStatusFilter] = useState('open');
  const { data, isLoading } = useListRisks({ status: statusFilter === 'all' ? undefined : statusFilter });
  const queryClient = useQueryClient();
  
  const resolveMutation = useResolveRisk({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/risks'] });
      }
    }
  });

  const formatCurrency = (val?: number | null) => 
    val != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : '-';

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground">Tax Flags</h1>
          <p className="text-muted-foreground mt-1">Review and resolve detected tax anomalies.</p>
        </div>

        <div className="flex gap-2 mb-6">
          {['open', 'resolved', 'all'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                statusFilter === status 
                  ? 'bg-foreground text-background shadow-md' 
                  : 'bg-card border border-border text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            [1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)
          ) : data?.data.length === 0 ? (
            <div className="p-16 text-center text-muted-foreground bg-card rounded-2xl border border-border border-dashed">
              <ShieldAlert className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg">No risk flags found.</p>
            </div>
          ) : (
            data?.data.map((risk) => (
              <div key={risk.id} className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 flex flex-col md:flex-row gap-6 md:items-center hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  risk.severity === 'high' ? 'bg-rose-100 text-rose-600' : 
                  risk.severity === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  <AlertCircle className="w-6 h-6" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-lg">{risk.description}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                      risk.severity === 'high' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 
                      risk.severity === 'medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
                      'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {risk.severity} Severity
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{risk.companyName}</span>
                    <span>Rule: <span className="font-mono text-xs">{risk.ruleCode}</span></span>
                    <span>Category: {risk.category}</span>
                  </div>
                </div>
                
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-4 md:gap-2 shrink-0 md:w-48 md:border-l md:border-border md:pl-6">
                  <div className="text-left md:text-right">
                    <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Est. Exposure</p>
                    <p className="text-lg font-bold text-foreground">{formatCurrency(risk.estimatedExposure)}</p>
                  </div>
                  
                  {risk.status !== 'resolved' ? (
                    <button 
                      onClick={() => resolveMutation.mutate({ id: risk.id })}
                      disabled={resolveMutation.isPending}
                      className="px-4 py-2 bg-background border-2 border-border rounded-lg text-sm font-semibold hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Resolve
                    </button>
                  ) : (
                    <span className="px-3 py-1 bg-muted rounded-full text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Resolved
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
