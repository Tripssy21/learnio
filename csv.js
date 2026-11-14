/* Small shared CSV reader/writer. Imported values stay plain text; no formulas are evaluated. */
(function (root) {
  'use strict';
  function parse(input) {
    const text = String(input ?? '').replace(/^\uFEFF/, '');
    if (!text.length) return [];
    const rows = [];
    let row = [], field = '', quoted = false, closed = false;
    const cell = () => {
      if (row.length >= 100) throw Error('CSV rows may contain at most 100 columns.');
      row.push(field); field = ''; closed = false;
    };
    const line = () => {
      cell(); rows.push(row); row = [];
      if (rows.length > 5001) throw Error('CSV files may contain at most 5,000 data rows.');
    };
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { quoted = false; closed = true; }
        } else field += ch;
      } else if (ch === ',') cell();
      else if (ch === '\r' || ch === '\n') { line(); if (ch === '\r' && text[i + 1] === '\n') i++; }
      else if (closed) throw Error('Unexpected text after a quoted field in CSV row ' + (rows.length + 1) + '.');
      else if (ch === '"') {
        if (field.length) throw Error('Quote inside an unquoted field in CSV row ' + (rows.length + 1) + '.');
        quoted = true;
      } else field += ch;
      if (field.length > 50000) throw Error('A CSV field exceeds 50,000 characters.');
    }
    if (quoted) throw Error('A quoted CSV field was not closed.');
    if (field.length || closed || row.length || !/[\r\n]$/.test(text)) line();
    return rows;
  }
  function stringify(rows, options = {}) {
    if (!Array.isArray(rows)) throw Error('CSV export requires an array of rows.');
    return rows.map(row => {
      if (!Array.isArray(row)) throw Error('Each CSV row must be an array.');
      return row.map(value => {
        let text = String(value ?? '');
        if (options.formulaSafe !== false && typeof value !== 'number' && (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) text = "'" + text;
        return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
      }).join(',');
    }).join('\r\n');
  }
  const api = { parse, stringify };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.LearnioCSV = api;
})(typeof window !== 'undefined' ? window : globalThis);
