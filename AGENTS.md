# Working in cresco

A skill-demand radar that tells you what to learn next — and where to learn it free.

## Run the tests

You need Node 22 or newer.

```bash
npm ci
npm run typecheck
npm test
```

Every test should pass before you start and after you finish.

## Where things are

- `src/`: the code
- `server/`: the server code
- `test/`: the tests
- `fixtures/`: sample input the tests use
- `docs/`: written documentation
- `scripts/`: helper scripts, not part of the tool itself
- `data/`: data files the code reads
- `skills/`: agent skills

## Before you commit

- Make sure the tests pass.
- Put changes people will notice in `CHANGELOG.md`.
- Do not put real passwords, keys or private data in test files or examples. Use made-up ones.
