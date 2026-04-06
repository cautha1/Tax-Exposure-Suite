import React, { useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout';
import { useListCompanies } from '@workspace/api-client-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FileSpreadsheet, Plus, ChevronUp, ChevronDown, ChevronsUpDown, Filter, X, Search } from 'lucide-react';
import { Link } from 'wouter';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

interface Transaction {
  id: string;
  transactionDate?: string | null;
  description?: string | null;
  reference?: string | null;
  amount?: number | null;
  currency?: string | null;
  taxType?: string | null;
  transactionType?: string | null;
  accountCode?: string | null;
  accountCategory?: string | null;
  vendorName?: string | null;
  customerName?: string | null;
}

interface TransactionList { data: Transaction[]; total: number; page: number; }

type SortDir = 'asc' | 'desc';

export default function Transactions() {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [search, setSearch] = useState('');
  const [taxType, setTaxType] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const { data: companies } = useListCompanies();
  const debouncedSearch = useDebounce(search, 350);

  const buildUrl = () => {
    const p = new URLSearchParams();
    if (selectedCompany) p.set('companyId', selectedCompany);
    if (debouncedSearch) p.set('search', debouncedSearch);
    if (taxType) p.set('taxType', taxType);
    if (transactionType) p.set('transactionType', transactionType);
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo) p.set('dateTo', dateTo);
    if (amountMin) p.set('amountMin', amountMin);
    if (amountMax) p.set('amountMax', amountMax);
    p.set('sortBy', sortBy);
    p.set('sortDir', sortDir);
    p.set('page', String(page));
    p.set('limit', '50');
    return `/transactions?${p.toString()}`;
  };

  const { data, isLoading } = useQuery<TransactionList>({
    queryKey: ['transactions', selectedCompany, debouncedSearch, taxType, transactionType, dateFrom, dateTo, amountMin, amountMax, sortBy, sortDir, page],
    queryFn: () => api.get<TransactionList>(buildUrl()),
    placeholderData: (prev) => prev,
  });

  const handleSort = useCallback((col: string) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  }, [sortBy]);

  const clearFilters = () => {
    setSearch(''); setTaxType(''); setTransactionType('');
    setDateFrom(''); setDateTo(''); setAmountMin(''); setAmountMax('');
    setSelectedCompany(''); setPage(1);
  };

  const hasActiveFilters = search || taxType || transactionType || dateFrom || dateTo || amountMin || amountMax;

  const formatCurrency = (amount?: number | null) => {
    if (amount == null) return '-';
    return `UGX ${new Intl.NumberFormat('en-UG').format(amount)}`;
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ChevronsUpDown className="w-3.5 h-3.5 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />;
  };

  const totalPages = data ? Math.ceil(data.total / 50) : 1;

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Transactions</h1>
            <p className="text-muted-foreground mt-1">Unified view of all client transaction data.</p>
          </div>
          <Link
            href="/transactions/upload"
            className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Import Data
          </Link>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
          <div className="p-4 border-b border-border bg-muted/10 shrink-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search description, vendor, ref..."
                  className="pl-9 pr-8 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-64"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>

              <select
                value={selectedCompany}
                onChange={e => { setSelectedCompany(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                <option value="">All Companies</option>
                {companies?.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
              </select>

              <select
                value={taxType}
                onChange={e => { setTaxType(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                <option value="">All Tax Types</option>
                <option value="VAT">VAT (18%)</option>
                <option value="WHT">WHT (15%)</option>
                <option value="PAYE">PAYE (30%)</option>
              </select>

              <select
                value={transactionType}
                onChange={e => { setTransactionType(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                <option value="">All Types</option>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>

              <button
                onClick={() => setShowFilters(v => !v)}
                className={`px-3 py-2 border rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ml-auto ${showFilters ? 'bg-primary text-white border-primary' : 'bg-background border-input hover:bg-muted'}`}
              >
                <Filter className="w-4 h-4" /> More Filters {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {hasActiveFilters && (
                <button onClick={clearFilters} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <X className="w-3.5 h-3.5" /> Clear all
                </button>
              )}
            </div>

            {showFilters && (
              <div className="flex flex-wrap gap-3 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Date From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                    className="px-2 py-1.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => { setDateTo(e.target.value); setPage(1); }}
                    className="px-2 py-1.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Min Amount (UGX)</label>
                  <input
                    type="number"
                    value={amountMin}
                    onChange={e => { setAmountMin(e.target.value); setPage(1); }}
                    placeholder="0"
                    className="w-32 px-2 py-1.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Max</label>
                  <input
                    type="number"
                    value={amountMax}
                    onChange={e => { setAmountMax(e.target.value); setPage(1); }}
                    placeholder="No limit"
                    className="w-32 px-2 py-1.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 bg-card z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                <tr className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <th className="px-5 py-3.5 cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('transaction_date')}>
                    <span className="flex items-center gap-1">Date <SortIcon col="transaction_date" /></span>
                  </th>
                  <th className="px-5 py-3.5 cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('description')}>
                    <span className="flex items-center gap-1">Description <SortIcon col="description" /></span>
                  </th>
                  <th className="px-5 py-3.5">Reference</th>
                  <th className="px-5 py-3.5 text-right cursor-pointer hover:text-foreground select-none" onClick={() => handleSort('amount')}>
                    <span className="flex items-center gap-1 justify-end">Amount <SortIcon col="amount" /></span>
                  </th>
                  <th className="px-5 py-3.5">Tax Type</th>
                  <th className="px-5 py-3.5">Tx Type</th>
                  <th className="px-5 py-3.5">Account</th>
                  <th className="px-5 py-3.5">Vendor / Customer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">Loading transactions...</td></tr>
                ) : data?.data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-16 text-center text-muted-foreground">
                      <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p>No transactions found.</p>
                      {hasActiveFilters && <button onClick={clearFilters} className="mt-2 text-sm text-primary hover:underline">Clear filters</button>}
                    </td>
                  </tr>
                ) : (
                  data?.data.map((txn) => (
                    <tr key={txn.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 text-sm text-muted-foreground">
                        {txn.transactionDate ? new Date(txn.transactionDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-foreground max-w-[280px] truncate">
                        {txn.description ?? '-'}
                      </td>
                      <td className="px-5 py-3 text-sm font-mono text-muted-foreground">{txn.reference ?? '-'}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-right text-foreground">
                        {formatCurrency(txn.amount)}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        {txn.taxType ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            txn.taxType === 'VAT' ? 'bg-violet-100 text-violet-700' :
                            txn.taxType === 'WHT' ? 'bg-sky-100 text-sky-700' :
                            txn.taxType === 'PAYE' ? 'bg-teal-100 text-teal-700' :
                            'bg-muted text-muted-foreground'
                          }`}>{txn.taxType}</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs">None</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        {txn.transactionType ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${
                            txn.transactionType === 'credit' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>{txn.transactionType}</span>
                        ) : '-'}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {[txn.accountCode, txn.accountCategory].filter(Boolean).join(' – ')}
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{txn.vendorName ?? txn.customerName ?? '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data && (
            <div className="p-4 border-t border-border bg-muted/10 text-xs text-muted-foreground flex justify-between items-center shrink-0">
              <span>
                Showing {Math.min(((page - 1) * 50) + 1, data.total)}–{Math.min(page * 50, data.total)} of {data.total.toLocaleString()} transactions
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg border border-input bg-background text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="font-semibold text-foreground">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg border border-input bg-background text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
