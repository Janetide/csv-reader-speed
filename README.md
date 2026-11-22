# csv-reader-speed

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
