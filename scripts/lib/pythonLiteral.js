// Minimal parser for the Python literal expressions used in the Archipelago
// FFMQ data files.
//
// Naive find-and-replace does not work here: the data contains apostrophes
// inside double-quoted strings ("Kaeli's House", "Pazuzu's Tower",
// "GrenadeMan's House"), so swapping quote characters corrupts it. This walks
// the source properly instead.
//
// Supports: dicts, lists, tuples, strings (both quote styles, with escapes),
// integers, floats, True/False/None, and # comments between tokens.

class Parser {
  constructor(src) {
    this.src = src;
    this.i = 0;
  }

  error(message) {
    const line = this.src.slice(0, this.i).split('\n').length;
    const near = this.src.slice(Math.max(0, this.i - 40), this.i + 40).replace(/\n/g, ' ');
    return new Error(`${message} at line ${line} near: …${near}…`);
  }

  skipTrivia() {
    for (;;) {
      while (this.i < this.src.length && /\s/.test(this.src[this.i])) this.i++;
      if (this.src[this.i] === '#') {
        while (this.i < this.src.length && this.src[this.i] !== '\n') this.i++;
        continue;
      }
      return;
    }
  }

  peek() {
    this.skipTrivia();
    return this.src[this.i];
  }

  expect(ch) {
    if (this.peek() !== ch) throw this.error(`expected '${ch}'`);
    this.i++;
  }

  parseValue() {
    const ch = this.peek();
    if (ch === undefined) throw this.error('unexpected end of input');
    if (ch === '{') return this.parseDict();
    if (ch === '[') return this.parseSequence(']');
    if (ch === '(') return this.parseSequence(')');
    if (ch === '"' || ch === "'") return this.parseString();
    return this.parseAtom();
  }

  parseString() {
    const quote = this.src[this.i];
    this.i++;
    let out = '';

    while (this.i < this.src.length) {
      const ch = this.src[this.i];

      if (ch === '\\') {
        const next = this.src[this.i + 1];
        const simple = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', 0: '\0' };
        if (next in simple) {
          out += simple[next];
          this.i += 2;
          continue;
        }
        if (next === 'x') {
          out += String.fromCharCode(parseInt(this.src.substr(this.i + 2, 2), 16));
          this.i += 4;
          continue;
        }
        if (next === 'u') {
          out += String.fromCharCode(parseInt(this.src.substr(this.i + 2, 4), 16));
          this.i += 6;
          continue;
        }
        out += next;
        this.i += 2;
        continue;
      }

      if (ch === quote) {
        this.i++;
        return out;
      }

      out += ch;
      this.i++;
    }

    throw this.error('unterminated string');
  }

  parseAtom() {
    const start = this.i;
    while (this.i < this.src.length && /[A-Za-z0-9_+\-.]/.test(this.src[this.i])) this.i++;
    const raw = this.src.slice(start, this.i);

    if (raw === 'True') return true;
    if (raw === 'False') return false;
    if (raw === 'None') return null;
    if (/^[+-]?\d+$/.test(raw)) return parseInt(raw, 10);
    if (/^[+-]?(\d+\.\d*|\.\d+|\d+)(e[+-]?\d+)?$/i.test(raw)) return parseFloat(raw);

    throw this.error(`unrecognised token '${raw}'`);
  }

  parseSequence(close) {
    this.i++; // opening bracket
    const out = [];

    for (;;) {
      if (this.peek() === close) {
        this.i++;
        return out;
      }
      out.push(this.parseValue());

      if (this.peek() === ',') {
        this.i++;
        continue;
      }
      if (this.peek() === close) {
        this.i++;
        return out;
      }
      throw this.error(`expected ',' or '${close}'`);
    }
  }

  parseDict() {
    this.i++; // '{'
    const out = {};

    for (;;) {
      if (this.peek() === '}') {
        this.i++;
        return out;
      }

      const key = this.parseValue();
      this.expect(':');
      out[String(key)] = this.parseValue();

      if (this.peek() === ',') {
        this.i++;
        continue;
      }
      if (this.peek() === '}') {
        this.i++;
        return out;
      }
      throw this.error("expected ',' or '}'");
    }
  }
}

/** Parse a single Python literal expression. */
export function parsePythonLiteral(src) {
  const parser = new Parser(src);
  const value = parser.parseValue();
  parser.skipTrivia();
  if (parser.i < parser.src.length) throw parser.error('trailing content after literal');
  return value;
}

/**
 * Pull `name = <literal>` out of a Python module, by finding the assignment and
 * parsing forward from it. Tolerates other content in the file.
 */
export function extractAssignment(source, name) {
  const match = new RegExp(`^${name}\\s*=\\s*`, 'm').exec(source);
  if (!match) throw new Error(`no top-level assignment named '${name}' found`);

  const parser = new Parser(source);
  parser.i = match.index + match[0].length;
  return parser.parseValue();
}
