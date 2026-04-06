import React, { useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ShieldAlert, CheckCircle2, AlertCircle, Eye, Search, ChevronDown, ChevronUp, X, Lightbulb, StickyNote, Loader2 } from 'lucide-react';

const STATUS_TABS = [
  { key: 'open',     label: 'Open' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all',      label: 'All' },
];

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  high:   { bg: 'bg-rose-50',  text: 'text-rose-600',  border: 'border-rose-100',  badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  low:    { bg: 'bg-blue-50',  text: 'text-blue-600',  border: 'border-blue-100',  badge: 'bg-blue-50 text-blue-700 border-blue-200' },
};

const RISK_TYPE_COLORS: Record<string, string> = {
  'VAT':             'bg-violet-100 text-violet-700',
  'Withholding Tax': 'bg-sky-100 text-sky-700',
  'PAYE':            'bg-teal-100 text-teal-700',
  'Expense':         'bg-orange-100 text-orange-700',
  'Revenue':         'bg-green-100 text-green-700',
};

const STATUS_INFO: Record<string, { label: string; cls: string }> = {
  open:     { label: 'Open',     cls: 'bg-rose-50 text-rose-700 border border-rose-200' },
  reviewed: { label: 'Reviewed', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  resolved: { label: 'Resolved', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

interface Risk {
  id: string; companyId: string; companyName?: string | null;
  ruleCode?: string | null; riskType?: string | null;
  description?: string | null; severity?: string | null;
  estimatedExposure?: number | null; status?: string | null;
  category?: string | null; reviewedAt?: string | null;
  reviewedBy?: string | null; reviewNotes?: string | null;
  riskScore?: number | null; internalNote?: string | null;
  resolvedBy?: string | null; resolvedAt?: string | null;
}

interface ExplainResult {
  summary: string;
  whyRisk: string;
  exposure: string;
  recommendation: string;
}

function RiskCard({ risk, onAction }: { risk: Risk; onAction: (id: string, action: 'review' | 'resolve') => Promise<void> }) {
  const [isActioning, setIsActioning] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [explanation, setExplanation] = useState<ExplainResult | null>(null);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState(risk.internalNote ?? '');
  const [savingNote, setSavingNote] = useState(false);
  const [savedNote, setSavedNote] = useState(risk.internalNote ?? '');

  const queryClient = useQueryClient();

  const sev = SEVERITY_COLORS[risk.severity ?? 'low'] ?? SEVERITY_COLORS.low;
  const statusInfo = STATUS_INFO[risk.status ?? 'open'] ?? STATUS_INFO.open;
  const riskTypeColor = RISK_TYPE_COLORS[risk.riskType ?? ''] ?? 'bg-muted text-muted-foreground';

  const formatCurrency = (val?: number | null) =>
    val != null ? `UGX ${new Intl.NumberFormat('en-UG').format(val)}` : '-';

  const handleAction = async (action: 'review' | 'resolve') => {
    setIsActioning(true);
    try {
      await onAction(risk.id, action);
    } finally {
      setIsActioning(false);
    }
  };

  const handleExplain = async () => {
    if (showExplain) { setShowExplain(false); return; }
    setShowExplain(true);
    if (explanation) return;
    setLoadingExplain(true);
    try {
      const result = await api.post<ExplainResult>('/ai/explain-risk', { riskId: risk.id });
      setExplanation(result);
    } catch {
      setExplanation({
        summary: 'Unable to load explanation at this time.',
        whyRisk: '-', exposure: '-', recommendation: '-',
      });
    } finally {
      setLoadingExplain(false);
    }
  };

  const handleSaveNote = async () => {
    setSavingNote(true);
    try {
      await api.patch(`/risks/${risk.id}/note`, { note: noteText });
      setSavedNote(noteText);
      queryClient.invalidateQueries({ queryKey: ['risks'] });
    } finally {
      setSavingNote(false);
      setShowNote(false);
    }
  };

  return (
    <div className={`bg-card rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${sev.border}`}>
      <div className="p-5">
        <div className="flex flex-col md:flex-row gap-4 md:items-start">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${sev.bg} ${sev.text} border ${sev.border}`}>
            <AlertCircle className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {risk.riskType && (
                <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${riskTypeColor}`}>
                  {risk.riskType}
                </span>
              )}
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${sev.badge}`}>
                {risk.severity}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
              {risk.ruleCode && (
                <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs">
                  {risk.ruleCode}
                </span>
              )}
              {risk.riskScore != null && (
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">
                  Score: {risk.riskScore}
                </span>
              )}
            </div>

            <p className="text-sm font-medium text-foreground leading-snug mb-2">{risk.description}</p>

            {savedNote && (
              <div className="mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-1.5">
                <StickyNote className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                <span className="italic">"{savedNote}"</span>
              </div>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {risk.companyName && <span className="font-semibold text-foreground">{risk.companyName}</span>}
              {risk.category && <span>Category: {risk.category}</span>}
              {risk.reviewedAt && (
                <span>
                  {risk.status === 'reviewed' ? 'Reviewed' : 'Actioned'}: {new Date(risk.reviewedAt).toLocaleDateString()}
                </span>
              )}
              {risk.resolvedAt && (
                <span>Resolved: {new Date(risk.resolvedAt).toLocaleDateString()}</span>
              )}
              {risk.reviewedBy && (
                <span className="flex items-center gap-1">
                  By: <span className="font-medium text-foreground">{risk.reviewedBy}</span>
                </span>
              )}
              {risk.reviewNotes && <span className="italic">"{risk.reviewNotes}"</span>}
            </div>

            <div className="flex gap-2 mt-3 flex-wrap">
              <button
                onClick={handleExplain}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                  showExplain
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                {showExplain ? 'Hide Explanation' : 'Explain Risk'}
              </button>
              <button
                onClick={() => setShowNote(v => !v)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all"
              >
                <StickyNote className="w-3.5 h-3.5" />
                {showNote ? 'Cancel' : savedNote ? 'Edit Note' : 'Add Note'}
              </button>
            </div>
          </div>

          <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 shrink-0 md:w-44 md:border-l md:border-border md:pl-5">
            <div className="md:text-right">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Est. Exposure</p>
              <p className="text-base font-bold text-foreground">{formatCurrency(risk.estimatedExposure)}</p>
            </div>

            {(risk.status === 'open' || risk.status === 'reviewed') && (
              <div className="flex flex-col gap-2 w-full">
                {risk.status === 'open' && (
                  <button
                    onClick={() => handleAction('review')}
                    disabled={isActioning}
                    className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-all flex items-center gap-1.5 disabled:opacity-50 justify-center w-full"
                  >
                    <Eye className="w-3.5 h-3.5" /> Mark Reviewed
                  </button>
                )}
                <button
                  onClick={() => handleAction('resolve')}
                  disabled={isActioning}
                  className="px-3 py-1.5 bg-background border-2 border-border text-foreground rounded-lg text-xs font-semibold hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-all flex items-center gap-1.5 disabled:opacity-50 justify-center w-full"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                </button>
              </div>
            )}

            {risk.status === 'resolved' && (
              <span className="px-3 py-1.5 bg-emerald-50 rounded-lg text-xs font-semibold text-emerald-700 flex items-center gap-1.5 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
              </span>
            )}
          </div>
        </div>
      </div>

      {showNote && (
        <div className="px-5 pb-4 border-t border-border bg-amber-50/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-3 mb-2">Internal Note</p>
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            rows={3}
            placeholder="Add an internal note about this risk flag..."
            className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSaveNote}
              disabled={savingNote}
              className="px-4 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {savingNote && <Loader2 className="w-3 h-3 animate-spin" />}
              Save Note
            </button>
            <button
              onClick={() => { setNoteText(savedNote); setShowNote(false); }}
              className="px-4 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-semibold hover:bg-muted/80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showExplain && (
        <div className="px-5 pb-5 border-t border-indigo-100 bg-indigo-50/30">
          {loadingExplain ? (
            <div className="py-6 space-y-3">
              <div className="h-4 bg-indigo-100 rounded animate-pulse w-3/4" />
              <div className="h-4 bg-indigo-100 rounded animate-pulse w-full" />
              <div className="h-4 bg-indigo-100 rounded animate-pulse w-5/6" />
              <div className="h-4 bg-indigo-100 rounded animate-pulse w-2/3" />
            </div>
          ) : explanation && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <ExplainSection title="Issue Summary" color="indigo" content={explanation.summary} />
              <ExplainSection title="Why It's a Risk" color="rose" content={explanation.whyRisk} />
              <ExplainSection title="Estimated Exposure" color="amber" content={explanation.exposure} />
              <ExplainSection title="Recommended Actions" color="emerald" content={explanation.recommendation} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExplainSection({ title, color, content }: { title: string; color: string; content: string }) {
  const colorMap: Record<string, { bg: string; border: string; label: string; title: string }> = {
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', label: 'bg-indigo-100 text-indigo-700', title: 'text-indigo-700' },
    rose:   { bg: 'bg-rose-50',   border: 'border-rose-200',   label: 'bg-rose-100 text-rose-700',     title: 'text-rose-700' },
    amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  label: 'bg-amber-100 text-amber-700',   title: 'text-amber-700' },
    emerald:{ bg: 'bg-emerald-50',border: 'border-emerald-200',label: 'bg-emerald-100 text-emerald-700',title: 'text-emerald-700' },
  };
  const c = colorMap[color] ?? colorMap.indigo;
  const lines = content.split('\n').filter(Boolean);

  return (
    <div className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${c.title}`}>{title}</p>
      {lines.length > 1 ? (
        <ul className="space-y-1">
          {lines.map((line, i) => (
            <li key={i} className="text-xs text-foreground leading-relaxed">{line}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-foreground leading-relaxed">{content}</p>
      )}
    </div>
  );
}

export default function Risks() {
  const [statusFilter, setStatusFilter] = useState('open');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const queryClient = useQueryClient();

  const debouncedSearch = useDebounce(search, 300);

  const buildUrl = () => {
    const p = new URLSearchParams();
    if (statusFilter !== 'all') p.set('status', statusFilter);
    if (debouncedSearch) p.set('search', debouncedSearch);
    if (categoryFilter) p.set('category', categoryFilter);
    if (severityFilter) p.set('severity', severityFilter);
    p.set('limit', '100');
    return `/risks?${p.toString()}`;
  };

  const { data, isLoading } = useQuery<{ data: Risk[]; total: number }>({
    queryKey: ['risks', statusFilter, debouncedSearch, categoryFilter, severityFilter],
    queryFn: () => api.get<{ data: Risk[]; total: number }>(buildUrl()),
  });

  const formatCurrency = (val?: number | null) =>
    val != null ? `UGX ${new Intl.NumberFormat('en-UG').format(val)}` : '-';

  const handleAction = useCallback(async (id: string, action: 'review' | 'resolve') => {
    await api.post(`/risks/${id}/${action}`, {});
    queryClient.invalidateQueries({ queryKey: ['risks'] });
  }, [queryClient]);

  const risks = data?.data ?? [];
  const totalExposure = risks.reduce((s, r) => s + (r.estimatedExposure ?? 0), 0);

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-display font-bold text-foreground">Tax Risk Flags</h1>
          <p className="text-muted-foreground mt-1">Review and manage detected tax anomalies — Uganda (URA) jurisdiction.</p>
        </div>

        {!isLoading && risks.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-500 mb-1">Flags</p>
              <p className="text-2xl font-bold text-rose-700">{data?.total ?? 0}</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-500 mb-1">Est. Exposure</p>
              <p className="text-lg font-bold text-amber-700">{formatCurrency(totalExposure)}</p>
            </div>
            <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-500 mb-1">Jurisdiction</p>
              <p className="text-sm font-bold text-sky-700">Uganda (URA)</p>
              <p className="text-xs text-sky-500">VAT 18% · WHT 15% · PAYE 30%</p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex gap-1 bg-muted/40 p-1 rounded-xl">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  statusFilter === tab.key ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 ml-auto">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search flags..."
                className="pl-9 pr-8 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-52"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`px-3 py-2 border rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${showFilters ? 'bg-primary text-white border-primary' : 'bg-background border-input text-foreground hover:bg-muted'}`}
            >
              Filters {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 mb-6 p-4 bg-muted/30 rounded-xl border border-border">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:border-primary"
            >
              <option value="">All Categories</option>
              {['VAT', 'Withholding Tax', 'PAYE', 'Expense', 'Revenue'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:border-primary"
            >
              <option value="">All Severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            {(categoryFilter || severityFilter) && (
              <button
                onClick={() => { setCategoryFilter(''); setSeverityFilter(''); }}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            [1,2,3].map(i => <div key={i} className="h-36 bg-muted rounded-xl animate-pulse" />)
          ) : risks.length === 0 ? (
            <div className="p-16 text-center text-muted-foreground bg-card rounded-2xl border border-border border-dashed">
              <ShieldAlert className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No risk flags found</p>
              <p className="text-sm mt-1">Try changing the filters or run analysis on a company.</p>
            </div>
          ) : (
            risks.map((risk) => (
              <RiskCard key={risk.id} risk={risk} onAction={handleAction} />
            ))
          )}
        </div>

        {data && data.total > risks.length && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            Showing {risks.length} of {data.total} flags
          </p>
        )}
      </div>
    </AppLayout>
  );
}
