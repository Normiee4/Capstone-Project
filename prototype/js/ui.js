/* iFixz Workspace — shared UI kit: escaping, formatting, inline SVG icons,
   dependency-free charts, toasts, accessible dialogs/sheets, form builders.
   Classic script (no ES modules) so index.html also runs from file://.
   Every colour comes from the :root token block in index.html. */
window.IFIXZ = window.IFIXZ || {};

(function (NS) {
  'use strict';

  var doc = document;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var overlays = [];

  var ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, function (ch) { return ESCAPES[ch]; });
  }

  function el(html) {
    var host = doc.createElement('div');
    host.innerHTML = String(html === null || html === undefined ? '' : html).trim();
    return host.firstElementChild;
  }

  function nodes(root, selector) {
    return Array.prototype.slice.call((root || doc).querySelectorAll(selector));
  }

  function on(root, type, selector, handler) {
    if (!root) return;
    root.addEventListener(type, function (event) {
      var target = event.target && event.target.closest ? event.target.closest(selector) : null;
      if (target && root.contains(target)) handler(event, target);
    });
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      if (button.getAttribute('data-busy-label') !== null) return;
      button.setAttribute('data-busy-label', button.innerHTML);
      button.setAttribute('aria-busy', 'true');
      button.disabled = true;
      button.innerHTML = '<span class="spinner">' + icon('spinner') + '</span>' + esc(label || 'Working');
      return;
    }
    var original = button.getAttribute('data-busy-label');
    button.removeAttribute('data-busy-label');
    button.removeAttribute('aria-busy');
    button.disabled = false;
    if (original !== null) button.innerHTML = original;
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function trimZero(text) {
    return text.indexOf('.0') === text.length - 2 ? text.slice(0, -2) : text;
  }

  var fmt = {
    int: function (n) {
      var v = Number(n);
      if (isNaN(v)) return '—';
      return Math.round(v).toLocaleString('en-US');
    },
    dec: function (n, digits) {
      var v = Number(n);
      if (isNaN(v)) return '—';
      var d = digits === undefined ? 1 : digits;
      return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    },
    compact: function (n) {
      var v = Number(n);
      if (isNaN(v)) return '—';
      var abs = Math.abs(v);
      if (abs >= 1000000) return trimZero((v / 1000000).toFixed(1)) + 'M';
      if (abs >= 1000) return trimZero((v / 1000).toFixed(abs >= 10000 ? 0 : 1)) + 'K';
      return String(Math.round(v * 10) / 10);
    },
    pct: function (n, digits) {
      var v = Number(n);
      if (isNaN(v)) return '—';
      var d = digits === undefined ? 1 : digits;
      return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
    },
    ms: function (n) {
      var v = Number(n) || 0;
      return v >= 1000 ? fmt.dec(v / 1000, 1) + ' s' : Math.round(v) + ' ms';
    },
    mb: function (n) { return fmt.int(n) + ' MB'; },
    clock: function (n) {
      var v = Number(n) || 0;
      var m = Math.floor(v / 60);
      var s = Math.round(v % 60);
      return m ? m + 'm ' + pad2(s) + 's' : s + 's';
    },
    list: function (items, limit) {
      var max = limit || 3;
      var out = [];
      for (var i = 0; i < items.length && i < max; i++) out.push(String(items[i]));
      var rest = items.length - out.length;
      return out.join(', ') + (rest > 0 ? ' +' + rest + ' more' : '');
    }
  };

  function dateOf(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  function dateShort(iso) {
    var d = dateOf(iso);
    return d ? MONTHS[d.getMonth()] + ' ' + d.getDate() : '—';
  }

  function dateFull(iso) {
    var d = dateOf(iso);
    return d ? MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() : '—';
  }

  function timeShort(iso) {
    var d = dateOf(iso);
    return d ? pad2(d.getHours()) + ':' + pad2(d.getMinutes()) : '—';
  }

  function dateTime(iso) {
    var d = dateOf(iso);
    return d ? MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) : '—';
  }

  function stamp(iso) {
    var d = dateOf(iso);
    return d ? MONTHS[d.getMonth()] + ' ' + d.getDate() + ' · ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) : '—';
  }

  function relTime(iso) {
    var d = dateOf(iso);
    if (!d) return '—';
    var diff = Date.now() - d.getTime();
    if (diff < 0) diff = 0;
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + ' h ago';
    var days = Math.floor(hours / 24);
    if (days < 30) return days + ' d ago';
    return dateShort(iso);
  }

  function localInputValue(iso) {
    var d = dateOf(iso);
    if (!d) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function isoFromLocalInput(value) {
    if (!value) return '';
    var d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toISOString();
  }

  var ICONS = {
    overview: ['M3.5 3.5h5v5h-5zM11.5 3.5h5v5h-5zM11.5 11.5h5v5h-5zM3.5 11.5h5v5h-5z'],
    pipeline: ['M3 4h14l-5.5 6.5V16l-3-2v-3.5z'],
    registry: ['M3.5 3.5h5v5h-5zM11.5 3.5h5v5h-5zM3.5 11.5h5v5h-5zM14 14h3.5M15.75 12.25v3.5'],
    module: ['M10 2.6l7 3.4v7.2l-7 3.4-7-3.4V6zM3 6l7 3.4L17 6M10 9.4V17'],
    backup: ['M3.5 5.5h13v3h-13zM4.5 8.5v8h11v-8M8 11.5h4M8 14h4'],
    alert: ['M10 3l7.2 13.2H2.8zM10 8.2v4M10 14.4v.1'],
    sync: ['M16.2 8.6A6.2 6.2 0 104 10.4M16.5 3.8v4.6h-4.6'],
    rule: ['M3.5 5.8l1.8 1.8 3.2-3.4M3.5 13l1.8 1.8 3.2-3.4M11.5 6h5M11.5 13.2h5'],
    check: ['M4 10.4l4 4 8-9'],
    x: ['M5 5l10 10M15 5L5 15'],
    plus: ['M10 4v12M4 10h12'],
    search: ['M9 15.2A6.2 6.2 0 109 2.8a6.2 6.2 0 000 12.4zM13.6 13.6L17 17'],
    chevronRight: ['M8 4.5l5.5 5.5L8 15.5'],
    chevronDown: ['M5.5 8l4.5 4.5L14.5 8'],
    external: ['M11.5 3H17v5.5M17 3l-7.5 7.5M14 12.5V17H3V6h4.5'],
    database: ['M10 3c3.3 0 6 .9 6 2s-2.7 2-6 2-6-.9-6-2 2.7-2 6-2zM4 5v10c0 1.1 2.7 2 6 2s6-.9 6-2V5M4 10c0 1.1 2.7 2 6 2s6-.9 6-2'],
    file: ['M5.5 2.5h5.5l4 4v11h-9.5zM11 2.5v4h4'],
    api: ['M7.5 4C5.6 4 5.6 7.6 3.5 8c2.1.4 2.1 4 4 4M12.5 4c1.9 0 1.9 3.6 4 4-2.1.4-2.1 4-4 4'],
    webhook: ['M11.2 2.5L5 11.5h4L8.6 17.5 15 8.5h-4z'],
    play: ['M6.5 4l9 6-9 6z'],
    download: ['M10 3v9M6.2 8.8L10 12.6l3.8-3.8M4 16.5h12'],
    upload: ['M10 12.5v-9M6.2 7.2L10 3.4l3.8 3.8M4 16.5h12'],
    restore: ['M10 3.6A6.4 6.4 0 104 11.6M10 3.6V1.4M10 6.8v3.6l2.6 1.6'],
    user: ['M10 10.2a3.4 3.4 0 100-6.8 3.4 3.4 0 000 6.8zM3.8 17c.8-3.2 3.2-4.6 6.2-4.6s5.4 1.4 6.2 4.6'],
    lock: ['M6 9V7a4 4 0 018 0v2M4.5 9h11v7.5h-11z'],
    info: ['M10 17.2A7.2 7.2 0 1010 2.8a7.2 7.2 0 000 14.4zM10 9.2v5M10 6.2v.1'],
    trash: ['M4 6h12M8 6V3.8h4V6M6 6l.9 11h6.2L14 6M9 9v5M11 9v5'],
    edit: ['M4 16.2h3.2l8-8-3.2-3.2-8 8zM12.2 4.8l3.2 3.2'],
    filter: ['M3 5h14l-5.4 6.4V17l-3.2-2v-3.6z'],
    key: ['M12.6 3.2a4 4 0 100 8 4 4 0 000-8zM9.6 8.2L3 14.8v2.4h2.4v-1.8h1.8v-1.8h1.8l1-1'],
    eye: ['M2.2 10s3-5 7.8-5 7.8 5 7.8 5-3 5-7.8 5-7.8-5-7.8-5zM10 12.6a2.6 2.6 0 100-5.2 2.6 2.6 0 000 5.2'],
    shield: ['M10 2.6l6 2.1v5c0 4-2.6 6.7-6 8-3.4-1.3-6-4-6-8v-5z'],
    ban: ['M10 17.2A7.2 7.2 0 1010 2.8a7.2 7.2 0 000 14.4zM5.6 5.6l8.8 8.8'],
    inbox: ['M3 11.5l2-6.5h10l2 6.5v5.5H3zM3 11.5h4l1 2h4l1-2h4'],
    chart: ['M4.5 16.5v-6M10 16.5v-11M15.5 16.5v-8'],
    menu: ['M3 6h14M3 10h14M3 14h14'],
    arrowRight: ['M4 10h12M11.5 6l4 4-4 4'],
    spinner: ['M10 3a7 7 0 107 7'],
    link: ['M8.6 11.4a3 3 0 004.3 0l2.2-2.2a3 3 0 10-4.3-4.3l-.8.8M11.4 8.6a3 3 0 00-4.3 0l-2.2 2.2a3 3 0 104.3 4.3l.8-.8']
  };

  function icon(name, cls) {
    var paths = ICONS[name];
    if (!paths) return '';
    var body = '';
    for (var i = 0; i < paths.length; i++) body += '<path d="' + paths[i] + '"/>';
    return '<svg class="' + (cls ? esc(cls) : '') + '" viewBox="0 0 20 20" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  function niceMax(value) {
    if (!(value > 0)) return 1;
    var exp = Math.floor(Math.log(value) / Math.LN10);
    var base = Math.pow(10, exp);
    var frac = value / base;
    var step = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
    return step * base;
  }

  function gridLayer(top, padL, padR, padT, plotH, width) {
    var out = '';
    for (var i = 0; i <= 4; i++) {
      var y = padT + plotH * (i / 4);
      var value = top * (1 - i / 4);
      out += '<line class="grid-line" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (width - padR) + '" y2="' + y.toFixed(1) + '"/>';
      out += '<text class="axis-text" x="' + (padL - 8) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + esc(fmt.compact(value)) + '</text>';
    }
    return out;
  }

  function barChart(data, opts) {
    opts = opts || {};
    var rows = data || [];
    var width = 640;
    var height = opts.height || 210;
    var padL = 48, padR = 12, padT = 20, padB = 28;
    var plotW = width - padL - padR;
    var plotH = height - padT - padB;
    var max = 0;
    var i;
    for (i = 0; i < rows.length; i++) if (rows[i].value > max) max = rows[i].value;
    var top = niceMax(max);
    var slot = rows.length ? plotW / rows.length : plotW;
    var barW = Math.max(4, Math.min(38, slot * 0.56));
    var every = rows.length > 10 ? 2 : 1;
    var out = gridLayer(top, padL, padR, padT, plotH, width);
    if (!rows.length) {
      return '<div class="chart"><svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + esc(opts.alt || 'No data') + '">' + out +
        '<text class="axis-text" x="' + (width / 2) + '" y="' + (padT + plotH / 2) + '" text-anchor="middle">No data in range</text></svg></div>';
    }
    for (i = 0; i < rows.length; i++) {
      var cx = padL + slot * i + slot / 2;
      var raw = (rows[i].value / top) * plotH;
      var h = rows[i].value > 0 ? Math.max(2, raw) : 0;
      var y = padT + plotH - h;
      var w = Math.max(3, Math.min(barW, slot - 6));
      var label = rows[i].label + ': ' + fmt.int(rows[i].value);
      out += '<rect class="bar-hit" x="' + (cx - w / 2).toFixed(1) + '" y="' + padT + '" width="' + w.toFixed(1) + '" height="' + plotH + '" tabindex="0" role="img" aria-label="' + esc(label) + '"><title>' + esc(label) + '</title></rect>';
      if (h > 0) out += '<rect class="bar" x="' + (cx - w / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"/>';
      if (slot >= 32 && rows[i].value > 0) out += '<text class="value-text" x="' + cx.toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" text-anchor="middle">' + esc(fmt.compact(rows[i].value)) + '</text>';
      if (i % every === 0 || i === rows.length - 1) out += '<text class="axis-text" x="' + cx.toFixed(1) + '" y="' + (height - 9) + '" text-anchor="middle">' + esc(rows[i].label) + '</text>';
    }
    return '<div class="chart"><svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + esc(opts.alt || 'Bar chart') + '">' + out + '</svg></div>';
  }

  function lineChart(data, opts) {
    opts = opts || {};
    var rows = data || [];
    var width = 640;
    var height = opts.height || 210;
    var padL = 48, padR = 14, padT = 20, padB = 28;
    var plotW = width - padL - padR;
    var plotH = height - padT - padB;
    var max = 0;
    var i;
    for (i = 0; i < rows.length; i++) if (rows[i].value > max) max = rows[i].value;
    var top = niceMax(max);
    var step = rows.length > 1 ? plotW / (rows.length - 1) : 0;
    var every = rows.length > 10 ? 2 : 1;
    var out = gridLayer(top, padL, padR, padT, plotH, width);
    if (!rows.length) {
      return '<div class="chart"><svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + esc(opts.alt || 'No data') + '">' + out +
        '<text class="axis-text" x="' + (width / 2) + '" y="' + (padT + plotH / 2) + '" text-anchor="middle">No data in range</text></svg></div>';
    }
    var points = [];
    for (i = 0; i < rows.length; i++) {
      points.push({
        x: padL + (rows.length > 1 ? step * i : plotW / 2),
        y: padT + plotH - (top ? (rows[i].value / top) * plotH : 0),
        row: rows[i]
      });
    }
    var line = '';
    for (i = 0; i < points.length; i++) line += (i ? 'L' : 'M') + points[i].x.toFixed(1) + ' ' + points[i].y.toFixed(1) + ' ';
    var baseline = (padT + plotH).toFixed(1);
    out += '<path class="line-area" d="' + line + 'L' + points[points.length - 1].x.toFixed(1) + ' ' + baseline + ' L' + points[0].x.toFixed(1) + ' ' + baseline + ' Z"/>';
    out += '<path class="line-path" d="' + line + '"/>';
    for (i = 0; i < points.length; i++) {
      var label = points[i].row.label + ': ' + fmt.int(points[i].row.value);
      out += '<circle class="line-dot" cx="' + points[i].x.toFixed(1) + '" cy="' + points[i].y.toFixed(1) + '" r="3.2"><title>' + esc(label) + '</title></circle>';
      if (i % every === 0 || i === points.length - 1) out += '<text class="axis-text" x="' + points[i].x.toFixed(1) + '" y="' + (height - 9) + '" text-anchor="middle">' + esc(points[i].row.label) + '</text>';
    }
    var last = points[points.length - 1];
    out += '<text class="value-text" x="' + Math.min(width - padR, last.x + 4).toFixed(1) + '" y="' + Math.max(padT + 10, last.y - 8).toFixed(1) + '" text-anchor="end">' + esc(fmt.compact(last.row.value)) + '</text>';
    return '<div class="chart"><svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + esc(opts.alt || 'Line chart') + '">' + out + '</svg></div>';
  }

  function sparkline(values, opts) {
    opts = opts || {};
    var width = opts.width || 116;
    var height = opts.height || 26;
    var vals = values || [];
    if (vals.length < 2) return '';
    var max = 0;
    var min = Number.MAX_VALUE;
    var i;
    for (i = 0; i < vals.length; i++) {
      if (vals[i] > max) max = vals[i];
      if (vals[i] < min) min = vals[i];
    }
    var span = (max - min) || 1;
    var step = width / (vals.length - 1);
    var d = '';
    for (i = 0; i < vals.length; i++) {
      var x = (step * i).toFixed(1);
      var y = (height - 3 - ((vals[i] - min) / span) * (height - 6)).toFixed(1);
      d += (i ? 'L' : 'M') + x + ' ' + y;
    }
    return '<svg class="spark" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" aria-hidden="true" focusable="false"><path class="spark-line" d="' + d + '"/></svg>';
  }

  function shareRows(items, opts) {
    opts = opts || {};
    var rows = items || [];
    var max = 0;
    var i;
    for (i = 0; i < rows.length; i++) if (rows[i].value > max) max = rows[i].value;
    if (max <= 0) max = 1;
    var out = '';
    for (i = 0; i < rows.length; i++) {
      var pct = Math.max(2, Math.round((rows[i].value / max) * 100));
      var text = opts.format ? opts.format(rows[i].value) : fmt.int(rows[i].value);
      out += '<div class="stack-tight"><div class="row-wrap"><span class="text-sm od-truncate">' + esc(rows[i].label) + '</span>' +
        '<span class="push-right text-sm value-strong">' + esc(text) + '</span></div>' +
        '<div class="progress"><div class="progress-bar" style="width:' + pct + '%"></div></div></div>';
    }
    return out;
  }

  function chartBlock(title, note, chartHtml) {
    return '<div class="chart"><div class="chart-head"><h3 class="chart-title">' + esc(title) + '</h3>' +
      (note ? '<p class="chart-note">' + esc(note) + '</p>' : '') + '</div>' + chartHtml + '</div>';
  }

  function badge(label, tone, iconName) {
    return '<span class="badge badge-' + esc(tone || 'neutral') + '">' + (iconName ? icon(iconName) : '') + esc(label) + '</span>';
  }

  function chip(label, tone, mono) {
    return '<span class="chip ' + (tone ? 'chip-' + esc(tone) : '') + '"><span class="chip-dot"></span>' +
      (mono ? '<span class="chip-mono">' + esc(label) + '</span>' : esc(label)) + '</span>';
  }

  function banner(tone, iconName, heading, bodyHtml, actionHtml) {
    return '<div class="banner banner-' + esc(tone) + '">' + icon(iconName || 'info') +
      '<div class="banner-body"><strong>' + esc(heading) + '</strong>' + (bodyHtml ? '<p>' + bodyHtml + '</p>' : '') + '</div>' +
      (actionHtml ? '<span class="push-right">' + actionHtml + '</span>' : '') + '</div>';
  }

  function emptyState(opts) {
    opts = opts || {};
    return '<div class="empty"><span class="empty-mark">' + icon(opts.icon || 'inbox') + '</span>' +
      '<p class="empty-title">' + esc(opts.title || 'Nothing here yet') + '</p>' +
      (opts.text ? '<p class="empty-text">' + esc(opts.text) + '</p>' : '') +
      (opts.action || '') + '</div>';
  }

  function gate(opts) {
    opts = opts || {};
    return '<div class="gate"><span class="empty-mark">' + icon('lock') + '</span>' +
      '<p class="gate-title">' + esc(opts.title || 'Restricted to the organization admin') + '</p>' +
      '<p>' + (opts.text || 'Switch to the organization admin role from the account menu to manage this area.') + '</p>' +
      (opts.action || '') + '</div>';
  }

  function searchField(id, placeholder, label) {
    return '<div class="field search"><label class="sr-only" for="' + esc(id) + '">' + esc(label || 'Search') + '</label>' +
      '<input class="input" id="' + esc(id) + '" type="search" placeholder="' + esc(placeholder) + '" autocomplete="off"></div>';
  }

  function filterRows(input, table) {
    if (!input || !table) return;
    var scope = table.closest ? (table.closest('.card') || table.parentNode) : table.parentNode;
    var counter = scope ? scope.querySelector('[data-filter-count]') : null;
    var apply = function () {
      var q = String(input.value || '').trim().toLowerCase();
      var rows = nodes(table, 'tbody tr');
      var shown = 0;
      for (var i = 0; i < rows.length; i++) {
        var text = (rows[i].textContent || '').toLowerCase();
        var hit = !q || text.indexOf(q) !== -1;
        rows[i].hidden = !hit;
        if (hit) shown++;
      }
      if (counter) counter.textContent = shown + ' of ' + rows.length;
    };
    input.addEventListener('input', apply);
    apply();
  }

  function fieldText(o) {
    o = o || {};
    var id = o.id || o.name;
    var described = o.hint ? ' aria-describedby="' + esc(id) + '-hint"' : '';
    return '<div class="field' + (o.full ? ' field-full' : '') + '">' +
      '<label class="field-label" for="' + esc(id) + '">' + esc(o.label) + (o.required ? '<span class="req" aria-hidden="true">*</span>' : '') + '</label>' +
      '<input class="input" id="' + esc(id) + '" name="' + esc(o.name || id) + '" type="' + esc(o.type || 'text') + '" value="' + esc(o.value === undefined || o.value === null ? '' : o.value) + '"' +
      (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') +
      (o.required ? ' required aria-required="true"' : '') +
      (o.disabled ? ' disabled' : '') +
      (o.inputmode ? ' inputmode="' + esc(o.inputmode) + '"' : '') +
      (o.readonly ? ' readonly' : '') + described + '>' +
      (o.hint ? '<p class="field-hint" id="' + esc(id) + '-hint">' + esc(o.hint) + '</p>' : '') + '</div>';
  }

  function fieldSelect(o) {
    o = o || {};
    var id = o.id || o.name;
    var options = o.options || [];
    var html = '';
    if (o.placeholder) html += '<option value="">' + esc(o.placeholder) + '</option>';
    for (var i = 0; i < options.length; i++) {
      var value = typeof options[i] === 'object' ? options[i].value : options[i];
      var label = typeof options[i] === 'object' ? options[i].label : options[i];
      var picked = String(value) === String(o.value === undefined || o.value === null ? '' : o.value) ? ' selected' : '';
      html += '<option value="' + esc(value) + '"' + picked + '>' + esc(label) + '</option>';
    }
    var described = o.hint ? ' aria-describedby="' + esc(id) + '-hint"' : '';
    return '<div class="field' + (o.full ? ' field-full' : '') + '">' +
      '<label class="field-label" for="' + esc(id) + '">' + esc(o.label) + (o.required ? '<span class="req" aria-hidden="true">*</span>' : '') + '</label>' +
      '<div class="select-wrap"><select class="select" id="' + esc(id) + '" name="' + esc(o.name || id) + '"' +
      (o.required ? ' required aria-required="true"' : '') + (o.disabled ? ' disabled' : '') + described + '>' + html + '</select></div>' +
      (o.hint ? '<p class="field-hint" id="' + esc(id) + '-hint">' + esc(o.hint) + '</p>' : '') + '</div>';
  }

  function fieldTextarea(o) {
    o = o || {};
    var id = o.id || o.name;
    return '<div class="field' + (o.full ? ' field-full' : '') + '">' +
      '<label class="field-label" for="' + esc(id) + '">' + esc(o.label) + (o.required ? '<span class="req" aria-hidden="true">*</span>' : '') + '</label>' +
      '<textarea class="textarea" id="' + esc(id) + '" name="' + esc(o.name || id) + '" rows="' + (o.rows || 3) + '"' +
      (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + (o.required ? ' required aria-required="true"' : '') + '>' +
      esc(o.value || '') + '</textarea>' +
      (o.hint ? '<p class="field-hint" id="' + esc(id) + '-hint">' + esc(o.hint) + '</p>' : '') + '</div>';
  }

  function choiceCard(o) {
    return '<label class="choice"><input type="radio" name="' + esc(o.name) + '" value="' + esc(o.value) + '"' + (o.checked ? ' checked' : '') + '>' +
      '<span class="choice-body"><span class="choice-title">' + esc(o.title) + '</span>' +
      (o.hint ? '<span class="choice-hint">' + esc(o.hint) + '</span>' : '') + '</span></label>';
  }

  function switchRow(o) {
    o = o || {};
    var id = o.id || o.name;
    return '<div class="switch"><input type="checkbox" id="' + esc(id) + '" name="' + esc(o.name || id) + '"' + (o.checked ? ' checked' : '') +
      (o.disabled ? ' disabled' : '') + '><span class="switch-track"></span><label class="switch-label" for="' + esc(id) + '">' + esc(o.label) + '</label></div>';
  }

  function checkboxRow(o) {
    o = o || {};
    var id = o.id || o.name;
    return '<div class="checkbox-row"><input type="checkbox" id="' + esc(id) + '" name="' + esc(o.name || id) + '"' + (o.checked ? ' checked' : '') +
      (o.disabled ? ' disabled' : '') + '><label for="' + esc(id) + '">' + esc(o.label) + (o.hint ? '<br><span class="text-muted text-xs">' + esc(o.hint) + '</span>' : '') + '</label></div>';
  }

  function readForm(root) {
    var out = {};
    var fields = nodes(root, '[name]');
    for (var i = 0; i < fields.length; i++) {
      var node = fields[i];
      if (node.type === 'checkbox') out[node.name] = node.checked;
      else if (node.type === 'radio') { if (node.checked) out[node.name] = node.value; }
      else out[node.name] = node.value;
    }
    return out;
  }

  function fieldOf(root, name) {
    return (root || doc).querySelector('[name="' + name + '"]');
  }

  function clearErrors(root) {
    var errorNodes = nodes(root, '.field-error');
    for (var i = 0; i < errorNodes.length; i++) errorNodes[i].parentNode.removeChild(errorNodes[i]);
    var invalid = nodes(root, '[aria-invalid="true"]');
    for (i = 0; i < invalid.length; i++) invalid[i].removeAttribute('aria-invalid');
    var summary = root.querySelector('[data-error-summary]');
    if (summary && summary.parentNode) summary.parentNode.removeChild(summary);
  }

  function showFieldError(root, name, message) {
    var input = fieldOf(root, name);
    if (!input) return;
    input.setAttribute('aria-invalid', 'true');
    var field = input.closest ? input.closest('.field, .mapping-row') : null;
    var host = field || input.parentNode;
    var existing = host.querySelector('.field-error');
    if (existing) existing.parentNode.removeChild(existing);
    var node = el('<p class="field-error">' + icon('alert') + '<span>' + esc(message) + '</span></p>');
    host.appendChild(node);
  }

  function errorSummary(errors, title) {
    if (!errors.length) return '';
    var items = '';
    for (var i = 0; i < errors.length; i++) {
      items += '<li><a href="#' + esc(errors[i].id) + '" data-focus="' + esc(errors[i].id) + '">' + esc(errors[i].message) + '</a></li>';
    }
    return '<div class="form-summary" role="alert" tabindex="-1" data-error-summary>' + icon('alert') +
      '<div><strong>' + esc(title || 'Fix these before continuing') + '</strong><ul>' + items + '</ul></div></div>';
  }

  function wireErrorSummary(root) {
    on(root, 'click', '[data-focus]', function (event, link) {
      var id = link.getAttribute('data-focus');
      var target = doc.getElementById(id);
      if (!target) return;
      event.preventDefault();
      if (target.focus) target.focus();
      if (target.select && target.type === 'text') target.select();
    });
  }

  function focusables(root) {
    var all = nodes(root, 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
    var out = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].getClientRects().length) out.push(all[i]);
    }
    return out;
  }

  function openOverlay(kind, opts) {
    opts = opts || {};
    var root = doc.getElementById('overlayRoot');
    if (!root) return null;
    var isSheet = kind === 'sheet';
    var part = isSheet ? 'sheet' : 'dialog';
    var previous = doc.activeElement;
    var titleId = 'overlay-title-' + overlays.length;

    var overlay = doc.createElement('div');
    overlay.className = 'overlay ' + (isSheet ? 'is-end' : 'is-center');
    overlay.innerHTML = '<section class="' + part + (opts.wide ? ' is-wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="' + titleId + '">' +
      '<header class="' + part + '-head"><div class="card-head-text"><h2 class="' + part + '-title" id="' + titleId + '">' + esc(opts.title || '') + '</h2>' +
      (opts.sub ? '<p class="' + part + '-sub">' + esc(opts.sub) + '</p>' : '') + '</div>' +
      '<button class="icon-btn push-right" type="button" data-overlay-close aria-label="Close dialog">' + icon('x') + '</button></header>' +
      '<div class="' + part + '-body">' + (opts.body || '') + '</div>' +
      (opts.foot ? '<footer class="' + part + '-foot">' + opts.foot + '</footer>' : '') + '</section>';

    root.appendChild(overlay);

    var panel = overlay.querySelector('.' + part);
    var body = overlay.querySelector('.' + part + '-body');
    var foot = overlay.querySelector('.' + part + '-foot');

    var entry = {
      overlay: overlay,
      panel: panel,
      body: body,
      foot: foot,
      closed: false,
      setBody: function (html) { body.innerHTML = html; },
      setFoot: function (html) {
        if (!foot) {
          foot = doc.createElement('footer');
          foot.className = part + '-foot';
          panel.appendChild(foot);
        }
        foot.innerHTML = html;
      },
      setSub: function (text) {
        var sub = panel.querySelector('.' + part + '-sub');
        if (!sub) {
          sub = doc.createElement('p');
          sub.className = part + '-sub';
          var head = panel.querySelector('.' + part + '-head .card-head-text');
          if (head) head.appendChild(sub);
        }
        sub.textContent = text || '';
      },
      close: function () { close(); }
    };

    function close() {
      if (entry.closed) return;
      entry.closed = true;
      var idx = overlays.indexOf(entry);
      if (idx !== -1) overlays.splice(idx, 1);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      doc.removeEventListener('keydown', onKeydown, true);
      if (opts.onClose) opts.onClose();
      if (previous && previous.focus && doc.contains(previous)) previous.focus();
    }

    function onKeydown(event) {
      if (overlays.length && overlays[overlays.length - 1] !== entry) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      var items = focusables(panel);
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && doc.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && doc.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    doc.addEventListener('keydown', onKeydown, true);
    overlay.addEventListener('mousedown', function (event) {
      if (event.target === overlay) close();
    });
    on(overlay, 'click', '[data-overlay-close]', function () { close(); });

    overlays.push(entry);

    var auto = focusables(panel)[0];
    if (auto && auto.focus) auto.focus();
    if (opts.onMount) opts.onMount(entry);

    return entry;
  }

  function overlayCount() { return overlays.length; }

  function dialog(opts) { return openOverlay('dialog', opts); }
  function sheet(opts) { return openOverlay('sheet', opts); }

  function confirmDialog(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var settled = false;
      var entry = openOverlay('dialog', {
        title: opts.title || 'Confirm action',
        sub: opts.sub || '',
        body: '<div class="banner banner-' + (opts.danger ? 'danger' : 'info') + '">' + icon(opts.danger ? 'alert' : 'info') +
          '<div class="banner-body"><strong>' + esc(opts.heading || 'Please confirm') + '</strong><p>' + (opts.bodyHtml || esc(opts.text || '')) + '</p></div></div>' +
          (opts.detail || ''),
        foot: '<button class="btn btn-secondary" type="button" data-act="cancel">' + esc(opts.cancelLabel || 'Cancel') + '</button>' +
          '<span class="spacer"></span>' +
          '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" type="button" data-act="ok">' +
          (opts.danger ? icon('alert') : icon('check')) + esc(opts.confirmLabel || 'Confirm') + '</button>',
        onClose: function () {
          if (!settled) {
            settled = true;
            resolve(false);
          }
        },
        onMount: function (ctx) {
          on(ctx.overlay, 'click', '[data-act]', function (event, button) {
            settled = true;
            resolve(button.getAttribute('data-act') === 'ok');
            ctx.close();
          });
          var ok = ctx.overlay.querySelector('[data-act="ok"]');
          if (ok) ok.focus();
        }
      });
      return entry;
    });
  }

  function confirmList(rows) {
    var html = '<div class="confirm-list">';
    for (var i = 0; i < rows.length; i++) {
      html += '<div class="confirm-row"><span>' + esc(rows[i][0]) + '</span><span>' + esc(rows[i][1]) + '</span></div>';
    }
    return html + '</div>';
  }

  function toast(options) {
    var o = typeof options === 'string' ? { title: options } : (options || {});
    var region = doc.getElementById('toasts');
    if (!region) return null;
    var tone = o.tone || 'info';
    var iconName = tone === 'ok' ? 'check' : tone === 'error' ? 'alert' : 'info';
    var fallback = tone === 'ok' ? 'Done' : tone === 'error' ? 'Something went wrong' : 'Heads up';
    var node = el('<div class="toast toast-' + tone + '">' + icon(iconName) +
      '<div class="toast-body"><strong>' + esc(o.title || fallback) + '</strong>' +
      (o.text ? '<p>' + esc(o.text) + '</p>' : '') + '</div></div>');
    region.appendChild(node);
    var timer = window.setTimeout(function () { close(); }, o.timeout || 5200);
    function close() {
      window.clearTimeout(timer);
      if (node.parentNode) node.parentNode.removeChild(node);
    }
    node.addEventListener('click', close);
    return { close: close, node: node };
  }

  function toastOk(title, text) { return toast({ tone: 'ok', title: title, text: text }); }
  function toastError(title, text) { return toast({ tone: 'error', title: title, text: text, timeout: 7000 }); }
  function toastInfo(title, text) { return toast({ tone: 'info', title: title, text: text }); }

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/);
    var out = '';
    for (var i = 0; i < parts.length && i < 2; i++) out += parts[i].charAt(0).toUpperCase();
    return out || '—';
  }

  function slugify(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function exportCsv(filename, columns, rows) {
    var lines = [];
    lines.push(columns.map(function (col) { return '"' + String(col.label).replace(/"/g, '""') + '"'; }).join(','));
    for (var i = 0; i < rows.length; i++) {
      var cells = [];
      for (var c = 0; c < columns.length; c++) {
        var raw = rows[i][columns[c].key];
        cells.push('"' + String(raw === undefined || raw === null ? '' : raw).replace(/"/g, '""') + '"');
      }
      lines.push(cells.join(','));
    }
    var blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = doc.createElement('a');
    link.href = url;
    link.download = filename;
    doc.body.appendChild(link);
    link.click();
    doc.body.removeChild(link);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  NS.UI = {
    esc: esc,
    el: el,
    nodes: nodes,
    on: on,
    setBusy: setBusy,
    fmt: fmt,
    dateShort: dateShort,
    dateFull: dateFull,
    timeShort: timeShort,
    dateTime: dateTime,
    stamp: stamp,
    relTime: relTime,
    localInputValue: localInputValue,
    isoFromLocalInput: isoFromLocalInput,
    icon: icon,
    barChart: barChart,
    lineChart: lineChart,
    sparkline: sparkline,
    shareRows: shareRows,
    chartBlock: chartBlock,
    badge: badge,
    chip: chip,
    banner: banner,
    emptyState: emptyState,
    gate: gate,
    searchField: searchField,
    filterRows: filterRows,
    fieldText: fieldText,
    fieldSelect: fieldSelect,
    fieldTextarea: fieldTextarea,
    choiceCard: choiceCard,
    switchRow: switchRow,
    checkboxRow: checkboxRow,
    readForm: readForm,
    fieldOf: fieldOf,
    clearErrors: clearErrors,
    showFieldError: showFieldError,
    errorSummary: errorSummary,
    wireErrorSummary: wireErrorSummary,
    dialog: dialog,
    sheet: sheet,
    confirm: confirmDialog,
    confirmList: confirmList,
    overlayCount: overlayCount,
    toast: toast,
    toastOk: toastOk,
    toastError: toastError,
    toastInfo: toastInfo,
    initials: initials,
    slugify: slugify,
    exportCsv: exportCsv
  };
})(window.IFIXZ);
