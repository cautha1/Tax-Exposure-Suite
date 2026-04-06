import React, { useState, useEffect } from 'react';
import { useRoute, Link } from 'wouter';
import { AppLayout } from '@/components/layout';
import { useGetReport, useGetCompany } from '@workspace/api-client-react';
import { api } from '@/lib/api';
import {
  ArrowLeft, Building2, FileText, AlertTriangle, CheckCircle2, TrendingUp,
  ShieldAlert, ChevronRight, Hash, MapPin, Calendar, Loader2
} from 'lucide-react';

const RISK_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'VAT':             { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  'Withholding Tax': { bg: 'bg-sky-50',    text: 'text-sky-700',    border: 'border-sky-200' },
  'PAYE':            { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200' },
  'Expense':         { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  'Revenue':         { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
};

const SEV_COLORS: Record<string, { bar: string; badge: string }> = {
  high:   { bar: 'bg-rose-500',   badge: 'bg-rose-50 text-rose-700 border border-rose-200' },
  medium: { bar: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
  low:    { bar: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700 border border-blue-200' },
};

const RECOMMENDATIONS: Record<string, string> = {
  'VAT':             'Review VAT classification on all taxable transactions — Uganda standard rate is 18%. Ensure all VAT-registered suppliers provide valid tax invoices.',
  'Withholding Tax': 'Ensure WHT is deducted at the statutory rate of 15% on all payments to non-employees for services, dividends, interest, and rent. File monthly WHT returns with URA.',
  'PAYE':            'Confirm PAYE is computed on all payroll payments using the Uganda PAYE tax bands (top marginal rate 30%). Submit monthly PAYE returns by the 15th of each month.',
  'Expense':         'Review flagged expenses for deductibility under the Uganda Income Tax Act. Entertainment, gifts, fines, and personal expenses are typically non-deductible.',
  'Revenue':         'Verify all revenue streams are correctly classified for tax purposes. Large unclassified revenue may attract VAT and income tax obligations.',
};

interface Risk {
  id: string;
  riskType: string | null;
  ruleCode: string | null;
  description: string | null;
  severity: string | null;
  estimatedExposure: number | null;
  category: string | null;
  status: string | null;
}

export default function ReportDetail() {
  const [, params] = useRoute('/reports/:id');
  const id = params?.id ?? '';

  const { data: report, isLoading: reportLoading } = useGetReport(id);
  const { data: company, isLoading: companyLoading } = useGetCompany(report?.companyId ?? '', {
    query: { enabled: !!report?.companyId },
  });

  const [risks, setRisks] = useState<Risk[]>([]);
  const [risksLoading, setRisksLoading] = useState(false);

  useEffect(() => {
    if (!report?.companyId) return;
    setRisksLoading(true);
    api.get<{ data: Risk[]; total: number }>(`/risks?companyId=${report.companyId}&limit=200`)
      .then(d => setRisks(d.data ?? []))
      .catch(() => setRisks([]))
      .finally(() => setRisksLoading(false));
  }, [report?.companyId]);

  const isLoading = reportLoading || companyLoading || risksLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!report) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Report not found.</div>
      </AppLayout>
    );
  }

  const formatCurrency = (v?: number | null) =>
    v != null ? `UGX ${new Intl.NumberFormat('en-UG').format(v)}` : '-';

  const openRisks = risks.filter(r => r.status === 'open');
  const highRisks = openRisks.filter(r => r.severity === 'high');
  const medRisks = openRisks.filter(r => r.severity === 'medium');
  const lowRisks = openRisks.filter(r => r.severity === 'low');
  const totalSev = openRisks.length || 1;

  const catMap: Record<string, { count: number; exposure: number }> = {};
  for (const r of risks) {
    const cat = r.category ?? 'Other';
    if (!catMap[cat]) catMap[cat] = { count: 0, exposure: 0 };
    catMap[cat].count++;
    catMap[cat].exposure += r.estimatedExposure ?? 0;
  }

  const topFindings = openRisks
    .sort((a, b) => (b.estimatedExposure ?? 0) - (a.estimatedExposure ?? 0))
    .slice(0, 5);

  const presentCategories = Object.keys(catMap);
  const recommendations = presentCategories.map(cat => RECOMMENDATIONS[cat]).filter(Boolean);
  const genericRecs = [
    'Ensure all tax returns (VAT, WHT, PAYE, Corporate Tax) are filed on time with Uganda Revenue Authority (URA).',
    'Maintain proper documentation for all transactions — tax invoices, contracts, and payment records.',
    'Consider a full pre-audit health check before the next URA audit cycle.',
  ];

  const riskScore = report.totalExposure != null
    ? Math.min(100, Math.round(((report.highRisks ?? 0) * 10 + (report.mediumRisks ?? 0) * 5 + (report.lowRisks ?? 0)) / Math.max(1, (report.highRisks ?? 0) + (report.mediumRisks ?? 0) + (report.lowRisks ?? 0)) * 10))
    : 0;

  const riskLevel = (report.highRisks ?? 0) > 3 ? 'high' : (report.mediumRisks ?? 0) > 5 ? 'medium' : 'low';
  const riskLevelColors = { high: 'text-rose-600 bg-rose-50 border-rose-200', medium: 'text-amber-600 bg-amber-50 border-amber-200', low: 'text-emerald-600 bg-emerald-50 border-emerald-200' };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 md:px-8 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/reports" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Reports
          </Link>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground truncate">{report.title}</span>
        </div>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tax Health Check Report</p>
              <h1 className="text-2xl font-display font-bold text-foreground">{report.title}</h1>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-bold border capitalize ${riskLevelColors[riskLevel]}`}>
            {riskLevel} Risk
          </span>
        </div>

        <p className="text-xs text-muted-foreground mb-8">
          Generated {report.createdAt ? new Date(report.createdAt).toLocaleDateString('en-UG', { dateStyle: 'long' }) : '-'} · Uganda Revenue Authority (URA) Jurisdiction · VAT 18% · WHT 15% · PAYE 30%
        </p>

        <div className="space-y-6">
          {/* Section 1 — Company Overview */}
          <section className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">1</span>
              Company Overview
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> Company</p>
                <p className="text-sm font-semibold text-foreground">{report.companyName ?? company?.companyName ?? '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1"><Hash className="w-3 h-3" /> Tax ID (TIN)</p>
                <p className="text-sm font-semibold text-foreground">{company?.tinOrTaxId ?? '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Country</p>
                <p className="text-sm font-semibold text-foreground">{company?.country ?? 'Uganda'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Financial Year</p>
                <p className="text-sm font-semibold text-foreground">{company?.financialYear ?? '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Period</p>
                <p className="text-sm font-semibold text-foreground">
                  {(report as any).periodStart && (report as any).periodEnd
                    ? `${new Date((report as any).periodStart).toLocaleDateString('en-UG', { month: 'short', year: 'numeric' })} – ${new Date((report as any).periodEnd).toLocaleDateString('en-UG', { month: 'short', year: 'numeric' })}`
                    : report.createdAt ? String(new Date(report.createdAt).getFullYear()) : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Jurisdiction</p>
                <p className="text-sm font-semibold text-foreground">Uganda (URA)</p>
              </div>
            </div>
          </section>

          {/* Section 2 — Executive Summary */}
          <section className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">2</span>
              Executive Summary
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-muted/40 rounded-xl p-4">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Transactions</p>
                <p className="text-3xl font-bold text-foreground">{(report as any).transactionCount ?? '–'}</p>
                <p className="text-xs text-muted-foreground">analysed</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-4">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Total Flags</p>
                <p className="text-3xl font-bold text-foreground">{risks.length}</p>
                <p className="text-xs text-muted-foreground">{openRisks.length} open</p>
              </div>
              <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
                <p className="text-xs text-rose-500 font-semibold uppercase tracking-wider mb-1">Est. Exposure</p>
                <p className="text-xl font-bold text-rose-700">{formatCurrency(report.totalExposure)}</p>
                <p className="text-xs text-rose-400">Indicative only</p>
              </div>
              <div className={`rounded-xl p-4 border ${riskLevelColors[riskLevel]}`}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-70">Risk Score</p>
                <p className="text-3xl font-bold">{riskScore}</p>
                <p className="text-xs opacity-70 capitalize">{riskLevel} risk level</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-4">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">High Risks</p>
                <p className="text-3xl font-bold text-rose-600">{report.highRisks ?? 0}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-4">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Medium / Low</p>
                <p className="text-2xl font-bold text-amber-600">{report.mediumRisks ?? 0} <span className="text-muted-foreground text-xl">/ {report.lowRisks ?? 0}</span></p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <strong>Disclaimer:</strong> These are risk indicators for advisor review only. They do not constitute final legal tax advice. Estimated exposures are approximate and should be validated by a qualified tax professional.
            </p>
          </section>

          {/* Section 3 — Risk Breakdown */}
          <section className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">3</span>
              Risk Breakdown by Category
            </h2>
            {Object.keys(catMap).length === 0 ? (
              <p className="text-sm text-muted-foreground">No risk flags found for this company.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {['VAT', 'Withholding Tax', 'PAYE', 'Expense', 'Revenue'].map(cat => {
                  const data = catMap[cat];
                  if (!data) return null;
                  const cols = RISK_TYPE_COLORS[cat] ?? { bg: 'bg-muted', text: 'text-foreground', border: 'border-border' };
                  return (
                    <div key={cat} className={`rounded-xl p-4 border ${cols.bg} ${cols.border}`}>
                      <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${cols.text}`}>{cat}</p>
                      <p className={`text-2xl font-bold ${cols.text}`}>{data.count}</p>
                      <p className="text-xs font-medium text-muted-foreground mt-1">flags</p>
                      <p className={`text-sm font-semibold mt-2 ${cols.text}`}>{formatCurrency(data.exposure)}</p>
                      <p className="text-xs text-muted-foreground">estimated exposure</p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 4 — Severity Analysis */}
          <section className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">4</span>
              Severity Analysis
            </h2>
            <div className="space-y-4">
              {[
                { label: 'High', count: highRisks.length, key: 'high' },
                { label: 'Medium', count: medRisks.length, key: 'medium' },
                { label: 'Low', count: lowRisks.length, key: 'low' },
              ].map(({ label, count, key }) => {
                const pct = Math.round((count / totalSev) * 100);
                const cols = SEV_COLORS[key];
                return (
                  <div key={key}>
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${cols.badge}`}>{label}</span>
                        <span className="text-sm text-muted-foreground">{count} flag{count !== 1 ? 's' : ''}</span>
                      </div>
                      <span className="text-sm font-bold text-foreground">{pct}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div className={`${cols.bar} h-2.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 5 — Key Findings */}
          <section className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">5</span>
              Key Findings
            </h2>
            {topFindings.length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">No open high-priority risks. Company appears compliant.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {topFindings.map((risk, i) => {
                  const cols = SEV_COLORS[risk.severity ?? 'low'];
                  const typeColor = RISK_TYPE_COLORS[risk.riskType ?? ''] ?? { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' };
                  return (
                    <div key={risk.id} className="flex gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {risk.riskType && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${typeColor.bg} ${typeColor.text}`}>{risk.riskType}</span>
                          )}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${cols.badge}`}>{risk.severity}</span>
                          {risk.ruleCode && <span className="font-mono text-[10px] text-muted-foreground">{risk.ruleCode}</span>}
                        </div>
                        <p className="text-sm text-foreground leading-snug">{risk.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">Exposure</p>
                        <p className="text-sm font-bold text-foreground">{formatCurrency(risk.estimatedExposure)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 6 — Recommendations */}
          <section className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">6</span>
              Recommendations
            </h2>
            <div className="space-y-3">
              {[...recommendations, ...genericRecs].map((rec, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <TrendingUp className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-foreground">{rec}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="text-center pt-4 pb-8">
            <p className="text-xs text-muted-foreground">
              This report was generated by TaxIntel and is for internal advisory purposes only. All risk indicators are indicative.
              <br />© {new Date().getFullYear()} TaxIntel — Uganda Tax Exposure Intelligence Platform
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
