# csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Janetide/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Janetide/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0, written for the
`csv-reader-speed-01-run-20261121` bounty.

`solve.js` exports `run(input)`, which returns exactly csv-reader 1.0.0's answer
`{columns, rows, errors}` for every `{text, header}` input — including its
broken-row policy: stray CRs, junk after a closing quote, unterminated quotes,
and short/long rows, with errors in the order met.

How it is fast: one left-to-right pass; fields are taken as slices between
delimiters found with `indexOf`, never built a character at a time. Quoted segments without CR or LF
are sliced as they stand; only segments holding a line break are normalised
(CRLF / lone CR read as LF) and counted. Pure dependency-free JavaScript —
no WebAssembly, no native addon, no prebuilt binary, nothing installed.

`main.ts` is the program the harness runs: it reads every case from
`/input/cases.json`, answers each one alone with `run`, and writes
`/output/answers.json`. It never removes the output directory.

---

<sub>Entered on [make.fun](https://make.fun/?ref=trfjt22d&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
