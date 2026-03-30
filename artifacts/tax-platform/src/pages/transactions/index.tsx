import React, { useState } from 'react';
import { AppLayout } from '@/components/layout';
import { useListTransactions, useListCompanies } from '@workspace/api-client-react';
import { FileSpreadsheet, Plus, Filter, Search } from 'lucide-react';
import { Link } from 'wouter';

export default function Transactions() {
  const [selectedCompany, setSelectedCompany] = useState('');
  const { data: companies } = useListCompanies();
  const { data, isLoading } = useListTransactions({ companyId: selectedCompany || undefined });

  const formatCurrency = (amount: number | null | undefined, currency: string | null | undefined) => {
    if (amount == null) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
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

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-[calc(100vh-200px)]">
          <div className="p-4 border-b border-border bg-muted/10 flex flex-wrap items-center gap-4 shrink-0">
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search description..." 
                className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            
            <select 
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:border-primary"
            >
              <option value="">All Companies</option>
              {companies?.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </select>
            
            <button className="px-3 py-2 bg-background border border-input rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-muted transition-colors ml-auto">
              <Filter className="w-4 h-4" /> Filters
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 bg-card z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                <tr className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Reference</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4">Tax Type</th>
                  <th className="px-6 py-4">Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">Loading transactions...</td></tr>
                ) : data?.data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-16 text-center text-muted-foreground">
                      <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p>No transactions found.</p>
                    </td>
                  </tr>
                ) : (
                  data?.data.map((txn) => (
                    <tr key={txn.id} className="table-row-hover">
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {txn.transactionDate ? new Date(txn.transactionDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-foreground truncate max-w-[300px]">
                        {txn.description}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-muted-foreground">
                        {txn.reference}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-right text-foreground">
                        {formatCurrency(txn.amount, txn.currency)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 rounded bg-muted text-muted-foreground text-xs font-semibold">
                          {txn.taxType || 'NONE'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {txn.accountCode} - {txn.accountCategory}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {data && (
            <div className="p-4 border-t border-border bg-muted/10 text-xs text-muted-foreground flex justify-between shrink-0">
              <span>Showing {data.data.length} transactions</span>
              <div className="flex items-center gap-4">
                <button className="hover:text-foreground disabled:opacity-50">Previous</button>
                <span className="font-semibold text-foreground">Page {data.page}</span>
                <button className="hover:text-foreground disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
