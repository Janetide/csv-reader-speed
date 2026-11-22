// A faster drop-in for make.fun's own csv-reader 1.0.0: run(input) returns exactly
// csv-reader's answer {columns, rows, errors} for every {text, header} input, read in
// one left-to-right pass. Fields are taken as slices between delimiters found with
// indexOf, never built a character at a time; quoted segments without CR or LF are
// sliced as they stand, and only a segment holding a line break is normalised (CRLF
// and a lone CR each read as one LF) and counted. Pure dependency-free JavaScript.

/** Delimiters are found with indexOf, not a regex: two memchr-fast scans that each
 * stop at the next comma or LF. (A sticky regex only tests the character at
 * lastIndex; a global one pays the regex engine's setup on every field.) */
const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The slice text[a..b] of a quoted field, with CRLF and a lone CR each read as one
  // LF; counts its line breaks into `line`.
  function takeSegment(a, b) {
    if (b === a) return '';
    const seg = text.slice(a, b);
    if (seg.indexOf('\n') === -1 && seg.indexOf('\r') === -1) return seg;
    const norm = seg.replace(/\r\n?/g, '\n');
    let breaks = 0;
    let j = norm.indexOf('\n');
    while (j !== -1) {
      breaks += 1;
      j = norm.indexOf('\n', j + 1);
    }
    line += breaks;
    return norm;
  }

  // Reads an unquoted field from pos, starting from the kept string `head` ('' for a
  // fresh field, the quoted value for junk after a closing quote, '"' for a quote
  // that never closed). Returns [value, ended, added]: `added` counts the characters
  // kept here, so a stray CR dropped on the way counts for nothing.
  function readUnquoted(head) {
    let added = 0;
    let chunks = null; // [head, ...flushed slices] once a stray CR forces a split
    let start = pos;
    for (;;) {
      const iComma = text.indexOf(',', pos);
      const iLF = text.indexOf('\n', pos);
      let i = -1;
      let kind = -1; // 0 comma, 1 LF, -1 EOF
      if (iComma !== -1 && (iLF === -1 || iComma < iLF)) { i = iComma; kind = 0; }
      else if (iLF !== -1) { i = iLF; kind = 1; }
      else { i = n; kind = -1; }
      const seg = text.slice(start, i);
      const cr = seg.indexOf('\r');
      if (cr !== -1 && !(kind === 1 && cr === seg.length - 1)) {
        // A CR not followed by LF is dropped (stray_cr); the field goes on.
        if (chunks === null) chunks = [head];
        chunks.push(seg.slice(0, cr));
        added += cr;
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        pos = start + cr + 1;
        start = pos;
        continue;
      }
      if (kind === 0) {
        added += seg.length;
        pos = i + 1;
        return [chunks === null ? head + seg : chunks.join('') + seg, COMMA, added];
      }
      if (kind === 1) {
        // A CR right before the LF is the CRLF line break, not part of the field.
        const val = cr === seg.length - 1 ? seg.slice(0, seg.length - 1) : seg;
        added += val.length;
        pos = i + 1;
        line += 1;
        return [chunks === null ? head + val : chunks.join('') + val, LINE_BREAK, added];
      }
      added += seg.length;
      pos = n;
      return [chunks === null ? head + seg : chunks.join('') + seg, END, added];
    }
  }

  // Reads a quoted field whose opening quote is at pos. Returns [value, ended].
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    pos += 1;
    let segStart = pos;
    for (;;) {
      const q = text.indexOf('"', pos);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text after it
        // is read again as an unquoted field.
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        return readUnquoted('"').slice(0, 2);
      }
      if (q + 1 < n && text.charCodeAt(q + 1) === 34) {
        // A doubled quote is one literal quote.
        value += takeSegment(segStart, q) + '"';
        pos = q + 2;
        segStart = pos;
        continue;
      }
      // The closing quote.
      value += takeSegment(segStart, q);
      pos = q + 1;
      break;
    }
    if (pos >= n) return [value, END];
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      return [value, COMMA];
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      return [value, LINE_BREAK];
    }
    if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      return [value, LINE_BREAK];
    }
    // What follows the closing quote is appended as it stands, up to the next comma
    // or line break; junk counts only when it kept a character.
    const junk = readUnquoted(value);
    if (junk[2] > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    return junk.slice(0, 2);
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let ended;
    let quoted = false;
    do {
      quoted = pos < n && text.charCodeAt(pos) === 34;
      const field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field[0]);
      ended = field[1];
    } while (ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its
    // stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.slice(width) });
      fields.length = width;
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
