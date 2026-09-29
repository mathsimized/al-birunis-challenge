/* Al-Biruni\'s Challenge 2026 — shared utilities
   No build step: this is plain ES5-compatible JavaScript with small helpers
   used across the public site, student portal and admin panel. */

(function (global) {
  'use strict';

  /* ---------- text ---------- */
  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function slug(text) {
    return String(text || '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function titleCase(text) {
    return String(text || '').replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1));
  }

  function trunc(text, max) {
    const s = String(text || '');
    const n = max || 120;
    return s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, '');
  }

  /* ---------- dates ---------- */
  function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  function fmtDate(value) {
    const d = toDate(value);
    if (!d) return '—';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtDateTime(value) {
    const d = toDate(value);
    if (!d) return '—';
    return d.toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function fmtTime(value) {
    const d = toDate(value);
    if (!d) return '—';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function fmtRelative(value) {
    const d = toDate(value);
    if (!d) return '—';
    const diff = Date.now() - d.getTime();
    const mins = Math.round(diff / 60000);
    if (Math.abs(mins) < 1) return 'just now';
    if (Math.abs(mins) < 60) return mins > 0 ? `${mins} min ago` : `in ${-mins} min`;
    const hrs = Math.round(mins / 60);
    if (Math.abs(hrs) < 24) return hrs > 0 ? `${hrs} hr ago` : `in ${-hrs} hr`;
    const days = Math.round(hrs / 24);
    if (Math.abs(days) < 30) return days > 0 ? `${days} day${days === 1 ? '' : 's'} ago` : `in ${-days} day${days === 1 ? '' : 's'}`;
    return fmtDate(d);
  }

  /* value may be a Firestore Timestamp, a Date, ms number, or a
     datetime-local string such as "2026-10-01T09:00" */
  function toInputValue(value) {
    if (!value) return '';
    const d = toDate(value);
    if (!d) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function fmtDuration(seconds) {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return '—';
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h) return `${h}:${pad(m)}:${pad(sec)}`;
    return `${m}:${pad(sec)}`;
  }

  /* ---------- numbers & scoring ---------- */
  function ordinal(n) {
    if (n === null || n === undefined) return '—';
    const num = Number(n);
    if (!isFinite(num)) return '—';
    const rem100 = num % 100;
    if (rem100 >= 11 && rem100 <= 13) return `${num}th`;
    switch (num % 10) {
      case 1: return `${num}st`;
      case 2: return `${num}nd`;
      case 3: return `${num}rd`;
      default: return `${num}th`;
    }
  }

  function plural(n, one, many) {
    return Number(n) === 1 ? one : (many || `${one}s`);
  }

  function pct(part, whole) {
    if (!whole) return 0;
    return Math.round((part / whole) * 100);
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function num(value, fallback) {
    const n = Number(value);
    return isFinite(n) ? n : (fallback === undefined ? 0 : fallback);
  }

  /* Ranks are dense competition ranks: equal scores share a rank, and the
     next distinct score continues from the number of higher scorers. */
  /* Standard competition ranking: equal scores share a rank and the next
     distinct score skips (1, 2, 2, 4). */
  function computeRanks(rows, scoreKey) {
    const sorted = rows.slice().sort((a, b) => num(b[scoreKey]) - num(a[scoreKey]));
    let rank = 0, prev = null, seen = 0;
    sorted.forEach((row) => {
      seen += 1;
      const score = num(row[scoreKey]);
      if (prev === null || score !== prev) { rank = seen; prev = score; }
      row.rank = rank;
    });
    return sorted;
  }

  /* ---------- misc ---------- */
  function debounce(fn, wait) {
    let t;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), wait || 250);
    };
  }

  function uid(prefix) {
    return (prefix || 'id') + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function deepClone(obj) {
    return obj === undefined ? obj : JSON.parse(JSON.stringify(obj));
  }

  function groupBy(rows, keyFn) {
    const out = {};
    rows.forEach((row) => {
      const key = keyFn(row);
      (out[key] = out[key] || []).push(row);
    });
    return out;
  }

  function sortBy(rows, keyFn, dir) {
    const sign = dir === 'desc' ? -1 : 1;
    return rows.slice().sort((a, b) => {
      const av = keyFn(a), bv = keyFn(b);
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign;
      return String(av).localeCompare(String(bv)) * sign;
    });
  }

  function queryParam(name) {
    return new URLSearchParams(global.location.search).get(name);
  }

  /* Site root, derived from this script's own URL (…/js/core.js) so that
     links resolve identically from the public root, the student portal and
     the admin panel regardless of where the app is hosted. */
  const SITE_ROOT = (function () {
    const src = document.currentScript && document.currentScript.src;
    if (src) return src.replace(/\/js\/core\.js(\?.*)?$/, '/');
    const depth = (global.location.pathname.match(/\//g) || []).length - 2;
    return '../'.repeat(Math.max(0, depth));
  })();

  function redirect(path) { global.location.href = rootPath(path); }

  /* Resolve a site-root-relative link from any nesting depth. */
  function rootPath(path) {
    if (!path) return path;
    if (/^(https?:)?\/\//.test(path) || path.charAt(0) === '/' || path.charAt(0) === '#') return path;
    return SITE_ROOT + path;
  }

  function debounceRAF(fn) { return debounce(fn, 16); }

  function csvEscape(value) {
    const s = value === null || value === undefined ? '' : String(value);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadCSV(filename, headers, rows) {
    const lines = [headers.map(csvEscape).join(',')];
    rows.forEach((r) => lines.push(r.map(csvEscape).join(',')));
    downloadText(filename, lines.join('\r\n'), 'text/csv');
  }

  /* Parse CSV supporting quoted fields, escaped quotes and CRLF. */
  function parseCSV(text) {
    const out = [];
    let row = [], field = '', inQuotes = false;
    const src = String(text).replace(/^\uFEFF/, '');
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (inQuotes) {
        if (c === '"') {
          if (src[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); out.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
    if (field !== '' || row.length) { row.push(field); out.push(row); }
    return out.filter((r) => r.some((c) => String(c).trim() !== ''));
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } finally { ta.remove(); }
    return Promise.resolve();
  }

  function normaliseAnswer(value, questionType) {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
      return value
        .map((v) => normaliseAnswer(v, 'short_answer'))
        .filter((v) => v !== '')
        .sort()
        .join('|');
    }
    let s = String(value).trim();
    if (questionType === 'numeric') {
      s = s.replace(/[,\s]/g, '');
      const n = Number(s);
      return isFinite(n) ? String(n) : s.toLowerCase();
    }
    if (questionType === 'mcq') return s.toUpperCase();
    return s.toLowerCase().replace(/\s+/g, ' ').replace(/[.,;]$/, '');
  }

  function answersMatch(given, expected, questionType) {
    return normaliseAnswer(given, questionType) === normaliseAnswer(expected, questionType);
  }

  global.ABC = global.ABC || {};
  Object.assign(global.ABC, {
    esc, slug, initials, titleCase, trunc,
    toDate, fmtDate, fmtDateTime, fmtTime, fmtRelative, toInputValue, fmtDuration, pad,
    ordinal, plural, pct, clamp, num, computeRanks,
    debounce, uid, deepClone, groupBy, sortBy, queryParam, redirect, rootPath,
    csvEscape, downloadText, downloadCSV, parseCSV, copyToClipboard,
    normaliseAnswer, answersMatch
  });
})(window);
