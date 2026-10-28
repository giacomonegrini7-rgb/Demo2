import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { AlertCircle, ChevronDown, Info, Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'quiet';

const base = 'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,box-shadow,transform,color] duration-150 select-none disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.985] min-h-11 text-[0.975rem]';
const variants: Record<Variant, string> = {
  primary: 'bg-petrol text-white px-6 py-3 shadow-[0_6px_16px_-8px_rgb(15_82_76/0.7)] hover:bg-petrol-dark',
  secondary: 'bg-white text-ink px-5 py-3 border border-line hover:border-ink/40 hover:bg-sand/40',
  ghost: 'text-petrol px-3 py-2 hover:bg-petrol-tint',
  quiet: 'text-ink-soft underline decoration-line underline-offset-4 hover:decoration-ink px-1 py-2 font-medium rounded-md',
};

export function buttonClass(variant: Variant = 'primary', extra = '') {
  return `${base} ${variants[variant]} ${extra}`;
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; icon?: ReactNode }>(
  function Button({ variant = 'primary', loading, icon, className = '', children, disabled, ...rest }, ref) {
    return (
      <button ref={ref} className={buttonClass(variant, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
        <span>{children}</span>
      </button>
    );
  },
);

export function LinkButton({ variant = 'primary', className = '', icon, children, ...rest }: LinkProps & { variant?: Variant; icon?: ReactNode }) {
  return (
    <Link className={buttonClass(variant, className)} {...rest}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}

export function Card({ children, className = '', as: As = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' | 'aside' }) {
  return <As className={`rounded-[var(--radius-card)] border border-line/80 bg-white shadow-[var(--shadow-soft)] ${className}`}>{children}</As>;
}

export function Notice({ children, tone = 'info', className = '', icon }: { children: ReactNode; tone?: 'info' | 'petrol' | 'warm'; className?: string; icon?: ReactNode }) {
  const tones = {
    info: 'bg-sand/70 border-line text-ink',
    petrol: 'bg-petrol-tint border-petrol/25 text-ink',
    warm: 'bg-terracotta-tint border-terracotta/30 text-ink',
  };
  return (
    <div className={`flex gap-3 rounded-2xl border px-4 py-3 text-[0.94rem] leading-relaxed ${tones[tone]} ${className}`}>
      <span className="mt-0.5 shrink-0 text-petrol" aria-hidden>{icon ?? <Info className="size-[1.1rem]" />}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function ErrorBox({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div id={id} role="alert" className="flex flex-col gap-3 rounded-2xl border border-danger/30 bg-danger-tint px-4 py-3 text-[0.95rem] text-danger sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 size-[1.1rem] shrink-0" aria-hidden />
        <div>{children}</div>
      </div>
      {action}
    </div>
  );
}

export function Expandable({ summary, children, className = '' }: { summary: ReactNode; children: ReactNode; className?: string }) {
  return (
    <details className={`group rounded-2xl border border-line/80 bg-white/60 ${className}`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-[0.94rem] font-medium text-ink-soft [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="px-4 pb-4 text-[0.94rem] leading-relaxed text-muted">{children}</div>
    </details>
  );
}

export function Pill({ children, tone = 'neutral', className = '' }: { children: ReactNode; tone?: 'neutral' | 'petrol' | 'warm' | 'dark'; className?: string }) {
  const tones = {
    neutral: 'bg-sand text-ink-soft',
    petrol: 'bg-petrol-tint text-petrol-dark',
    warm: 'bg-terracotta-tint text-terracotta-text',
    dark: 'bg-ink text-white',
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ${tones[tone]} ${className}`}>{children}</span>;
}

export function SectionTitle({ children, eyebrow, id }: { children: ReactNode; eyebrow?: ReactNode; id?: string }) {
  return (
    <div className="mb-3">
      {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-terracotta-text">{eyebrow}</p>}
      <h2 id={id} className="text-[1.35rem] leading-tight font-medium text-ink sm:text-2xl">{children}</h2>
    </div>
  );
}

export function PageHeading({ children, eyebrow, lead }: { children: ReactNode; eyebrow?: ReactNode; lead?: ReactNode }) {
  return (
    <header className="mb-6 sm:mb-8">
      {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-terracotta-text">{eyebrow}</p>}
      <h1 tabIndex={-1} data-page-heading className="text-[2rem] leading-[1.08] font-medium text-ink outline-none sm:text-[2.6rem]">{children}</h1>
      {lead && <p className="mt-3 max-w-2xl text-[1.05rem] leading-relaxed text-muted">{lead}</p>}
    </header>
  );
}
