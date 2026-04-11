import React, { useState } from 'react';
import { AppLayout } from '@/components/layout';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Link } from 'wouter';
import {
  Search, Upload, ArrowUpDown, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, Receipt, Filter, X, Calendar, Building2,
} from 'lucide-react';

interface Transaction {
  id: string;
  companyId: string;
  uploadId: string | null;
  transactionDate: string | null;
  description: string | null;
  reference: string | null;
  amount: number | null;
  currency: string | null;
  accountCode: string | null;
  accountCategory: string | null;
  vendorName: string | null;
  customerName: string | null;
  taxType: string | null;
  vatAmount: number | null;
  withholdingTaxAmount: number | null;
  transactionType: string | null;
  createdAt: string;
}

interface TxResponse {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
}

interface Company {
  id: string;
  companyName: string;
}

type SortField = 'transaction_date' | 'amount' | 'description' | 'created_at';
type SortDir = 'asc' | 'desc';

const TAX_TYPES = ['VAT', 'WHT', 'PAYE', 'NONE'];

const TAX_TYPE_COLORS: Record<string, string> = {
  VAT:  'bg-violet-100 text-violet-700 border-violet-200',
  WHT:  'bg-sky-100 text-sky-700 border-sky-200',
  PAYE: 'bg-teal-100 text-teal-700 border-teal-200',
  NONE: 'bg-slate-100 text-slate-600 border-slate-200',
};

const TX_TYPE_COLORS: Record<string, string> = {
  income:   'bg-emerald-100 text-emerald-700',
  expense:  'bg-rose-100 text-rose-700',
  payroll:  'bg-amber-100 text-amber-700',
  transfer: 'bg-blue-100 text-blue-700',
};

function formatCurrency(val: number | null, currency = 'UGX') {
  if (val == null) return '—';
  return `${currency} ${new Intl.NumberFormat('en-UG').format(val)}`;
}

function formatDate(val: string | null) {
  if (!val) return '—';
  try { return new Date(val).toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return val; }
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function Transactions() {
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [taxType, setTaxType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('transaction_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const LIMIT = 25;

  const debouncedSearch = useDebounce(search, 350);

  const params = new URLSearchParams({
    page: String(page),
    limit: String(LIMIT),
    sortBy,
    sortDir,
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(companyId && { companyId }),
    ...(taxType && { taxType }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  });

  const { data, isLoading, isError } = useQuery<TxResponse>({
    queryKey: ['transactions', params.toString()],
    queryFn: () => api.get<TxResponse>(`/transactions?${params}`),
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ['companies-list'],
    queryFn: () => api.get<Company[]>('/companies'),
    select: (d) => Array.isArray(d) ? d : [],
  });

  const transactions = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  const hasFilters = !!(debouncedSearch || companyId || taxType || dateFrom || dateTo);

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 text-primary" />
      : <ArrowDown className="h-3.5 w-3.5 text-primary" />;
  }

  function clearFilters() {
    setSearch('');
    setCompanyId('');
    setTaxType('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:px-8 md:py-8">

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Transactions
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {total > 0 ? `${total.toLocaleString()} transaction${total !== 1 ? 's' : ''} across all clients` : 'All imported client transactions'}
            </p>
          </div>
          <Link
            to="/transactions/upload"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
          >
            <Upload className="h-4 w-4" />
            Upload CSV
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search description, reference, vendor…"
                className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              />
            </div>

            {/* Company */}
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={companyId}
                onChange={e => { setCompanyId(e.target.value); setPage(1); }}
                className="w-full appearance-none rounded-xl border border-input bg-background py-2.5 pl-9 pr-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              >
                <option value="">All clients</option>
                {(companies ?? []).map(c => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
            </div>

            {/* Tax Type */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={taxType}
                onChange={e => { setTaxType(e.target.value); setPage(1); }}
                className="w-full appearance-none rounded-xl border border-input bg-background py-2.5 pl-9 pr-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              >
                <option value="">All tax types</option>
                {TAX_TYPES.map(t => (
                  <option key={t} value={t}>{t === 'NONE' ? 'No Tax' : t}</option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              />
            </div>

            {/* Date To */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1); }}
                className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
              />
            </div>

            {/* Clear filters */}
            {hasFilters && (
              <div className="flex items-center sm:col-span-2 lg:col-span-2">
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Loading transactions…</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-500">
                <X className="h-5 w-5" />
              </div>
              <p className="font-medium text-foreground">Failed to load transactions</p>
              <p className="text-sm text-muted-foreground">Check your connection and try again</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Receipt className="h-6 w-6" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">No transactions found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasFilters ? 'Try adjusting your filters.' : 'Upload a CSV file to import your first transactions.'}
                </p>
              </div>
              {!hasFilters && (
                <Link
                  to="/transactions/upload"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
                >
                  <Upload className="h-4 w-4" />
                  Upload CSV
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => toggleSort('transaction_date')}
                        className="inline-flex items-center gap-1.5 font-semibold text-foreground hover:text-primary"
                      >
                        Date <SortIcon field="transaction_date" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => toggleSort('description')}
                        className="inline-flex items-center gap-1.5 font-semibold text-foreground hover:text-primary"
                      >
                        Description <SortIcon field="description" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Vendor / Customer</th>
                    <th className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleSort('amount')}
                        className="inline-flex items-center justify-end gap-1.5 font-semibold text-foreground hover:text-primary"
                      >
                        Amount <SortIcon field="amount" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Tax Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Category</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map(tx => {
                    const taxColor = TAX_TYPE_COLORS[tx.taxType ?? ''] ?? 'bg-slate-100 text-slate-500 border-slate-200';
                    const txColor = TX_TYPE_COLORS[tx.transactionType?.toLowerCase() ?? ''] ?? 'bg-muted text-muted-foreground';
                    const vendorOrCustomer = tx.vendorName || tx.customerName;

                    return (
                      <tr key={tx.id} className="transition-colors hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-3.5 text-sm text-muted-foreground">
                          {formatDate(tx.transactionDate)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="max-w-xs">
                            <p className="truncate font-medium text-foreground">
                              {tx.description || tx.reference || '—'}
                            </p>
                            {tx.reference && tx.description && (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                Ref: {tx.reference}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {vendorOrCustomer ? (
                            <div>
                              <p className="truncate max-w-[160px] text-sm font-medium text-foreground">
                                {vendorOrCustomer}
                              </p>
                              {tx.vendorName && tx.customerName && (
                                <p className="mt-0.5 truncate max-w-[160px] text-xs text-muted-foreground">
                                  {tx.customerName}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right">
                          <span className={`font-semibold tabular-nums ${(tx.amount ?? 0) < 0 ? 'text-rose-600' : 'text-foreground'}`}>
                            {formatCurrency(tx.amount, tx.currency ?? 'UGX')}
                          </span>
                          {(tx.vatAmount != null && tx.vatAmount > 0) && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              VAT: {formatCurrency(tx.vatAmount, tx.currency ?? 'UGX')}
                            </p>
                          )}
                          {(tx.withholdingTaxAmount != null && tx.withholdingTaxAmount > 0) && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              WHT: {formatCurrency(tx.withholdingTaxAmount, tx.currency ?? 'UGX')}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {tx.taxType ? (
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${taxColor}`}>
                              {tx.taxType}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="truncate max-w-[120px] text-xs text-muted-foreground block">
                            {tx.accountCategory || tx.accountCode || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {tx.transactionType ? (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${txColor}`}>
                              {tx.transactionType}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} of {total.toLocaleString()}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 5) p = i + 1;
                  else if (page <= 3) p = i + 1;
                  else if (page >= totalPages - 2) p = totalPages - 4 + i;
                  else p = page - 2 + i;

                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition ${
                        p === page
                          ? 'bg-primary text-white'
                          : 'border border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
