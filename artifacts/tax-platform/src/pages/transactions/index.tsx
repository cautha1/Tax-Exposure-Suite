import React, { useState } from 'react';
import { AppLayout } from '@/components/layout';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Link } from 'wouter';
import { Search, Upload, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

interface Company {
  id: string;
  companyName: string;
}

interface Transaction {
  id: string;
  companyId: string;
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
}

interface TransactionListResponse {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const TAX_TYPES = ['VAT', 'WHT', 'PAYE', 'NONE'];
const TX_TYPES = ['sale', 'purchase', 'payroll', 'service', 'dividend', 'rent', 'interest', 'other'];
const LIMIT = 50;

export default function Transactions() {
  const [companyId, setCompanyId] = useState('');
  const [search, setSearch] = useState('');
  const [taxType, setTaxType] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const { data: companies } = useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: () => api.get<Company[]>('/companies'),
  });

  const buildParams = () => {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', companyId);
    if (search) params.set('search', search);
    if (taxType) params.set('taxType', taxType);
    if (transactionType) params.set('transactionType', transactionType);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    params.set('page', String(page));
    params.set('limit', String(LIMIT));
    return params.toString();
  };

  const { data, isLoading } = useQuery<TransactionListResponse>({
    queryKey: ['transactions', companyId, search, taxType, transactionType, dateFrom, dateTo, page],
    queryFn: () => api.get<TransactionListResponse>(`/transactions?${buildParams()}`),
  });

  const transactions = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  const formatCurrency = (val?: number | null, currency?: string | null) => {
    if (val == null) return '-';
    return `${currency ?? 'UGX'} ${new Intl.NumberFormat('en-UG').format(val)}`;
  };

  const taxTypeColors: Record<string, string> = {
    VAT: 'bg-violet-100 text-violet-700',
    WHT: 'bg-sky-100 text-sky-700',
    PAYE: 'bg-teal-100 text-teal-700',
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Transactions</h1>
            <p className="text-muted-foreground mt-1">
              {total > 0 ? `${total.toLocaleString()} transactions found` : 'Browse and filter imported transactions'}
            </p>
          </div>
          <Link
            href="/transactions/upload"
            className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> Import CSV
          </Link>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-sm mb-6 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <select
              value={companyId}
              onChange={handleFilterChange(setCompanyId)}
              className="col-span-1 xl:col-span-2 px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Clients</option>
              {companies?.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={handleFilterChange(setSearch)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <select
              value={taxType}
              onChange={handleFilterChange(setTaxType)}
              className="px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Tax Types</option>
              {TAX_TYPES.map(t => <option key={t} value={t}>{t === 'NONE' ? 'No Tax Type' : t}</option>)}
            </select>

            <select
              value={transactionType}
              onChange={handleFilterChange(setTransactionType)}
              className="px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Types</option>
              {TX_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
            </select>

            <div className="flex gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={handleFilterChange(setDateFrom)}
                className="flex-1 px-2 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                title="From date"
              />
              <input
                type="date"
                value={dateTo}
                onChange={handleFilterChange(setDateTo)}
                className="flex-1 px-2 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                title="To date"
              />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border/60 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <th className="p-4 pl-6">Date</th>
                  <th className="p-4">Description</th>
                  <th className="p-4">Vendor / Customer</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Tax Type</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 text-right pr-6">VAT / WHT</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td colSpan={7} className="p-4">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-16 text-center text-muted-foreground">
                      <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">No transactions found.</p>
                      <p className="text-xs mt-1">Try adjusting your filters or import a CSV file.</p>
                      <Link href="/transactions/upload" className="inline-block mt-3 text-primary font-medium text-sm hover:underline">
                        Import CSV
                      </Link>
                    </td>
                  </tr>
                ) : (
                  transactions.map(tx => (
                    <tr key={tx.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors text-sm">
                      <td className="p-4 pl-6 text-muted-foreground whitespace-nowrap font-mono text-xs">
                        {tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString('en-UG') : '-'}
                      </td>
                      <td className="p-4 max-w-xs">
                        <p className="text-foreground font-medium truncate">{tx.description || '-'}</p>
                        {tx.reference && <p className="text-muted-foreground text-xs">{tx.reference}</p>}
                      </td>
                      <td className="p-4 text-muted-foreground text-xs">
                        {tx.vendorName || tx.customerName || '-'}
                      </td>
                      <td className="p-4 text-muted-foreground text-xs">
                        {tx.accountCategory || tx.accountCode || '-'}
                      </td>
                      <td className="p-4">
                        {tx.taxType ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${taxTypeColors[tx.taxType] ?? 'bg-muted text-muted-foreground'}`}>
                            {tx.taxType}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="p-4 text-right font-semibold text-foreground whitespace-nowrap">
                        {formatCurrency(tx.amount, tx.currency)}
                      </td>
                      <td className="p-4 pr-6 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {tx.vatAmount ? <span>VAT {formatCurrency(tx.vatAmount, tx.currency)}</span> : null}
                        {tx.withholdingTaxAmount ? <span>WHT {formatCurrency(tx.withholdingTaxAmount, tx.currency)}</span> : null}
                        {!tx.vatAmount && !tx.withholdingTaxAmount ? '—' : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/40">
              <p className="text-sm text-muted-foreground">
                Page {page} of {pages} ({total.toLocaleString()} total)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
