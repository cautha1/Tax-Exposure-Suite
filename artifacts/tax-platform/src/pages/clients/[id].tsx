import React, { useState } from 'react';
import { useRoute } from 'wouter';
import { AppLayout } from '@/components/layout';
import { useGetCompany, useGetCompanySummary } from '@workspace/api-client-react';
import { Building2, MapPin, Hash, Briefcase, FileSpreadsheet, ShieldAlert, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export default function ClientDetail() {
  const [, params] = useRoute('/clients/:id');
  const id = params?.id || '';
  const [activeTab, setActiveTab] = useState('overview');

  const { data: company, isLoading } = useGetCompany(id);
  const { data: summary } = useGetCompanySummary(id);

  if (isLoading) {
    return <AppLayout><div className="p-8 text-center">Loading client profile...</div></AppLayout>;
  }

  if (!company) {
    return <AppLayout><div className="p-8 text-center text-destructive">Company not found</div></AppLayout>;
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <AppLayout>
      {/* Header Profile */}
      <div className="bg-card border-b border-border shadow-sm pt-8 px-6 md:px-8 pb-0">
        <div className="max-w-7xl mx-auto">
          <Link href="/clients" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Clients
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-lg shadow-primary/20 text-white text-3xl font-display font-bold">
                {company.companyName.charAt(0)}
              </div>
              <div>
                <h1 className="text-3xl font-display font-bold text-foreground">{company.companyName}</h1>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground font-medium">
                  <span className="flex items-center gap-1.5"><Hash className="w-4 h-4" /> {company.tinOrTaxId}</span>
                  <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {company.country}</span>
                  <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4" /> {company.industry}</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Link href={`/transactions/upload?companyId=${company.id}`} className="px-5 py-2.5 bg-background border-2 border-border text-foreground font-semibold rounded-xl shadow-sm hover:border-primary/50 transition-all flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" /> Import Data
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-8 border-b border-border overflow-x-auto hide-scrollbar">
            {['overview', 'transactions', 'risks', 'reports'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 px-1 text-sm font-semibold capitalize whitespace-nowrap transition-all border-b-2 ${
                  activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        {activeTab === 'overview' && summary && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-center items-center text-center">
                <p className="text-muted-foreground font-medium mb-2">Overall Risk Score</p>
                <div className={`text-5xl font-display font-bold mb-2 ${
                  summary.riskScore > 70 ? 'text-rose-600' : summary.riskScore > 30 ? 'text-amber-500' : 'text-emerald-500'
                }`}>
                  {summary.riskScore}
                  <span className="text-2xl text-muted-foreground">/100</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                   summary.riskScore > 70 ? 'bg-rose-100 text-rose-700' : summary.riskScore > 30 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                }`}>{summary.riskLevel}</span>
              </div>
              
              <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
                <p className="text-muted-foreground font-medium mb-1">Open Tax Flags</p>
                <div className="text-4xl font-display font-bold text-foreground mb-4">{summary.openRisks}</div>
                <div className="space-y-2">
                  {summary.severityBreakdown.map(s => (
                    <div key={s.severity} className="flex justify-between items-center text-sm">
                      <span className="capitalize text-muted-foreground">{s.severity}</span>
                      <span className="font-semibold">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
                <p className="text-muted-foreground font-medium mb-1">Estimated Exposure</p>
                <div className="text-4xl font-display font-bold text-rose-600">{formatCurrency(summary.estimatedExposure)}</div>
                <p className="text-sm text-muted-foreground mt-4">Based on {summary.totalTransactions.toLocaleString()} analyzed transactions in the current period.</p>
              </div>
            </div>
          </div>
        )}
        
        {activeTab !== 'overview' && (
          <div className="text-center p-12 bg-card rounded-2xl border border-border border-dashed">
            <h3 className="text-lg font-semibold text-foreground capitalize">{activeTab}</h3>
            <p className="text-muted-foreground mt-2">See dedicated pages for full table views.</p>
            <Link href={`/${activeTab}`} className="inline-block mt-4 text-primary font-medium hover:underline">
              Go to {activeTab}
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
