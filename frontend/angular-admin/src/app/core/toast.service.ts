import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { ApiErrorBody } from './models';

export interface Toast { id: number; tone: 'success' | 'error' | 'info'; text: string }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private next = 1;

  show(tone: Toast['tone'], text: string): void {
    const id = this.next++;
    this.toasts.update((t) => [...t, { id, tone, text }].slice(-4));
    setTimeout(() => this.dismiss(id), tone === 'error' ? 7000 : 4000);
  }

  success(text: string) { this.show('success', text); }
  error(err: unknown, fallback = 'Something went wrong') { this.show('error', errorText(err, fallback)); }
  dismiss(id: number) { this.toasts.update((t) => t.filter((x) => x.id !== id)); }
}

export function errorText(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as ApiErrorBody | null;
    if (body?.fieldErrors?.length) return body.fieldErrors.map((f) => `${f.field}: ${f.message}`).join(' · ');
    if (body?.message) return body.message;
    if (err.status === 0) return 'Can’t reach the API';
  }
  return fallback;
}
