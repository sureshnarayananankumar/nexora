import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ChartComponent } from '../shared/chart.component';
import { AgoPipe } from '../shared/ui';
import { LoginComponent } from '../features/login/login.component';

describe('shared UI', () => {
  it('renders one bar per value per series', () => {
    const f = TestBed.createComponent(ChartComponent);
    f.componentRef.setInput('labels', ['a', 'b', 'c']);
    f.componentRef.setInput('series', [{ name: 'x', color: '#000', values: [1, 2, 3] }, { name: 'y', color: '#fff', values: [3, 2, 1] }]);
    f.detectChanges();
    const bars = (f.nativeElement as HTMLElement).querySelectorAll('rect[rx]');
    expect(bars.length).toBe(6);
    expect((f.nativeElement as HTMLElement).textContent).toContain('x');
  });

  it('formats relative times', () => {
    const pipe = new AgoPipe();
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(new Date(Date.now() - 3 * 3600_000).toISOString())).toBe('3 h ago');
    expect(pipe.transform(new Date(Date.now() - 2 * 86_400_000).toISOString())).toBe('2 d ago');
  });
});

describe('LoginComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] }));

  it('validates the reactive form before submitting', () => {
    const f = TestBed.createComponent(LoginComponent);
    f.detectChanges();
    f.componentInstance.submit();
    f.detectChanges();
    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Enter a valid email');
    expect(text).toContain('Enter your password');
    expect(f.componentInstance.form.valid).toBeFalse();
  });
});
