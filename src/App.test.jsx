import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  localStorage.clear();
});

describe('app shell', () => {
  test('renders the header and the games list on a cold start', async () => {
    render(<App />);

    expect(screen.getByText('Mystic Quest Tracker')).toBeInTheDocument();
    expect(await screen.findByText('Your Games')).toBeInTheDocument();
  });

  test('shows the empty state when there are no games', async () => {
    render(<App />);

    expect(await screen.findByText('No active games')).toBeInTheDocument();
    expect(screen.getByText('Active (0)')).toBeInTheDocument();
  });

  test('the map editor is gone', async () => {
    render(<App />);
    await screen.findByText('Your Games');

    expect(screen.queryByText('Map Editor')).not.toBeInTheDocument();
  });
});
