import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from '../pages/AuthPages';
import { useAuth } from '../stores/auth';

function renderLogin() {
  useAuth.setState({ status: 'anonymous', token: null, user: null });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><LoginPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('LoginPage', () => {
  it('validates fields before calling the API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText('Enter your email')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows the server message on bad credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 'UNAUTHORIZED', message: 'Email or password is incorrect' }), { status: 401 }));
    renderLogin();
    await userEvent.type(screen.getByLabelText('Work email'), 'sarah@acme.dev');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-pass1');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
  });
});
