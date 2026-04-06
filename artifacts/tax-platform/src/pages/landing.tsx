import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { motion, useScroll, useTransform, useInView, animate } from 'framer-motion';
import {
  ArrowRight, ChevronDown, BarChart3, ShieldCheck, FileSearch,
  Users, Zap, Lock, TrendingUp, CheckCircle, Building2
} from 'lucide-react';

// ─── Animated counter ────────────────────────────────────────────────────────
function Counter({ to, prefix = '', suffix = '' }: { to: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView || !ref.current) return;
    const ctrl = animate(0, to, {
      duration: 1.8,
      ease: 'easeOut',
      onUpdate(v) { if (ref.current) ref.current.textContent = prefix + Math.round(v).toLocaleString() + suffix; },
    });
    return () => ctrl.stop();
  }, [inView, to, prefix, suffix]);
  return <span ref={ref}>{prefix}0{suffix}</span>;
}

// ─── Floating blob ────────────────────────────────────────────────────────────
function Blob({ color, style }: { color: string; style?: React.CSSProperties }) {
  return (
    <motion.div
      className="absolute rounded-full blur-3xl pointer-events-none"
      style={{ background: color, ...style }}
      animate={{ scale: [1, 1.08, 1], x: [0, 12, 0], y: [0, -10, 0] }}
      transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

const fadeUp = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } } };
const stagger = { show: { transition: { staggerChildren: 0.12 } } };

// ─── Feature row ─────────────────────────────────────────────────────────────
function FeatureRow({ icon: Icon, tag, title, desc, accent, reverse, points }: {
  icon: React.ElementType; tag: string; title: string; desc: string;
  accent: string; reverse?: boolean; points: string[];
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <div ref={ref} className={`flex flex-col ${reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-20 py-16 lg:py-24`}>
      <motion.div
        className="flex-1"
        initial={{ opacity: 0, x: reverse ? 40 : -40 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="inline-block text-xs font-semibold uppercase tracking-widest mb-4 px-3 py-1 rounded-full" style={{ background: accent + '30', color: accent }}>
          {tag}
        </span>
        <h3 className="text-3xl lg:text-4xl font-bold text-slate-800 leading-tight mb-4">{title}</h3>
        <p className="text-slate-500 text-lg leading-relaxed mb-6">{desc}</p>
        <ul className="space-y-3">
          {points.map((p, i) => (
            <li key={i} className="flex items-start gap-3 text-slate-600">
              <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" style={{ color: accent }} />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </motion.div>

      <motion.div
        className="flex-1 flex justify-center"
        initial={{ opacity: 0, x: reverse ? -40 : 40 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      >
        <div className="relative w-72 h-72 lg:w-80 lg:h-80 rounded-3xl flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${accent}18 0%, ${accent}08 100%)`, border: `1px solid ${accent}25` }}>
          <Blob color={accent + '22'} style={{ width: 220, height: 220, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
          <Icon className="w-28 h-28 relative z-10" style={{ color: accent, opacity: 0.85 }} strokeWidth={1.2} />
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LandingPage() {
  const heroRef = useRef(null);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 400], [0, -60]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const unsub = scrollY.on('change', (v) => setScrolled(v > 40));
    return unsub;
  }, [scrollY]);

  return (
    <div className="min-h-screen font-sans" style={{ background: '#F8F7F4' }}>

      {/* ── Nav ─────────────────────────────────────────── */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{ background: scrolled ? 'rgba(248,247,244,0.92)' : 'transparent', backdropFilter: scrolled ? 'blur(16px)' : 'none', boxShadow: scrolled ? '0 1px 32px rgba(0,0,0,0.06)' : 'none' }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#7C9EE8,#9B8EC4)' }}>
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-800 tracking-tight">TaxIntel</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {['Features', 'How it works', 'Pricing'].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(' ', '-')}`} className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">{l}</a>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Log in</Link>
            <Link href="/signup" className="px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg,#7C9EE8,#9B8EC4)', boxShadow: '0 4px 18px rgba(124,158,232,0.35)' }}>
              Get Started
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 text-center">
        {/* Blobs */}
        <Blob color="#C4D9F8" style={{ width: 560, height: 560, top: -60, left: -120, opacity: 0.55 }} />
        <Blob color="#DDD6F3" style={{ width: 480, height: 480, bottom: -80, right: -100, opacity: 0.5 }} />
        <Blob color="#C8E6D4" style={{ width: 300, height: 300, top: '40%', left: '60%', opacity: 0.35 }} />

        <motion.div style={{ y: heroY }} className="relative z-10 max-w-4xl mx-auto">
          <motion.div
            initial="hidden" animate="show" variants={stagger}
            className="flex flex-col items-center"
          >
            <motion.span variants={fadeUp}
              className="inline-block text-xs font-semibold uppercase tracking-widest mb-8 px-4 py-2 rounded-full"
              style={{ background: 'rgba(124,158,232,0.14)', color: '#6885CC', border: '1px solid rgba(124,158,232,0.25)' }}>
              Built for Tax Advisory Professionals
            </motion.span>

            <motion.h1 variants={fadeUp}
              className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.08] tracking-tight text-slate-800 mb-6">
              Tax Intelligence,{' '}
              <br />
              <span style={{ background: 'linear-gradient(135deg,#7C9EE8 0%,#9B8EC4 50%,#86B89F 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Effortlessly Delivered
              </span>
            </motion.h1>

            <motion.p variants={fadeUp}
              className="text-lg md:text-xl text-slate-500 max-w-2xl leading-relaxed mb-10">
              Upload client transactions, surface every tax risk automatically, and deliver polished advisory reports — all in one elegant workspace.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 items-center">
              <Link href="/signup"
                className="group flex items-center gap-2 px-8 py-4 rounded-full text-white font-semibold text-base transition-all duration-300 hover:-translate-y-1"
                style={{ background: 'linear-gradient(135deg,#7C9EE8,#9B8EC4)', boxShadow: '0 8px 28px rgba(124,158,232,0.38)' }}>
                Start Free Trial
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/login"
                className="flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-base text-slate-700 transition-all duration-300 hover:bg-white/80"
                style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)', backdropFilter: 'blur(8px)' }}>
                View Demo
              </Link>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-400 font-medium">
              {['No credit card required', '14-day free trial', 'Setup in minutes', 'SOC2 compliant'].map(t => (
                <span key={t} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#86B89F' }} />
                  {t}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10"
          animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          <ChevronDown className="w-6 h-6 text-slate-300" />
        </motion.div>
      </section>

      {/* ── Stats strip ──────────────────────────────────── */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-3xl p-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
            style={{ background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(0,0,0,0.06)', backdropFilter: 'blur(16px)', boxShadow: '0 2px 40px rgba(0,0,0,0.04)' }}>
            {[
              { val: 98, suffix: '%', label: 'Risk detection accuracy' },
              { val: 10, prefix: '', suffix: 'x', label: 'Faster than manual review' },
              { val: 500, suffix: '+', label: 'Advisory firms onboarded' },
              { val: 2.4, prefix: '$', suffix: 'B', label: 'Tax exposure identified' },
            ].map((s, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}>
                <div className="text-4xl lg:text-5xl font-bold mb-2"
                  style={{ background: 'linear-gradient(135deg,#7C9EE8,#9B8EC4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {s.prefix ?? ''}<Counter to={s.val} />{s.suffix}
                </div>
                <p className="text-sm text-slate-400 font-medium">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature sections ─────────────────────────────── */}
      <section id="features" className="px-6 max-w-6xl mx-auto">
        <motion.div className="text-center mb-4"
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Platform capabilities</span>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold text-slate-800">Designed around your workflow</h2>
          <p className="mt-4 text-lg text-slate-400 max-w-xl mx-auto">From ingestion to client delivery — every step is built for how accountants actually work.</p>
        </motion.div>

        <FeatureRow
          icon={FileSearch}
          tag="Data ingestion"
          title="Upload once. Analyse everything."
          desc="Drop any CSV export from Xero, QuickBooks, SAP or bespoke ERPs. TaxIntel normalises chart-of-accounts mappings automatically, so you're never fighting with data formats."
          accent="#7C9EE8"
          points={['Supports all major ERP exports', 'Auto-maps account categories', 'Handles tens of thousands of rows instantly']}
        />

        <div className="h-px mx-auto max-w-xs" style={{ background: 'linear-gradient(90deg,transparent,#DDD6F3,transparent)' }} />

        <FeatureRow
          icon={ShieldCheck}
          tag="Risk intelligence"
          title="100+ rules. Zero manual checking."
          desc="Our proprietary engine runs every transaction through a library of tax rules — VAT mismatches, withholding tax omissions, thin capitalisation breaches — and quantifies the monetary exposure for each."
          accent="#9B8EC4"
          reverse
          points={['VAT, WHT, PAYE, CIT rules built in', 'Severity scoring for triage', 'Exposure estimated in UGX instantly']}
        />

        <div className="h-px mx-auto max-w-xs" style={{ background: 'linear-gradient(90deg,transparent,#C8E6D4,transparent)' }} />

        <FeatureRow
          icon={BarChart3}
          tag="Analytics & reporting"
          title="Insights your clients can act on."
          desc="Interactive dashboards let you see exposure by category, period, and severity. Generate a branded advisory report in one click — ready for your next client meeting."
          accent="#86B89F"
          points={['Beautiful, client-ready visualisations', 'One-click PDF/Word report export', 'Month-over-month trend analysis']}
        />

        <div className="h-px mx-auto max-w-xs" style={{ background: 'linear-gradient(90deg,transparent,#F2C4CE,transparent)' }} />

        <FeatureRow
          icon={Users}
          tag="Client management"
          title="Your entire portfolio in one place."
          desc="Manage every client engagement from a single, organised workspace. Role-based permissions mean junior staff see only what they need, while partners get the full picture."
          accent="#D4878F"
          reverse
          points={['Unlimited client entities', 'Role-based access per engagement', 'Full audit trail of all actions']}
        />
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Process</span>
            <h2 className="mt-3 text-4xl font-bold text-slate-800">From raw data to client value in three steps</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Upload transactions', desc: 'Drag in your client\'s CSV. We handle the rest — parsing, cleaning, categorising.', color: '#7C9EE8', bg: '#EEF3FD' },
              { step: '02', title: 'Review flagged risks', desc: 'Every risk is surfaced with its rule code, severity level, and estimated dollar exposure.', color: '#9B8EC4', bg: '#F3F0FB' },
              { step: '03', title: 'Deliver the report', desc: 'Generate a polished advisory report and share it directly with your client in minutes.', color: '#86B89F', bg: '#EEF7F1' },
            ].map((s, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className="rounded-3xl p-8 relative overflow-hidden"
                style={{ background: s.bg, border: `1px solid ${s.color}20` }}>
                <span className="text-6xl font-bold tracking-tighter mb-6 block" style={{ color: s.color, opacity: 0.18 }}>{s.step}</span>
                <TrendingUp className="w-8 h-8 mb-4" style={{ color: s.color }} strokeWidth={1.5} />
                <h3 className="text-xl font-bold text-slate-800 mb-3">{s.title}</h3>
                <p className="text-slate-500 leading-relaxed text-sm">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security strip ───────────────────────────────── */}
      <section className="py-12 px-6">
        <div className="max-w-5xl mx-auto rounded-3xl p-8"
          style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.06)', backdropFilter: 'blur(12px)' }}>
          <div className="flex flex-wrap items-center justify-center gap-10 text-slate-400">
            {[
              { icon: Lock, label: 'AES-256 encryption at rest' },
              { icon: ShieldCheck, label: 'SOC 2 Type II certified' },
              { icon: Zap, label: '99.9% uptime SLA' },
              { icon: Building2, label: 'Strict client data isolation' },
            ].map(({ icon: Icon, label }, i) => (
              <motion.div key={i}
                initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 text-sm font-medium">
                <Icon className="w-5 h-5 shrink-0" style={{ color: '#9B8EC4' }} strokeWidth={1.5} />
                {label}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="py-32 px-6 relative overflow-hidden">
        <Blob color="#DDD6F3" style={{ width: 500, height: 500, top: -80, right: -80, opacity: 0.5 }} />
        <Blob color="#C4D9F8" style={{ width: 400, height: 400, bottom: -60, left: -60, opacity: 0.4 }} />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-800 mb-6 leading-tight">
              Ready to elevate your<br />tax advisory practice?
            </h2>
            <p className="text-lg text-slate-400 mb-10 leading-relaxed">
              Join hundreds of firms already delivering faster, more accurate, and more profitable tax advisory services.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup"
                className="group flex items-center justify-center gap-2 px-8 py-4 rounded-full text-white font-semibold text-base transition-all duration-300 hover:-translate-y-1"
                style={{ background: 'linear-gradient(135deg,#7C9EE8,#9B8EC4)', boxShadow: '0 8px 28px rgba(124,158,232,0.35)' }}>
                Create your free account
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/login"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-full font-semibold text-base text-slate-700 transition-all duration-300 hover:bg-white"
                style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)', backdropFilter: 'blur(8px)' }}>
                Log into existing account
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="py-10 px-6 border-t border-black/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#7C9EE8,#9B8EC4)' }}>
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-600">TaxIntel</span>
          </div>
          <span>© {new Date().getFullYear()} TaxIntel. All rights reserved.</span>
          <div className="flex gap-6">
            {['Privacy', 'Terms', 'Security'].map(l => (
              <a key={l} href="#" className="hover:text-slate-600 transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
