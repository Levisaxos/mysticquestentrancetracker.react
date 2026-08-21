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

describe('about dialog', () => {
  test('stays closed until asked for', () => {
    render(<Footer />);
    expect(screen.queryByText(/Not affiliated with/)).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('opens as a dialog rather than unfolding the footer', () => {
    render(<Footer />);
    fireEvent.click(screen.getByText('About & credits'));

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  test('closes on Escape', () => {
    render(<Footer />);
    fireEvent.click(screen.getByText('About & credits'));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Someone weighing whether to trust this deserves to know how it was built.
  test('says how it was written', () => {
    render(<Footer />);
    fireEvent.click(screen.getByText('About & credits'));

    expect(screen.getByText(/Vibe coded with Claude Code/)).toBeInTheDocument();
    expect(screen.getByText(/not audited software/)).toBeInTheDocument();
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
