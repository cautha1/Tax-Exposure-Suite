import React, { useState } from 'react';
import { Link } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Building2, Mail, Lock, User, Briefcase, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { motion } from 'framer-motion';

const signupSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(['advisor', 'client_user']),
});

type SignupForm = z.infer<typeof signupSchema>;

export default function Signup() {
  const { signup } = useAuth();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { role: 'advisor' }
  });
  const onSubmit = async (data: SignupForm) => {
    try {
      setError('');
      console.log('Submitting signup:', data);

      const result = await signup(
        data.email,
        data.password,
        data.fullName,
        data.role
      );

      console.log('Signup result:', result);
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err?.message || 'Registration failed. Please try again.');
    }
  };
  
  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4 py-12">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg bg-card rounded-2xl shadow-xl shadow-black/5 border border-border/50 overflow-hidden"
      >
        <div className="p-8 sm:p-10">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <Building2 className="w-7 h-7 text-white" />
            </div>
          </div>
          
          <h2 className="text-2xl font-display font-bold text-center text-foreground mb-2">Create your workspace</h2>
          <p className="text-center text-muted-foreground mb-8">Start detecting tax risks automatically</p>

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4 mb-2">
              <label className={`
                cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all
                has-[:checked]:border-primary has-[:checked]:bg-primary/5 hover:border-primary/50
              `}>
                <input type="radio" value="advisor" {...register('role')} className="sr-only" />
                <Briefcase className="w-6 h-6 text-foreground" />
                <span className="font-semibold text-sm">Tax Advisor</span>
              </label>
              
              <label className={`
                cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all
                has-[:checked]:border-primary has-[:checked]:bg-primary/5 hover:border-primary/50
              `}>
                <input type="radio" value="client_user" {...register('role')} className="sr-only" />
                <Building2 className="w-6 h-6 text-foreground" />
                <span className="font-semibold text-sm">In-House Team</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <input 
                  {...register('fullName')}
                  type="text" 
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-background border border-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  placeholder="John Doe"
                />
              </div>
              {errors.fullName && <p className="mt-1 text-sm text-destructive">{errors.fullName.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Work Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <input 
                  {...register('email')}
                  type="email" 
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-background border border-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  placeholder="name@company.com"
                />
              </div>
              {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <input 
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-background border border-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>}
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center mt-6"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
            </button>
          </form>
        </div>
        
        <div className="px-8 py-5 bg-muted/30 border-t border-border/50 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account? <Link href="/login" className="font-semibold text-primary hover:underline">Sign In</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
