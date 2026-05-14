import React, { useState } from 'react';
import { Link } from 'wouter';
import { AppLayout } from '@/components/layout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Building2, Search, Plus, ExternalLink, ShieldAlert, Loader2, MoreVertical, Pencil, PauseCircle, PlayCircle, Trash2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';

interface Company {
  id: string;
  companyName: string;
  tinOrTaxId: string | null;
  industry: string | null;
  country: string | null;
  financialYear: string | null;
  riskLevel: string | null;
  riskScore: number | null;
  transactionCount: number | null;
  openFlagsCount: number | null;
  estimatedExposure: number | null;
  status?: string | null;
  createdAt: string;
}

const companySchema = z.object({
  companyName: z.string().min(2, "Name is required"),
  tinOrTaxId: z.string().min(5, "Tax ID is required"),
  industry: z.string().optional(),
  country: z.string().min(2, "Country is required"),
  financialYear: z.string().optional(),
});

type CompanyForm = z.infer<typeof companySchema>;

export default function Clients() {
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const queryClient = useQueryClient();

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ['companies', search],
    queryFn: () => api.get<Company[]>('/companies' + (search ? `?search=${encodeURIComponent(search)}` : '')),
  });

  const saveMutation = useMutation({
    mutationFn: (data: CompanyForm) => editingCompany
      ? api.put<Company>(`/companies/${editingCompany.id}`, data)
      : api.post<Company>('/companies', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setIsAddModalOpen(false);
      setEditingCompany(null);
      setFormError('');
      reset();
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : 'Unable to create client');
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
  });

  const onSubmit = (data: CompanyForm) => {
    setFormError('');
    saveMutation.mutate(data);
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'suspended' }) =>
      api.patch<Company>(`/companies/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/companies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDeleteTarget(null);
    },
  });

  const openCreate = () => {
    setEditingCompany(null);
    setFormError('');
    reset({ companyName: '', tinOrTaxId: '', country: 'Uganda', industry: '', financialYear: '' });
    setIsAddModalOpen(true);
  };

  const openEdit = (company: Company) => {
    setEditingCompany(company);
    setFormError('');
    reset({
      companyName: company.companyName,
      tinOrTaxId: company.tinOrTaxId ?? '',
      country: company.country ?? 'Uganda',
      industry: company.industry ?? '',
      financialYear: company.financialYear ?? '',
    });
    setIsAddModalOpen(true);
    setOpenActionsId(null);
  };

  const getRiskColor = (level?: string | null) => {
    const l = level?.toLowerCase();
    if (l === 'critical') return 'bg-purple-100 text-purple-800 border-purple-300';
    if (l === 'high') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (l === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Clients</h1>
          </div>
          <button
            onClick={openCreate}
            className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Add Client
          </button>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border/60 flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search companies by name or Tax ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-muted/30 border border-input rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border/60 text-sm text-muted-foreground font-medium uppercase tracking-wider">
                  <th className="p-4 pl-6">Company</th>
                  <th className="p-4">Tax ID</th>
                  <th className="p-4">Risk Profile</th>
                  <th className="p-4">Transactions</th>
                  <th className="p-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading clients...</td></tr>
                ) : companies?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Building2 className="w-12 h-12 mb-3 text-muted-foreground/50" />
                        <p>No clients found.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  companies?.map((company) => (
                    <tr key={company.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {company.companyName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{company.companyName}</p>
                            <p className="text-xs text-muted-foreground">{company.industry || 'Unknown Industry'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-sm text-muted-foreground">{company.tinOrTaxId || '-'}</td>
                      <td className="p-4">
                        {company.status === 'suspended' || company.riskLevel === 'suspended' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-slate-100 text-slate-700 border-slate-200">
                            Suspended
                          </span>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRiskColor(company.riskLevel)}`}>
                            {company.riskLevel || 'Unknown'} Risk
                          </span>
                        )}
                        {company.openFlagsCount && company.openFlagsCount > 0 ? (
                          <div className="flex items-center gap-1 mt-1 text-xs text-rose-600 font-medium">
                            <ShieldAlert className="w-3 h-3" /> {company.openFlagsCount} active flags
                          </div>
                        ) : null}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {company.transactionCount ? new Intl.NumberFormat('en-US').format(company.transactionCount) : '0'} lines
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="relative inline-flex items-center gap-1">
                          <Link
                            href={`/clients/${company.id}`}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Open client"
                          >
                            <ExternalLink className="w-5 h-5" />
                          </Link>
                          <button
                            onClick={() => setOpenActionsId(openActionsId === company.id ? null : company.id)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Manage client"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          {openActionsId === company.id && (
                            <div className="absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                              <button onClick={() => openEdit(company)} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted">
                                <Pencil className="w-4 h-4" /> Edit client
                              </button>
                              <button
                                onClick={() => {
                                  statusMutation.mutate({
                                    id: company.id,
                                    status: company.status === 'suspended' || company.riskLevel === 'suspended' ? 'active' : 'suspended',
                                  });
                                  setOpenActionsId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted"
                              >
                                {company.status === 'suspended' || company.riskLevel === 'suspended' ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                                {company.status === 'suspended' || company.riskLevel === 'suspended' ? 'Activate client' : 'Suspend client'}
                              </button>
                              <button onClick={() => { setDeleteTarget(company); setOpenActionsId(null); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50">
                                <Trash2 className="w-4 h-4" /> Delete client
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsAddModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-lg relative z-10 overflow-hidden"
            >
              <div className="p-6 border-b border-border/50 flex justify-between items-center bg-muted/20">
                <h3 className="text-xl font-bold font-display">{editingCompany ? 'Edit Client' : 'Add Client'}</h3>
                <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingCompany(null); }} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                {formError && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                    {formError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">Company Name</label>
                  <input {...register('companyName')} className="w-full px-4 py-2.5 rounded-xl border border-input focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  {errors.companyName && <p className="text-destructive text-xs mt-1">{errors.companyName.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">TIN / Tax ID</label>
                  <input {...register('tinOrTaxId')} className="w-full px-4 py-2.5 rounded-xl border border-input focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  {errors.tinOrTaxId && <p className="text-destructive text-xs mt-1">{errors.tinOrTaxId.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Country</label>
                    <input {...register('country')} defaultValue="Uganda" className="w-full px-4 py-2.5 rounded-xl border border-input focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    {errors.country && <p className="text-destructive text-xs mt-1">{errors.country.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Industry</label>
                    <input {...register('industry')} className="w-full px-4 py-2.5 rounded-xl border border-input focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  </div>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-5 py-2.5 rounded-xl font-medium text-muted-foreground hover:bg-muted transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={saveMutation.isPending} className="px-5 py-2.5 bg-primary text-primary-foreground font-medium rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2">
                    {saveMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : editingCompany ? 'Save Changes' : 'Create Client'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-foreground">Delete client</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                This will permanently remove {deleteTarget.companyName} and related records.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setDeleteTarget(null)} className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
                  Cancel
                </button>
                <button onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                  {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
