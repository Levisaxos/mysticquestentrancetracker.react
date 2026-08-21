import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Footer from './Footer';

describe('build stamp', () => {
  // These come from `define` in vite.config.mjs. If that wiring breaks the
  // footer would quietly show placeholders, and a deployed build would be
  // indistinguishable from any other.
  test('shows a real version rather than the fallback', () => {
    render(<Footer />);
    expect(screen.getByText(/^v\d+\.\d+\.\d+ · /)).toBeInTheDocument();
    expect(screen.queryByText(/v0\.0\.0/)).not.toBeInTheDocument();
  });

  test('shows a parsed build date, not "unknown"', () => {
    render(<Footer />);
    expect(screen.getByText(/^built /).textContent).not.toMatch(/unknown/);
  });
});

describe('about panel', () => {
  test('stays collapsed until asked for', () => {
    render(<Footer />);
    expect(screen.queryByText(/Not affiliated with/)).not.toBeInTheDocument();
  });

  test('names the trademark holder and disclaims affiliation', () => {
    render(<Footer />);
    fireEvent.click(screen.getByText('About & credits'));

    expect(screen.getByText(/Not affiliated with, endorsed by/)).toBeInTheDocument();
    expect(screen.getByText(/Square Enix Holdings/)).toBeInTheDocument();
  });

  test('credits the upstream data sources', () => {
    render(<Footer />);
    fireEvent.click(screen.getByText('About & credits'));

    expect(screen.getByRole('link', { name: 'FFMQRando' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Archipelago' })).toBeInTheDocument();
  });

  test('says where the data lives, since local storage is the only copy', () => {
    render(<Footer />);
    fireEvent.click(screen.getByText('About & credits'));

    expect(screen.getByText(/Your data stays on this device/)).toBeInTheDocument();
    expect(screen.getByText(/use Export to keep a copy/)).toBeInTheDocument();
  });

  test('external links do not leak the referrer', () => {
    render(<Footer />);
    fireEvent.click(screen.getByText('About & credits'));

    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('rel')).toMatch(/noopener/);
      expect(link.getAttribute('target')).toBe('_blank');
    }
  });
});
