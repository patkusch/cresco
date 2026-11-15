# Changelog

What changed and when, newest first. This project does not have numbered releases, so the entries are grouped by month.

## 2026-10 and 2026-11

- Dashboard remembers the retest result and shows every leading indicator's latest test.
- A monthly refresh command (`npm run refresh`).
- A test suite covering sources, the market data, the HTTP helper and more (265 tests).

## 2026-09

- The GitHub collector rotates across several tokens and says why a request retries.
- Conference programme history for 17 skills, to test whether talks lead hiring. They come closest, and still do not: the sixth candidate indicator is refuted.
- The README says SEC EDGAR was tested.

## 2026-08

- First version: a skill-demand radar where every prediction is written down with a date and later graded.
- Real hiring history replaced the synthetic data, growing to six years. It killed the earlier leading-indicator finding, and the README says so.
- A walk-forward backtest, with the hit rates it produced published.
- Expanded to 64 skills; fixed nine silent failures found by an audit, including a wrong published number.
- A wider skill set broke half the headline claim, so the "Receding" verdict was demoted.
- A test suite, which found and fixed a shared-array bug. The dashboard is published as a static site on GitHub Pages.
