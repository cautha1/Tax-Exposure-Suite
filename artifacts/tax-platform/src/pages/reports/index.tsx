import React, { useState } from 'react';
import { AppLayout } from '@/components/layout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FileText, Plus, ExternalLink, Loader2, TrendingUp } from 'lucide-react';
import { Link } from 'wouter';

interface Company {
  id: string;
  companyName: string;
}

interface Report {
  id: string;
  companyId: string;
  companyName: string | null;
  title: string | null;
  status: string | null;
  totalExposure: number | null;
  highRisks: number | null;
  mediumRisks: number | null;
  lowRisks: number | null;
  createdAt: string;
}

export default function Reports() {
  const { data: reports, isLoading } = useQuery<Report[]>({
    queryKey: ['reports'],
    queryFn: () => api.get<Report[]>('/reports'),
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: () => api.get<Company[]>('/companies'),
  });

  const [selectedCompany, setSelectedCompany] = useState('');
  const [justGenerated, setJustGenerated] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const generateMutation = useMutation({
    mutationFn: (payload: { companyId: string; title: string }) =>
      api.post<Report>('/reports', payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setJustGenerated(data.id);
      setSelectedCompany('');
    },
  });

  const handleGenerate = () => {
    if (!selectedCompany) return;
    const company = companies?.find(c => c.id === selectedCompany);
    generateMutation.mutate({
      companyId: selectedCompany,
      title: `Tax Health Check — ${company?.companyName ?? 'Client'} ${new Date().getFullYear()}`,
    });
  };

  const formatCurrency = (val?: number | null) =>
    val != null ? `UGX ${new Intl.NumberFormat('en-UG').format(val)}` : '-';

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Advisory Reports</h1>
            <p className="text-muted-foreground mt-1">Generate and view Uganda Tax Health Check reports for your clients.</p>
          </div>

          <div className="flex items-center gap-2 bg-card p-1.5 rounded-xl border border-border shadow-sm">
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer pl-3 py-1.5 outline-none pr-2"
            >
              <option value="">Select client...</option>
              {companies?.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
            <button
              onClick={handleGenerate}
              disabled={!selectedCompany || generateMutation.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg shadow-sm hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Generate Report
            </button>
          </div>
        </div>

        {justGenerated && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-800">Report generated successfully</p>
              <p className="text-xs text-emerald-600">Your Tax Health Check report is ready to view.</p>
            </div>
            <Link
              href={`/reports/${justGenerated}`}
              className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View Report
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            [1, 2, 3].map(i => <div key={i} className="h-64 bg-muted rounded-2xl animate-pulse" />)
          ) : reports?.length === 0 ? (
            <div className="col-span-full p-16 text-center text-muted-foreground bg-card rounded-2xl border border-border border-dashed">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg">No reports generated yet.</p>
              <p className="text-sm mt-1">Select a client above and click Generate Report to get started.</p>
            </div>
          ) : (
            reports?.map((report) => {
              const isNew = report.id === justGenerated;
              return (
                <div
                  key={report.id}
                  className={`bg-card rounded-2xl border shadow-sm p-6 hover:shadow-md transition-shadow flex flex-col ${isNew ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-border/60'}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                      <FileText className="w-6 h-6" />
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                      report.status === 'ready' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-muted text-muted-foreground'
                    }`}>
                      {report.status}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-foreground mb-1 line-clamp-2">{report.title}</h3>
                  <p className="text-sm text-muted-foreground font-medium mb-1">{report.companyName}</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    {report.createdAt ? new Date(report.createdAt).toLocaleDateString('en-UG', { dateStyle: 'medium' }) : ''}
                  </p>

                  <div className="mt-auto grid grid-cols-3 gap-2 bg-muted/30 p-3 rounded-xl mb-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">High</p>
                      <p className="font-bold text-rose-600">{report.highRisks ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Medium</p>
                      <p className="font-bold text-amber-600">{report.mediumRisks ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Exposure</p>
                      <p className="font-bold text-foreground text-xs">{formatCurrency(report.totalExposure)}</p>
                    </div>
                  </div>

                  <Link
                    href={`/reports/${report.id}`}
                    className="w-full py-2.5 bg-primary/10 text-primary font-semibold rounded-lg hover:bg-primary hover:text-white transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" /> View Full Report
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
