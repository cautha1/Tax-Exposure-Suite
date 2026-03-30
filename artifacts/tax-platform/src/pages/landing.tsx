import React from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { 
  Building2, ShieldAlert, FileSpreadsheet, 
  BarChart3, ArrowRight, CheckCircle2,
  Zap, Lock, Globe, Users, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-foreground">TaxIntel</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#solutions" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Solutions</a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Background Image - Absolute positioned behind content */}
        <div className="absolute inset-0 z-0 opacity-10 dark:opacity-20 pointer-events-none">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
            alt="Hero Background" 
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Decorative Gradients */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-3xl opacity-50 z-0 pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block py-1.5 px-3 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6 border border-primary/20">
              Introducing Tax Exposure Intelligence
            </span>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-extrabold text-foreground tracking-tight max-w-4xl mx-auto leading-tight">
              Proactive Tax Advisory <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
                Powered by Intelligence
              </span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Detect tax risks instantly, analyze millions of transactions, and generate comprehensive advisory reports for your clients in minutes, not weeks.
            </p>
            
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-primary text-primary-foreground text-lg font-semibold shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-2 group">
                Start Free Trial
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/login" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-background border-2 border-border text-foreground text-lg font-semibold hover:border-primary/50 hover:bg-muted/50 transition-all duration-300">
                View Demo Platform
              </Link>
            </div>
            
            <div className="mt-10 flex items-center justify-center gap-8 text-sm text-muted-foreground font-medium">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> No credit card required</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> 14-day free trial</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Setup in minutes</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">Everything you need to scale advisory</h2>
            <p className="mt-4 text-lg text-muted-foreground">Automate manual transaction reviews and focus on what matters: delivering strategic tax advice to your clients.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: FileSpreadsheet,
                title: 'Seamless Data Ingestion',
                desc: 'Upload giant CSVs from any ERP system. Our engine standardizes and maps chart of accounts automatically.',
                color: 'bg-blue-500/10 text-blue-600 border-blue-500/20'
              },
              {
                icon: ShieldAlert,
                title: 'Automated Risk Flags',
                desc: '100+ proprietary rules run against every transaction to detect VAT mismatches, WHT omissions, and more.',
                color: 'bg-rose-500/10 text-rose-600 border-rose-500/20'
              },
              {
                icon: BarChart3,
                title: 'Exposure Analytics',
                desc: 'Quantify potential tax exposure instantly with beautiful, client-ready dashboard visualizations.',
                color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              },
              {
                icon: Users,
                title: 'Multi-Client Management',
                desc: 'Manage all your advisory clients in one secure workspace with granular role-based access control.',
                color: 'bg-purple-500/10 text-purple-600 border-purple-500/20'
              },
              {
                icon: FileText,
                title: 'One-Click Reporting',
                desc: 'Generate comprehensive tax health reports in PDF/Word format instantly for your client meetings.',
                color: 'bg-orange-500/10 text-orange-600 border-orange-500/20'
              },
              {
                icon: Lock,
                title: 'Enterprise Security',
                desc: 'Bank-grade encryption, SOC2 compliance, and strict data isolation between client environments.',
                color: 'bg-slate-500/10 text-slate-600 border-slate-500/20'
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="bg-card p-8 rounded-2xl border border-border/60 shadow-sm hover:shadow-xl hover:border-border transition-all duration-300 group"
              >
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center border ${feature.color} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 bg-foreground text-background relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">Ready to transform your tax practice?</h2>
          <p className="text-lg text-background/70 mb-10">Join leading advisory firms who use TaxIntel to deliver proactive value to their clients.</p>
          <Link href="/signup" className="inline-flex px-8 py-4 rounded-xl bg-primary text-white text-lg font-semibold shadow-lg shadow-primary/20 hover:bg-primary/90 hover:-translate-y-1 transition-all duration-300">
            Create Your Account
          </Link>
        </div>
      </section>
    </div>
  );
}
