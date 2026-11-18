import { Injectable, effect, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly dark = signal<boolean>(this.initial());

  constructor() {
    effect(() => {
      const dark = this.dark();
      document.documentElement.dataset['theme'] = dark ? 'dark' : 'light';
      try { localStorage.setItem('nexora-admin-theme', dark ? 'dark' : 'light'); } catch { /* storage unavailable */ }
    });
  }

  toggle(): void { this.dark.update((d) => !d); }

  private initial(): boolean {
    try {
      const saved = localStorage.getItem('nexora-admin-theme');
      if (saved) return saved === 'dark';
    } catch { /* storage unavailable */ }
    return true;
  }
}
