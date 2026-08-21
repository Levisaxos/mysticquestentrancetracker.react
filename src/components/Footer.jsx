import React, { useState, useEffect } from 'react';

// Stamped in at build time by vite.config.mjs.
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
const BUILD_DATE = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : null;
const COMMIT = typeof __COMMIT_HASH__ === 'string' ? __COMMIT_HASH__ : 'unknown';

const REPO = 'https://github.com/Levisaxos/mysticquestentrancetracker.react';

function formatBuildDate(iso) {
  if (!iso) return 'unknown';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';

  // The reader's own locale and timezone: a build stamp is only useful if you
  // can tell at a glance whether it is the one you just pushed.
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

const Outbound = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer noopener"
    className="text-slate-300 hover:text-white underline decoration-dotted"
  >
    {children}
  </a>
);

/**
 * The disclaimer, credits and privacy note.
 *
 * A dialog rather than a panel unfolding out of the footer: this is the text
 * someone reads once, deliberately, and it is long enough that expanding it in
 * place shoved the tracker around and left the reader scrolled to the wrong
 * part of the page.
 */
function AboutModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        className="bg-slate-800 rounded-lg border border-slate-600 w-full max-w-2xl max-h-full flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="About and credits"
      >
        <div className="px-6 py-4 border-b border-slate-600 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">About &amp; credits</h2>
            <p className="text-sm text-slate-400">
              Mystic Quest Entrance Tracker · v{VERSION} · {COMMIT}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            Close (Esc)
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 text-sm text-slate-400 leading-relaxed">
          <p>
            An unofficial fan-made tracker for the{' '}
            <Outbound href="https://www.ffmqrando.net/">
              Final Fantasy Mystic Quest randomizer
            </Outbound>
            . Not affiliated with, endorsed by, or connected to Square Enix.
            <em> Final Fantasy</em> and <em>Final Fantasy Mystic Quest</em> are
            trademarks of Square Enix Holdings Co., Ltd. Game maps and sprites
            remain the property of their respective owners and are used here for
            identification in a non-commercial fan tool.
          </p>

          <p>
            Game logic, room data and shuffle rules are derived from{' '}
            <Outbound href="https://github.com/wildham0/FFMQRando">FFMQRando</Outbound>{' '}
            (MIT, © wildham) by way of the{' '}
            <Outbound href="https://github.com/ArchipelagoMW/Archipelago">Archipelago</Outbound>{' '}
            Final Fantasy Mystic Quest world.
          </p>

          <p>
            <span className="text-slate-300">Vibe coded with Claude Code.</span>{' '}
            Most of this was written by an AI assistant from conversation rather
            than typed by hand. It is a hobby project built for fun, not audited
            software — which is worth knowing before you rely on it for anything.
          </p>

          <p>
            <span className="text-slate-300">Your data stays on this device.</span>{' '}
            Runs are saved in your browser&apos;s local storage — nothing is sent
            anywhere, there is no account and no analytics. Clearing your browser
            data will delete your runs, so use Export to keep a copy. Connecting to
            Archipelago talks only to the server you name, and the tracker only
            listens; it never sends checks on your behalf.
          </p>

          <p className="text-slate-500">
            Provided as-is, with no warranty of any kind. Tracking is a convenience,
            not a guarantee — always trust the game over the tracker.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Footer() {
  const [showAbout, setShowAbout] = useState(false);

  return (
    <footer className="shrink-0 border-t border-slate-800 bg-slate-900/60 px-4 py-2 text-[11px] text-slate-500">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-slate-400">Mystic Quest Entrance Tracker</span>
          <span title={`Commit ${COMMIT}`}>
            v{VERSION} · {COMMIT}
          </span>
          <span title={BUILD_DATE ?? undefined}>
            built {formatBuildDate(BUILD_DATE)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-slate-300 underline decoration-dotted"
          >
            Source
          </a>
          <button
            onClick={() => setShowAbout(true)}
            className="hover:text-slate-300 underline decoration-dotted"
          >
            About &amp; credits
          </button>
        </div>
      </div>

      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />
    </footer>
  );
}
