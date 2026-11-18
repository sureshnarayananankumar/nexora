import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { AuthResponse } from '../api/types';
import { useAuth } from '../stores/auth';
import { useUi } from '../stores/ui';
import { usePublicConfig } from '../api/queries';
import { Field, Logo, Spinner } from '../components/ui';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'At least 2 characters').max(120),
  organizationName: z.string().trim().min(2, 'At least 2 characters').max(120),
  email: z.string().trim().email('Enter a valid email').max(190),
  password: z.string().regex(/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/, '8–72 characters with at least one letter and one number'),
});

// Demo accounts exist only when the API seeds local development data.
const DEMO = ['sarah@acme.dev', 'rahul@acme.dev', 'mei@acme.dev'];
const showDemo = import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname);

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="aurora" aria-hidden />
      <section className="auth-brand">
        <Link to="/" className="brand" style={{ color: 'inherit', textDecoration: 'none' }}><Logo /> NEXORA</Link>
        <div>
          <h1 className="auth-quote">Plan less.<br /><span className="grad-text">Deliver more.</span></h1>
          <ul className="auth-points">
            {['Health scores that explain themselves', 'Automations you can see and test', 'Live boards your whole team shares'].map((t) => (
              <li key={t}><CheckCircle2 size={16} /> {t}</li>
            ))}
          </ul>
        </div>
        <span className="small subtle"><Lock size={12} /> Refresh tokens are HttpOnly, rotated and revocable.</span>
      </section>
      <section className="auth-form-wrap">{children}</section>
    </div>
  );
}

export function LoginPage() {
  const status = useAuth((s) => s.status);
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  if (status === 'authenticated') return <Navigate to={from} replace />;

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const res = await api<AuthResponse>('/auth/login', { method: 'POST', json: v });
      useAuth.getState().setSession(res.accessToken, res.user);
      if (res.user.theme) useUi.getState().setTheme(res.user.theme);
      navigate(from, { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Login failed. Try again.');
    }
  });

  return (
    <AuthLayout>
      <form className="auth-card card" onSubmit={onSubmit} noValidate>
        <h2>Welcome back</h2>
        <p className="muted" style={{ marginTop: 6 }}>Log in to your workspace.</p>
        {error && <div className="alert alert-danger" role="alert" style={{ marginTop: 18 }}>{error}</div>}
        <div className="stack" style={{ marginTop: 20 }}>
          <Field label="Work email" error={errors.email?.message} htmlFor="email">
            <input id="email" className="input" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
          </Field>
          <Field label="Password" error={errors.password?.message} htmlFor="password">
            <input id="password" className="input" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
          </Field>
          <button className="btn btn-primary btn-lg" disabled={isSubmitting}>{isSubmitting ? <Spinner size={16} /> : <>Log in <ArrowRight /></>}</button>
        </div>
        <p className="small muted" style={{ marginTop: 18 }}>New to NEXORA? <Link to="/register">Create a workspace</Link></p>
        {showDemo && (
          <div className="demo-box">
            <div className="tiny subtle strong">LOCAL DEMO ACCOUNTS</div>
            <div className="row wrap" style={{ marginTop: 8 }}>
              {DEMO.map((email) => (
                <button type="button" key={email} className="btn btn-sm" onClick={() => setValue('email', email, { shouldValidate: true })}>{email}</button>
              ))}
            </div>
            <div className="tiny subtle" style={{ marginTop: 8 }}>Password: the <code>NEXORA_DEMO_PASSWORD</code> from your <code>.env</code>.</div>
          </div>
        )}
      </form>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const status = useAuth((s) => s.status);
  const navigate = useNavigate();
  const { data: config } = usePublicConfig();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });

  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const res = await api<AuthResponse>('/auth/register', { method: 'POST', json: v });
      useAuth.getState().setSession(res.accessToken, res.user);
      navigate('/dashboard', { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'EMAIL_TAKEN') setFieldError('email', { message: e.message });
      else if (e instanceof ApiError && e.fieldErrors.length) e.fieldErrors.forEach((f) => setFieldError(f.field as never, { message: f.message }));
      else setError(e instanceof ApiError ? e.message : 'Sign-up failed. Try again.');
    }
  });

  return (
    <AuthLayout>
      <form className="auth-card card" onSubmit={onSubmit} noValidate>
        <h2>Create your workspace</h2>
        <p className="muted" style={{ marginTop: 6 }}>Free Starter plan · up to 5 people and 3 projects.</p>
        {config && !config.registrationEnabled && <div className="alert alert-warning" style={{ marginTop: 18 }}>New sign-ups are paused right now.</div>}
        {error && <div className="alert alert-danger" role="alert" style={{ marginTop: 18 }}>{error}</div>}
        <div className="stack" style={{ marginTop: 20 }}>
          <div className="grid-2">
            <Field label="Your name" error={errors.fullName?.message} htmlFor="fullName">
              <input id="fullName" className="input" autoComplete="name" aria-invalid={!!errors.fullName} {...register('fullName')} />
            </Field>
            <Field label="Organisation" error={errors.organizationName?.message} htmlFor="org">
              <input id="org" className="input" autoComplete="organization" aria-invalid={!!errors.organizationName} {...register('organizationName')} />
            </Field>
          </div>
          <Field label="Work email" error={errors.email?.message} htmlFor="remail">
            <input id="remail" className="input" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
          </Field>
          <Field label="Password" error={errors.password?.message} hint="8+ characters with a letter and a number" htmlFor="rpass">
            <input id="rpass" className="input" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
          </Field>
          <button className="btn btn-primary btn-lg" disabled={isSubmitting || config?.registrationEnabled === false}>
            {isSubmitting ? <Spinner size={16} /> : <>Create workspace <ArrowRight /></>}
          </button>
        </div>
        <p className="small muted" style={{ marginTop: 18 }}>Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </AuthLayout>
  );
}
