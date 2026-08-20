# Mystic Quest Entrance Tracker

An entrance tracker for the **Final Fantasy Mystic Quest randomizer** ([FFMQR](https://www.ffmqrando.net/)).

Link the entrances you discover as you explore, tick off chests and boxes, and
keep track of where each door actually goes across all 121 maps.

**It is a plain static site**: React, JSON data, and your browser's localStorage.
No backend, no database, no account, no API calls at runtime. Once loaded it
works offline.

## Status

Early. The entrance tracking works end to end; item tracking, logic and
Archipelago auto-tracking are planned. See [docs/PLAN.md](docs/PLAN.md) for the
roadmap and [docs/STATUS.md](docs/STATUS.md) for an honest account of what does
and doesn't work today.

## Running it locally

```bash
npm install
npm run dev
```

| script | what it does |
|---|---|
| `npm run dev` | dev server on http://localhost:3000 |
| `npm run build` | production build into `build/` |
| `npm run preview` | serve the production build locally |
| `npm test` | tests in watch mode |
| `npm run test:ci` | tests once, for CI |

## Deploying

Pushing to `master` builds and publishes to GitHub Pages automatically
(`.github/workflows/deploy.yml`). The workflow runs the tests first and won't
publish a failing build.

The site is served from a sub-path, so `vite.config.mjs` sets `base` to the repo
name. Deploying somewhere else — a custom domain, say — means overriding it:

```bash
VITE_BASE=/ npm run build
```

Anything that renders an image from our data files must go through
`assetUrl()` in [src/utils/assetUrl.js](src/utils/assetUrl.js), or it will 404
under the sub-path.

## Your data

Everything lives in your browser's localStorage. That means:

- it is per-browser and per-machine — nothing syncs
- clearing site data destroys your runs
- **Export is the only backup.** Use the Export button and keep the file.

## Archipelago auto-tracking (planned)

The tracker will connect to an Archipelago room as a read-only tracker to fill
in items and checks automatically. Entrances always stay manual — discovering
them is the point.

Connection support:

| setup | works? |
|---|---|
| Rooms hosted on archipelago.gg | ✅ |
| Self-hosted on `localhost` | ✅ — loopback is exempt from mixed-content rules |
| Self-hosted on a LAN or remote address | needs `wss://`, via `MultiServer.py --cert ... --cert_key ...` |

Auto-tracking requires Archipelago. A plain (non-AP) FFMQR seed can only be
tracked manually, because a browser cannot read your emulator's memory.

## Credits

- Game data, logic rules and shuffle constraints come from
  [FFMQRando](https://github.com/wildham0/FFMQRando) (MIT) by wildham, via the
  [Archipelago](https://github.com/ArchipelagoMW/Archipelago) FFMQ world.
- Final Fantasy Mystic Quest is © Square Enix. This is an unofficial fan tool.
