import React from 'react';
import { AppLayout } from '@/components/layout';
import { useAuth } from '@/hooks/use-auth';

export default function Settings() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and workspace preferences.</p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">Profile Information</h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <div>
                <button className="px-4 py-2 bg-background border-2 border-border rounded-xl text-sm font-semibold hover:border-primary transition-colors">
                  Upload Photo
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-foreground">Full Name</label>
                <input 
                  type="text" 
                  defaultValue={user?.fullName || ''}
                  className="w-full px-4 py-3 rounded-xl bg-background border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-foreground">Email Address</label>
                <input 
                  type="email" 
                  defaultValue={user?.email || ''}
                  disabled
                  className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-input text-muted-foreground cursor-not-allowed" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-foreground">Role</label>
                <input 
                  type="text" 
                  defaultValue={user?.role || ''}
                  disabled
                  className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-input text-muted-foreground cursor-not-allowed capitalize" 
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <button className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors shadow-md">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
