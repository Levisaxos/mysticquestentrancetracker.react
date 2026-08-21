import React, { useState } from 'react';

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

export default function Footer() {
  const [showDetail, setShowDetail] = useState(false);

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
            onClick={() => setShowDetail((open) => !open)}
            className="hover:text-slate-300 underline decoration-dotted"
            aria-expanded={showDetail}
          >
            {showDetail ? 'Hide details' : 'About & credits'}
          </button>
        </div>
      </div>

      {showDetail && (
        <div className="mt-2 pt-2 border-t border-slate-800 space-y-2 max-w-4xl leading-relaxed">
          <p>
            An unofficial fan-made tracker for the{' '}
            <a
              href="https://www.ffmqrando.net/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-slate-400 hover:text-slate-300 underline decoration-dotted"
            >
              Final Fantasy Mystic Quest randomizer
            </a>
            . Not affiliated with, endorsed by, or connected to Square Enix.
            <em> Final Fantasy</em> and <em>Final Fantasy Mystic Quest</em> are
            trademarks of Square Enix Holdings Co., Ltd. Game maps and sprites
            remain the property of their respective owners and are used here for
            identification in a non-commercial fan tool.
          </p>

          <p>
            Game logic, room data and shuffle rules are derived from{' '}
            <a
              href="https://github.com/wildham0/FFMQRando"
              target="_blank"
              rel="noreferrer noopener"
              className="text-slate-400 hover:text-slate-300 underline decoration-dotted"
            >
              FFMQRando
            </a>{' '}
            (MIT, © wildham) by way of the{' '}
            <a
              href="https://github.com/ArchipelagoMW/Archipelago"
              target="_blank"
              rel="noreferrer noopener"
              className="text-slate-400 hover:text-slate-300 underline decoration-dotted"
            >
              Archipelago
            </a>{' '}
            Final Fantasy Mystic Quest world.
          </p>

          <p>
            <span className="text-slate-400">Your data stays on this device.</span>{' '}
            Runs are saved in your browser&apos;s local storage — nothing is sent
            anywhere, there is no account and no analytics. Clearing your browser
            data will delete your runs, so use Export to keep a copy. Connecting to
            Archipelago talks only to the server you name, and the tracker only
            listens; it never sends checks on your behalf.
          </p>

          <p className="text-slate-600">
            Provided as-is, with no warranty of any kind. Tracking is a convenience,
            not a guarantee — always trust the game over the tracker.
          </p>
        </div>
      )}
    </footer>
  );
}
