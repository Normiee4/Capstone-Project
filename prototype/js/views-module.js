/* iFixz Workspace — Module dashboard view: shared dashboard for every registered
   module (schema-driven metrics, trend, breakdown) plus the records table. */
(function (NS) {
  'use strict';

  var UI = NS.UI;
  var Store = NS.Store;
  var VIEWS = (NS.Views = NS.Views || {});
  var PAGE_SIZE = 20;

  var ui = { page: 1, key: '' };
  var lastRoot = null;
  var lastParams = null;
  var lastQuery = null;

  function rerender() {
    if (lastRoot) VIEWS.module.render(lastRoot, lastParams, lastQuery);
  }

  function shell(root, html) {
    var wrap = UI.el('<div class="view-inner">' + html + '</div>');
    root.innerHTML = '';
    root.appendChild(wrap);
    return wrap;
  }

  function display(value) {
    if (typeof value === 'string') return value;
    var n = Number(value);
    if (isNaN(n)) return '—';
    if (Math.abs(n) >= 10000) return UI.fmt.compact(n);
    if (n % 1 === 0) return UI.fmt.int(n);
    return UI.fmt.dec(n, 1);
  }

  function sortedRecords(mod) {
    var rows = mod.records.slice();
    rows.sort(function (a, b) {
      var left = new Date(a._ingestedAt || a.createdAt || 0).getTime();
      var right = new Date(b._ingestedAt || b.createdAt || 0).getTime();
      return right - left;
    });
    return rows;
  }

  function cell(mod, record, field) {
    var value = record[field.key];
    var text = value === undefined || value === null || value === '' ? '—' : String(value);
    if (field.type === 'date') {
      return '<td class="nowrap" title="' + UI.esc(text) + '">' + UI.esc(UI.dateShort(value)) + '</td>';
    }
    if (field.type === 'number') {
      return '<td class="num">' + (value === '' || value === undefined ? '—' : UI.esc(UI.fmt.int(value))) + '</td>';
    }
    var clipped = text.length > 46 ? text.slice(0, 45) + '…' : text;
    return '<td title="' + UI.esc(text) + '">' + UI.esc(clipped) + '</td>';
  }

  function metricCard(mod, metric) {
    var value = Store.metricValue(mod.id, metric.key);
    var foot = metric.type === 'count'
      ? 'All validated rows in this module'
      : 'Computed from ' + UI.fmt.int(mod.records.length) + ' validated rows';
    return '<article class="metric"><p class="metric-label">' + UI.esc(metric.label) + '</p>' +
      '<p class="metric-value">' + UI.esc(display(value)) + '</p>' +
      '<p class="metric-foot">' + UI.esc(foot) + '</p></article>';
  }

  function trendCard(mod) {
    var cfg = mod.dashboard.trend;
    if (!cfg) {
      return '<section class="card"><div class="card-body">' +
        UI.emptyState({ icon: 'chart', title: 'No time field in this schema', text: 'Add a date field to the module schema to chart activity over time.' }) +
        '</div></section>';
    }
    var buckets = Store.trend(mod.id);
    var values = [];
    for (var i = 0; i < buckets.length; i++) values.push(buckets[i].value);
    var chart = cfg.bucket === 'period' ? UI.barChart(buckets, { alt: cfg.label, height: 210 }) : UI.lineChart(buckets, { alt: cfg.label, height: 210 });
    return '<section class="card"><div class="card-body">' +
      UI.chartBlock(cfg.label, cfg.bucket === 'period' ? 'Grouped by pay period' : 'Last ' + (cfg.days || 14) + ' days · sample data', chart) +
      '</div><div class="card-foot">Peak ' + UI.fmt.int(Math.max.apply(null, values.concat([0]))) + ' · window total ' + UI.fmt.int(values.reduce(function (a, b) { return a + b; }, 0)) + '</div></section>';
  }

  function groupCard(mod) {
    var cfg = mod.dashboard.group;
    if (!cfg) {
      return '<section class="card"><div class="card-body">' +
        UI.emptyState({ icon: 'chart', title: 'No grouping field configured', text: 'The registry wizard generates this breakdown from the module schema.' }) +
        '</div></section>';
    }
    var items = Store.group(mod.id);
    return '<section class="card"><div class="card-head"><div class="card-head-text"><h2 class="card-title">' + UI.esc(cfg.label) + '</h2>' +
      '<p class="card-sub">' + items.length + ' group' + (items.length === 1 ? '' : 's') + ' in the current data</p></div>' +
      '<div class="card-actions">' + UI.sparkline(items.map(function (item) { return item.value; })) + '</div></div>' +
      '<div class="card-body">' +
      (items.length ? UI.shareRows(items, { format: function (v) { return UI.fmt.int(v); } })
        : UI.emptyState({ icon: 'inbox', title: 'No records to group', text: 'Run the pipeline to bring records into this module.' })) +
      '</div></section>';
  }

  function recentCard(mod) {
    var rows = sortedRecords(mod).slice(0, 6);
    var head = '<tr>';
    for (var i = 0; i < mod.schema.length; i++) head += '<th scope="col" class="' + (mod.schema[i].type === 'number' ? 'num' : '') + '">' + UI.esc(mod.schema[i].label) + '</th>';
    head += '<th scope="col">Source</th></tr>';

    var body = '';
    for (i = 0; i < rows.length; i++) {
      body += '<tr>';
      for (var f = 0; f < mod.schema.length; f++) body += cell(mod, rows[i], mod.schema[f]);
      body += '<td class="mono">' + UI.esc(rows[i]._source || 'native') + '</td></tr>';
    }

    return '<section class="card"><div class="card-head"><div class="card-head-text"><h2 class="card-title">Latest records</h2>' +
      '<p class="card-sub">Sorted by ingestion time</p></div>' +
      '<div class="card-actions"><a class="btn btn-secondary btn-sm" href="#/module/' + UI.esc(mod.id) + '/records">' + UI.icon('inbox') + 'All records</a></div></div>' +
      (rows.length
        ? '<div class="table-wrap"><table class="data"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>'
        : UI.emptyState({ icon: 'inbox', title: 'No records yet', text: 'This module is registered but empty. Run the pipeline or enter a record to populate it.' })) +
      '</section>';
  }

  function integrationCard(mod) {
    var connection = mod.adapter.connection;
    var rows = '';
    for (var key in connection) {
      if (Object.prototype.hasOwnProperty.call(connection, key)) {
        rows += '<div class="kv-row"><dt>' + UI.esc(key) + '</dt><dd class="mono">' + UI.esc(connection[key]) + '</dd></div>';
      }
    }
    var mapping = mod.adapter.mapping;
    var mappingRows = '';
    for (var mk in mapping) {
      if (Object.prototype.hasOwnProperty.call(mapping, mk)) {
        mappingRows += '<tr><td class="mono">' + UI.esc(mapping[mk]) + '</td><td class="mono">' + UI.esc(mk) + '</td></tr>';
      }
    }

    return '<section class="card"><div class="card-head"><div class="card-head-text"><h2 class="card-title">Integration</h2>' +
      '<p class="card-sub">' + (mod.kind === 'native' ? 'Native module — records are typed in the workspace' : 'External adapter — read-only mirror') + '</p></div>' +
      '<div class="card-actions">' + UI.badge(mod.adapter.syncMode, 'neutral') + UI.badge(mod.adapter.interval, 'neutral') + '</div></div>' +
      '<div class="card-body"><div class="overview-grid"><div class="kv">' +
      '<div class="kv-row"><dt>Adapter</dt><dd>' + UI.esc(mod.adapter.type) + '</dd></div>' +
      '<div class="kv-row"><dt>Module key</dt><dd class="mono">' + UI.esc(mod.key) + '</dd></div>' +
      '<div class="kv-row"><dt>Owner</dt><dd>' + UI.esc(mod.owner) + '</dd></div>' +
      '<div class="kv-row"><dt>Version</dt><dd class="mono">' + UI.esc(mod.version) + '</dd></div>' +
      '<div class="kv-row"><dt>Registered</dt><dd>' + UI.esc(UI.dateFull(mod.createdAt)) + '</dd></div>' +
      '<div class="kv-row"><dt>Last synced</dt><dd>' + UI.esc(UI.stamp(mod.source.lastSyncedAt)) + '</dd></div>' +
      rows + '</div>' +
      '<div class="stack-3">' +
      (mappingRows
        ? '<div class="table-wrap"><table class="data"><caption>Source column → workspace field</caption>' +
          '<thead><tr><th scope="col">Source</th><th scope="col">Field</th></tr></thead><tbody>' + mappingRows + '</tbody></table></div>'
        : '<p class="text-sm text-muted">No source mapping — this module writes straight to the central database.</p>') +
      '<div class="stack-2"><h3 class="chart-title">Events emitted</h3><div class="row-wrap">' +
      mod.events.map(function (name) { return UI.badge(name, 'neutral'); }).join('') + '</div></div>' +
      '</div></div>' +
      '<div class="card-foot">Sample configuration only. The prototype never opens a live connection to ' + UI.esc(mod.adapter.type) + '.</div>' +
      '</section>';
  }

  function rulesCard(mod) {
    var failures = Store.ruleFailureCounts();
    var enabled = 0;
    var i;
    var counts = '';
    for (i = 0; i < mod.rules.length; i++) {
      if (mod.rules[i].enabled) enabled++;
      var hits = failures[mod.rules[i].id] || 0;
      counts += '<div class="kv-row"><dt class="mono">' + UI.esc(mod.rules[i].type) + '</dt><dd>' + UI.esc(mod.rules[i].label) +
        (hits ? ' <span class="badge badge-warn">' + hits + ' failed</span>' : '') + '</dd></div>';
    }
    return '<section class="card"><div class="card-head"><div class="card-head-text"><h2 class="card-title">Validation rules</h2>' +
      '<p class="card-sub">' + enabled + ' of ' + mod.rules.length + ' enabled</p></div>' +
      '<div class="card-actions"><a class="btn btn-secondary btn-sm" href="#/pipeline?module=' + UI.esc(mod.id) + '">' + UI.icon('rule') + 'Manage in pipeline</a></div></div>' +
      '<div class="card-body">' + (mod.rules.length ? '<div class="kv">' + counts + '</div>' : UI.emptyState({ icon: 'rule', title: 'No validation rules', text: 'Every inbound record is accepted as-is.' })) +
      '</div></section>';
  }

  /* Domain panels: one renderer, config lives on the module's dashboard object.
     Panels are the operational queue for each module — filtered, sorted, capped. */
  function panelRows(mod, panel) {
    var filters = panel.filters || [];
    var rows = mod.records.filter(function (rec) {
      for (var i = 0; i < filters.length; i++) {
        var f = filters[i];
        var hit = (f.values || []).indexOf(rec[f.field]) !== -1;
        if (f.exclude) hit = !hit;
        if (!hit) return false;
      }
      return true;
    });
    if (panel.sort) {
      var s = panel.sort;
      rows.sort(function (a, b) {
        var av = a[s.field];
        var bv = b[s.field];
        var cmp;
        var an = Number(av);
        var bn = Number(bv);
        if (av !== undefined && bv !== undefined && av !== '' && bv !== '' && !isNaN(an) && !isNaN(bn)) cmp = an - bn;
        else cmp = String(av === undefined ? '' : av).localeCompare(String(bv === undefined ? '' : bv));
        return s.dir === 'desc' ? -cmp : cmp;
      });
    }
    return { rows: rows, total: rows.length };
  }

  function panelCard(mod, panel) {
    var res = panelRows(mod, panel);
    var total = res.total;
    var limit = panel.limit || 8;
    var shown = res.rows.slice(0, limit);
    var fields = [];
    var i;
    var s;

    for (i = 0; i < panel.columns.length; i++) {
      for (s = 0; s < mod.schema.length; s++) {
        if (mod.schema[s].key === panel.columns[i]) { fields.push(mod.schema[s]); break; }
      }
    }

    var head = '<tr>';
    for (i = 0; i < fields.length; i++) {
      head += '<th scope="col" class="' + (fields[i].type === 'number' ? 'num' : '') + '">' + UI.esc(fields[i].label) + '</th>';
    }
    head += '</tr>';

    var body = '';
    for (i = 0; i < shown.length; i++) {
      body += '<tr>';
      for (var c = 0; c < fields.length; c++) body += cell(mod, shown[i], fields[c]);
      body += '</tr>';
    }

    var inner = total
      ? '<div class="table-wrap"><table class="data"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>'
      : UI.emptyState({
        icon: 'filter',
        title: panel.emptyTitle || 'Nothing matches this view',
        text: panel.emptyText || 'Run the pipeline or enter a record to populate this queue.'
      });

    var foot = 'Showing ' + shown.length + ' of ' + UI.fmt.int(total) +
      ' matching record' + (total === 1 ? '' : 's') + ' · sample data held in this browser';

    return '<section class="card panel-card"><div class="card-head">' +
      '<div class="card-head-text"><h2 class="card-title">' + UI.esc(panel.title) + '</h2>' +
      '<p class="card-sub">' + UI.esc(panel.sub || '') + '</p></div>' +
      '<div class="card-actions">' + UI.badge(panel.tag || 'Queue', 'neutral') +
      '<a class="btn btn-secondary btn-sm" href="#/module/' + UI.esc(mod.id) + '/records">' + UI.icon('inbox') + 'All records</a>' +
      '</div></div>' +
      '<div class="card-body">' + inner + '</div>' +
      '<div class="card-foot">' + UI.esc(foot) + '</div></section>';
  }

  /* ------------------------------------------------ IMS inventory layer ----
     Gated to the IMS module so the shared module template stays generic:
     stock health, stock operations (receive / issue / adjust / transfer) and
     the movement ledger, all backed by Store.stockMovement. */
  var MV = {
    receive: {
      label: 'Receive stock', short: 'Receive', tone: 'ok', icon: 'download',
      title: 'Receive stock', sub: 'Adds units to the selected line and writes a ledger entry',
      qtyLabel: 'Quantity received', refLabel: 'Reference (PO / delivery note)',
      effect: 'Units are added to on hand for that line immediately.'
    },
    issue: {
      label: 'Issue stock', short: 'Issue', tone: 'neutral', icon: 'upload',
      title: 'Issue stock', sub: 'Removes units from the selected line — capped by what is on hand',
      qtyLabel: 'Quantity issued', refLabel: 'Reference (issue / order no.)',
      effect: 'Units leave this line; the ledger keeps the reference and who issued them.'
    },
    adjust: {
      label: 'Adjust stock', short: 'Adjust', tone: 'warn', icon: 'edit',
      title: 'Adjust stock', sub: 'Set the counted quantity after a physical count',
      qtyLabel: 'Counted quantity', refLabel: '',
      effect: 'On hand is set to the counted quantity; the delta is written to the ledger.'
    },
    transfer: {
      label: 'Transfer stock', short: 'Transfer', tone: 'neutral', icon: 'arrowRight',
      title: 'Transfer stock', sub: 'Move units to another warehouse — the target line is created if needed',
      qtyLabel: 'Quantity to transfer', refLabel: 'Reference (transfer note)',
      effect: 'Units leave the source line and arrive in the target warehouse.'
    }
  };

  function isIms(mod) { return mod.id === 'ims'; }

  function canMoveStock(mod) {
    return Store.can('inputRecords') && mod.kind === 'native' && mod.status === 'active';
  }

  function statusBadge(mod, record) {
    var s = Store.stockStatus(record);
    return s === 'out' ? UI.badge('Out of stock', 'danger')
      : s === 'low' ? UI.badge('Low', 'warn')
        : UI.badge('In stock', 'ok');
  }

  function stockLineLabel(rec) {
    var q = Number(rec.qty);
    if (isNaN(q)) q = 0;
    return rec.sku + ' · ' + rec.warehouse + ' — ' + rec.itemName + ' (' + UI.fmt.int(q) + ' on hand)';
  }

  function onHandHint(rec) {
    var q = Number(rec.qty);
    if (isNaN(q)) q = 0;
    var rp = Number(rec.reorderPoint);
    return 'On hand: ' + UI.fmt.int(q) + ' units in ' + rec.warehouse +
      (isNaN(rp) ? '' : ' · reorder point ' + UI.fmt.int(rp));
  }

  function inventoryCard(mod) {
    if (!isIms(mod)) return '';
    var h = Store.stockHealth(mod.id);
    var canMove = canMoveStock(mod);
    var buttons = '';
    if (canMove) {
      var order = ['receive', 'issue', 'adjust', 'transfer'];
      for (var t = 0; t < order.length; t++) {
        var meta = MV[order[t]];
        buttons += '<button class="btn btn-secondary btn-sm" type="button" data-act="mv" data-mv="' + order[t] + '">' +
          UI.icon(meta.icon) + meta.label + '</button>';
      }
    }
    var note = canMove
      ? 'Movements update on-hand quantities immediately and land in the stock ledger below. Issue and transfer quantities are capped by what is on hand.'
      : mod.status !== 'active'
        ? 'This module is deactivated — activate it from the registry to move stock again.'
        : 'Your role is read-only for stock. Switch to Organization admin or Department employee from the account menu to move stock.';

    return '<section class="card"><div class="card-head"><div class="card-head-text">' +
      '<h2 class="card-title">Inventory operations</h2>' +
      '<p class="card-sub">Stock health across ' + UI.fmt.int(h.total) + ' lines · on hand against reorder point</p></div>' +
      '<div class="card-actions">' +
      (h.out ? UI.chip(UI.fmt.int(h.out) + ' out of stock', 'danger') : '') +
      (h.low ? UI.chip(UI.fmt.int(h.low) + ' below reorder point', 'warn') : '') +
      UI.chip(UI.fmt.int(h.ok) + ' healthy', 'ok') +
      '</div></div>' +
      '<div class="card-body"><div class="row-wrap">' + buttons +
      '<p class="text-sm text-muted">' + UI.esc(note) + '</p></div></div>' +
      '<div class="card-foot">Low = on hand below the line\u2019s reorder point · receive, issue, adjust and transfer all land in the ledger.</div></section>';
  }

  function movementLedger(mod) {
    if (!isIms(mod)) return '';
    var rows = Store.movementsFor(mod.id, 50);
    var canMove = canMoveStock(mod);
    var head = '<tr><th scope="col">When</th><th scope="col">Type</th><th scope="col">SKU</th>' +
      '<th scope="col">Item</th><th scope="col">From</th><th scope="col">To</th>' +
      '<th scope="col" class="num">\u0394 Qty</th><th scope="col">Reference</th><th scope="col">By</th></tr>';
    var body = '';
    for (var i = 0; i < rows.length; i++) {
      var m = rows[i];
      var meta = MV[m.type] || { label: m.type, tone: 'neutral' };
      var delta = Number(m.delta) || 0;
      var item = String(m.itemName || '');
      body += '<tr>' +
        '<td class="nowrap text-xs text-muted">' + UI.esc(UI.dateTime(m.at)) + '</td>' +
        '<td>' + UI.badge(meta.short || meta.label, meta.tone) + '</td>' +
        '<td class="mono">' + UI.esc(m.sku) + '</td>' +
        '<td title="' + UI.esc(item) + '">' + UI.esc(item.length > 34 ? item.slice(0, 33) + '\u2026' : item) + '</td>' +
        '<td>' + UI.esc(m.warehouse) + '</td>' +
        '<td>' + UI.esc(m.toWarehouse || '\u2014') + '</td>' +
        '<td class="num nowrap"><span class="value-strong">' + (delta > 0 ? '+' : '') + UI.fmt.int(delta) + '</span></td>' +
        '<td class="mono">' + UI.esc(m.ref || '\u2014') + '</td>' +
        '<td class="nowrap">' + UI.esc(m.actor) + '</td>' +
        '</tr>';
    }

    var toolbar = '<div class="records-toolbar">' +
      UI.searchField('movements-search', 'Search the ledger\u2026', 'Search movements') +
      '<span class="chip chip-mono"><span data-filter-count>' + rows.length + ' of ' + rows.length + '</span></span>' +
      '<span class="spacer"></span>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-act="export-mv"' + (rows.length ? '' : ' disabled') + '>' +
      UI.icon('download') + 'Export CSV</button></div>';

    var inner = rows.length
      ? '<div class="table-wrap"><table class="data" id="movements-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>'
      : UI.emptyState({
        icon: 'inbox',
        title: 'No stock movements yet',
        text: 'Receive, issue, adjust or transfer stock and every change lands here with its reference.',
        action: canMove ? '<button class="btn btn-primary btn-sm" type="button" data-act="mv" data-mv="receive">' + UI.icon('download') + 'Receive stock</button>' : ''
      });

    return '<section class="card"><div class="card-head"><div class="card-head-text">' +
      '<h2 class="card-title">Stock movements</h2>' +
      '<p class="card-sub">Receipts, issues, adjustments and transfers — newest first</p></div>' +
      '<div class="card-actions">' + UI.badge(UI.fmt.int(rows.length) + ' entries', 'neutral') + '</div></div>' +
      toolbar +
      inner +
      '<div class="card-foot">Sample ledger held in this browser · search and export cover the visible entries.</div></section>';
  }

  function openMovementDialog(mod, type) {
    var meta = MV[type];
    if (!meta || !canMoveStock(mod)) return;

    var warehouses = [];
    var i;
    for (i = 0; i < mod.schema.length; i++) {
      if (mod.schema[i].key === 'warehouse' && mod.schema[i].options) warehouses = mod.schema[i].options.slice();
    }

    var lines = mod.records.slice().sort(function (a, b) {
      return String(a.sku).localeCompare(String(b.sku)) || String(a.warehouse).localeCompare(String(b.warehouse));
    });
    var lineOpts = [];
    for (i = 0; i < lines.length; i++) lineOpts.push({ value: lines[i].id, label: stockLineLabel(lines[i]) });

    function currentRec() {
      var id = UI.fieldOf(ctx.body, 'recordId');
      var picked = id ? id.value : '';
      for (var k = 0; k < lines.length; k++) if (lines[k].id === picked) return lines[k];
      return lines[0] || null;
    }

    function refreshHint() {
      var hint = ctx.body.querySelector('#recordId-hint');
      var rec = currentRec();
      if (hint && rec) hint.textContent = onHandHint(rec);
    }

    function refreshTargets() {
      var sel = ctx.body.querySelector('[name="toWarehouse"]');
      if (!sel) return;
      var rec = currentRec();
      var html = '<option value="">Select warehouse\u2026</option>';
      for (var k = 0; k < warehouses.length; k++) {
        if (rec && warehouses[k] === rec.warehouse) continue;
        html += '<option value="' + UI.esc(warehouses[k]) + '">' + UI.esc(warehouses[k]) + '</option>';
      }
      sel.innerHTML = html;
    }

    var body =
      '<form class="form" id="mv-form" novalidate><div class="form-grid">' +
      UI.fieldSelect({
        name: 'recordId', label: 'Stock line', options: lineOpts, required: true, full: true,
        hint: lines[0] ? onHandHint(lines[0]) : ''
      }) +
      (type === 'transfer' ? UI.fieldSelect({ name: 'toWarehouse', label: 'Target warehouse', options: warehouses.filter(function (w) { return !lines[0] || w !== lines[0].warehouse; }), placeholder: 'Select warehouse\u2026', required: true }) : '') +
      UI.fieldText({ name: 'qty', label: meta.qtyLabel, type: 'text', inputmode: 'numeric', placeholder: '0', required: true, hint: type === 'adjust' ? 'Enter 0 when the line is depleted.' : '' }) +
      (meta.refLabel ? UI.fieldText({ name: 'ref', label: meta.refLabel, placeholder: 'Optional' }) : '') +
      UI.fieldTextarea({
        name: 'note', label: type === 'adjust' ? 'Reason for adjustment' : 'Note',
        rows: 2, required: type === 'adjust',
        hint: type === 'adjust' ? 'Required — the ledger shows this as the cause.' : 'Optional context for the ledger.'
      }) +
      '</div></form>' +
      UI.banner('info', 'info', 'What this does', UI.esc(meta.effect) + ' Nothing is written back to any external source system.');

    var ctx = UI.dialog({
      title: meta.title,
      sub: meta.sub,
      wide: true,
      body: body,
      foot: '<button class="btn btn-secondary" type="button" data-overlay-close>Cancel</button><span class="spacer"></span>' +
        '<button class="btn btn-primary" type="button" data-act="save-mv">' + UI.icon('check') + meta.label + '</button>'
    });
    if (!ctx) return;

    UI.on(ctx.overlay, 'change', '[name="recordId"]', function () {
      refreshHint();
      refreshTargets();
    });

    UI.on(ctx.overlay, 'click', '[data-act="save-mv"]', function (event, button) {
      var values = UI.readForm(ctx.body);
      UI.clearErrors(ctx.body);
      var res = Store.stockMovement(mod.id, {
        type: type,
        recordId: values.recordId,
        qty: values.qty,
        toWarehouse: values.toWarehouse,
        ref: values.ref,
        note: values.note
      });
      if (!res.ok) {
        if (res.field) UI.showFieldError(ctx.body, res.field, res.message);
        ctx.body.insertAdjacentHTML('afterbegin', UI.errorSummary(
          [{ id: res.field || 'qty', message: res.message }],
          'This movement cannot be recorded'
        ));
        var first = res.field ? ctx.body.querySelector('#' + res.field) : null;
        if (first && first.focus) first.focus();
        return;
      }
      UI.setBusy(button, true, 'Recording');
      var mv = res.movement;
      var sign = res.delta > 0 ? '+' : '';
      var after = Number(res.record.qty);
      ctx.close();
      UI.toastOk(
        meta.short + ' recorded',
        mv.sku + ' · ' + sign + res.delta + ' · now ' + UI.fmt.int(isNaN(after) ? 0 : after) + ' on hand in ' + mv.warehouse +
        (mv.toWarehouse ? ' → ' + mv.toWarehouse : '')
      );
    });

    UI.wireErrorSummary(ctx.body);
  }

  function moduleHeader(mod, tab) {
    var active = mod.status === 'active';
    var down = mod.source.state === 'down';
    var canRun = Store.can('editRules');
    var canInput = Store.can('inputRecords') && mod.kind === 'native' && active;

    var actions = '<a class="btn ' + (tab === 'records' ? 'btn-primary' : 'btn-secondary') + ' btn-sm" href="#/module/' + UI.esc(mod.id) + '">Dashboard</a>' +
      '<a class="btn ' + (tab === 'records' ? 'btn-secondary' : 'btn-primary') + ' btn-sm" href="#/module/' + UI.esc(mod.id) + '/records">Records</a>';
    var sales = NS.DealViews.isSales(mod);
    if (canInput) actions += '<button class="btn btn-secondary btn-sm" type="button" data-act="add-record">' + UI.icon('plus') + (sales ? 'New deal' : 'Add record') + '</button>';
    if (canRun && active) {
      actions += mod.kind === 'external'
        ? '<button class="btn btn-secondary btn-sm" type="button" data-act="run-sync"' + (down ? ' disabled title="Source is unreachable"' : '') + '>' + UI.icon('sync') + 'Sync now</button>'
        : '<button class="btn btn-secondary btn-sm" type="button" data-act="run-bulk">' + UI.icon('play') + (sales ? 'Import lead batch' : 'Import batch') + '</button>';
    }

    return '<section class="module-head"><div class="module-head-main">' +
      '<div class="module-head-meta">' +
      UI.badge(mod.kind === 'native' ? 'Native module' : 'External module', mod.kind === 'native' ? 'native' : 'external') +
      (active ? UI.chip('Active', 'ok') : UI.chip('Deactivated')) +
      (down ? UI.chip('Serving last synced data', 'warn') : '') +
      '<span class="chip chip-mono">v' + UI.esc(mod.version) + '</span>' +
      '<span class="chip">' + UI.esc(mod.owner) + '</span>' +
      '</div>' +
      '<h2 class="module-name">' + UI.esc(mod.name) + '</h2>' +
      '<p class="module-desc">' + UI.esc(mod.description) + '</p>' +
      '<p class="text-xs text-muted">' + UI.fmt.int(mod.records.length) + ' records · last synced ' + UI.esc(UI.relTime(mod.source.lastSyncedAt)) +
      ' · routes <span class="mono">#/module/' + UI.esc(mod.key) + '</span></p>' +
      '</div><div class="module-head-actions">' + actions + '</div></section>';
  }

  function statusBanners(mod) {
    var html = '';
    if (mod.status !== 'active') {
      html += UI.banner('danger', 'ban', 'This module is deactivated',
        'It is hidden from the sidebar and excluded from the shared metrics layer. Records stay in the central database.',
        Store.can('manageModules') ? '<button class="btn btn-secondary btn-sm" type="button" data-act="activate">' + UI.icon('check') + 'Activate module</button>' : '');
    }
    if (mod.source.state === 'down') {
      html += UI.banner('warn', 'alert', 'Serving last synced data',
        'The source is unreachable, so these numbers come from the snapshot captured <strong>' + UI.esc(UI.stamp(mod.source.lastSyncedAt)) + '</strong>. Pipeline syncs are blocked until the source responds again. Figures are not live.',
        Store.can('editRules') ? '<button class="btn btn-secondary btn-sm" type="button" data-act="source-up">' + UI.icon('sync') + 'Mark reachable</button>' : '');
    }
    if (mod.kind === 'external') {
      html += UI.banner('info', 'lock', 'Read-only module',
        'Records are synced from ' + UI.esc(mod.adapter.type) + ' and can never be edited or deleted from the workspace. Nothing is written back to the source.');
    }
    return html;
  }

  function recordsView(mod) {
    var rows = sortedRecords(mod);
    var total = rows.length;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (ui.page > pages) ui.page = pages;
    if (ui.page < 1) ui.page = 1;
    var start = (ui.page - 1) * PAGE_SIZE;
    var slice = rows.slice(start, start + PAGE_SIZE);

    var ims = isIms(mod);
    var head = '<tr>';
    var i;
    for (i = 0; i < mod.schema.length; i++) head += '<th scope="col" class="' + (mod.schema[i].type === 'number' ? 'num' : '') + '">' + UI.esc(mod.schema[i].label) + '</th>';
    if (ims) head += '<th scope="col">Stock status</th>';
    head += '<th scope="col">Source</th><th scope="col">Ingested</th></tr>';

    var body = '';
    for (i = 0; i < slice.length; i++) {
      body += '<tr>';
      for (var f = 0; f < mod.schema.length; f++) body += cell(mod, slice[i], mod.schema[f]);
      if (ims) body += '<td>' + statusBadge(mod, slice[i]) + '</td>';
      body += '<td class="mono">' + UI.esc(slice[i]._source || 'native') + '</td>' +
        '<td class="nowrap text-xs text-muted">' + UI.esc(UI.stamp(slice[i]._ingestedAt)) + '</td></tr>';
    }

    var canInput = Store.can('inputRecords') && mod.kind === 'native' && mod.status === 'active';
    var toolbar = '<div class="records-toolbar">' + UI.searchField('records-search', 'Search ' + mod.name + ' records…', 'Search records') +
      '<span class="chip chip-mono"><span data-filter-count>' + total + ' of ' + total + '</span></span>' +
      '<span class="spacer"></span>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-act="export"' + (total ? '' : ' disabled') + '>' + UI.icon('download') + 'Export CSV</button>' +
      (canInput ? '<button class="btn btn-primary btn-sm" type="button" data-act="add-record">' + UI.icon('plus') + (NS.DealViews.isSales(mod) ? 'New deal' : 'Add record') + '</button>' : '') +
      '</div>';

    var pagination = total > PAGE_SIZE
      ? '<div class="pagination"><span>Page ' + ui.page + ' of ' + pages + '</span>' +
        '<button class="btn btn-secondary btn-sm" type="button" data-act="page" data-page="' + (ui.page - 1) + '"' + (ui.page === 1 ? ' disabled' : '') + '>Previous</button>' +
        '<button class="btn btn-secondary btn-sm" type="button" data-act="page" data-page="' + (ui.page + 1) + '"' + (ui.page === pages ? ' disabled' : '') + '>Next</button>' +
        '<span class="spacer"></span><span>' + UI.fmt.int(start + 1) + '–' + UI.fmt.int(Math.min(start + PAGE_SIZE, total)) + ' of ' + UI.fmt.int(total) + '</span></div>'
      : '';

    var table = '<section class="card">' + toolbar +
      (total
        ? '<div class="table-wrap"><table class="data" id="records-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' + pagination
        : UI.emptyState({
          icon: 'inbox',
          title: 'No records in this module',
          text: canInput ? 'Enter the first record with “Add record”, or import a batch from the pipeline.' : 'Records appear here once the pipeline or the source system delivers them.',
          action: canInput ? '<button class="btn btn-primary btn-sm" type="button" data-act="add-record">' + UI.icon('plus') + 'Add record</button>' : ''
        })) +
      '</section>';

    return table;
  }

  function openRecordDialog(mod) {
    var fields = '';
    var i;
    for (i = 0; i < mod.schema.length; i++) {
      var field = mod.schema[i];
      if (field.type === 'enum') {
        fields += UI.fieldSelect({ name: field.key, label: field.label, options: field.options || [], placeholder: 'Select…', required: field.required });
      } else if (field.type === 'number') {
        fields += UI.fieldText({ name: field.key, label: field.label, type: 'text', inputmode: 'decimal', placeholder: '0', required: field.required });
      } else if (field.type === 'date') {
        fields += UI.fieldText({ name: field.key, label: field.label, type: 'datetime-local', required: field.required });
      } else if (field.type === 'email') {
        fields += UI.fieldText({ name: field.key, label: field.label, type: 'email', placeholder: 'name@ifixz.co', required: field.required });
      } else {
        fields += UI.fieldText({ name: field.key, label: field.label, required: field.required });
      }
    }

    var ctx = UI.dialog({
      title: 'New ' + mod.name + ' record',
      sub: 'Typed input runs through the same validation rules as synced data',
      wide: true,
      body: '<form class="form" id="record-form" novalidate><div class="form-grid">' + fields + '</div></form>' +
        UI.banner('info', 'info', 'Nothing is saved until the rules pass', 'A record that breaks a rule is kept in the rejected queue with its payload instead of being discarded.'),
      foot: '<button class="btn btn-secondary" type="button" data-overlay-close>Cancel</button><span class="spacer"></span>' +
        '<button class="btn btn-primary" type="button" data-act="save-record">' + UI.icon('check') + 'Validate and save</button>'
    });
    if (!ctx) return;

    UI.on(ctx.overlay, 'click', '[data-act="save-record"]', function (event, button) {
      var values = UI.readForm(ctx.body);
      var payload = {};
      for (var f = 0; f < mod.schema.length; f++) {
        var field = mod.schema[f];
        var raw = values[field.key];
        payload[field.key] = field.type === 'date' ? UI.isoFromLocalInput(raw) : raw;
      }

      UI.clearErrors(ctx.body);
      var reasons = NS.util.validateRecord(mod, payload);
      if (reasons.length) {
        var summary = [];
        for (var r = 0; r < reasons.length; r++) {
          summary.push({ id: reasons[r].field, message: reasons[r].message });
          UI.showFieldError(ctx.body, reasons[r].field, reasons[r].message);
        }
        ctx.body.insertAdjacentHTML('afterbegin', UI.errorSummary(summary, 'This record breaks ' + reasons.length + ' validation rule' + (reasons.length === 1 ? '' : 's')));
        var first = ctx.body.querySelector('#' + reasons[0].field);
        if (first && first.focus) first.focus();
        return;
      }

      UI.setBusy(button, true, 'Validating');
      Store.queueRecord(mod.id, payload);
      var result = Store.runQueued(mod.id);
      ctx.close();
      if (result && result.run.passed) {
        UI.toastOk('Record saved', mod.name + ' — validated and added to the central database.');
      } else if (result) {
        UI.toastError('Record rejected', 'It is in the rejected queue with its failing rules attached.');
      }
    });

    UI.wireErrorSummary(ctx.body);
  }

  function runPipeline(mod, source, button) {
    UI.setBusy(button, true, 'Running');
    window.setTimeout(function () {
      var result = Store.runPipeline({ moduleId: mod.id, source: source });
      if (!result) return;
      if (result.blocked) {
        UI.toastError('Sync blocked', result.message);
        return;
      }
      UI.toastOk('Pipeline run ' + result.run.id, result.run.ingested + ' ingested · ' + result.run.passed + ' passed · ' + result.run.rejected + ' rejected.');
    }, 420);
  }

  VIEWS.module = {
    title: function (params) {
      var mod = Store.module(params.id);
      return mod ? mod.name : 'Module';
    },
    sub: function (params) {
      var mod = Store.module(params.id);
      if (!mod) return 'Unknown module route';
      return params.tab === 'records'
        ? mod.kind === 'native' ? 'Records typed and validated in the workspace' : 'Records mirrored from the source system'
        : 'Module dashboard · ' + (mod.source.state === 'down' ? 'last synced ' + UI.relTime(mod.source.lastSyncedAt) : 'live sample data');
    },
    render: function (root, params, query) {
      lastRoot = root;
      lastParams = params;
      lastQuery = query || null;

      var mod = Store.module(params.id);
      if (!mod) {
        root.innerHTML = '<div class="view-inner">' +
          UI.emptyState({ icon: 'alert', title: 'Module not found', text: 'No module is registered under “' + UI.esc(params.id) + '”.', action: '<a class="btn btn-primary" href="#/registry">Open registry</a>' }) +
          '</div>';
        return;
      }

      var tab = params.tab === 'records' ? 'records' : 'dashboard';
      var viewKey = params.id + ':' + tab;
      if (ui.key !== viewKey) {
        ui.page = 1;
        ui.key = viewKey;
      }
      var i;
      var metrics = mod.dashboard.metrics || [];
      var metricHtml = '';
      for (i = 0; i < metrics.length; i++) metricHtml += metricCard(mod, metrics[i]);

      var panels = (mod.dashboard && mod.dashboard.panels) || [];
      var panelHtml = '';
      for (i = 0; i < panels.length; i++) panelHtml += panelCard(mod, panels[i]);

      var content;
      var ims = isIms(mod);
      var deals = NS.DealViews;
      var sales = deals.isSales(mod);
      if (tab === 'records') {
        content = recordsView(mod);
      } else {
        content = (metrics.length ? '<section class="metric-grid">' + metricHtml + '</section>' : '') +
          (sales ? deals.salesSections(query) : '') +
          (ims ? deals.imsCard() : '') +
          movementLedger(mod) +
          panelHtml +
          '<div class="chart-grid-2">' + trendCard(mod) + groupCard(mod) + '</div>' +
          (sales ? '' : recentCard(mod)) +
          '<div class="overview-grid">' + integrationCard(mod) + rulesCard(mod) + '</div>' +
          (sales ? deals.glossaryCard() : '');
      }

      var wrap = shell(root,
        '<div class="stack-4">' + moduleHeader(mod, tab) + statusBanners(mod) + inventoryCard(mod) + '</div>' +
        content +
        '<p class="text-xs text-muted">Sample data stored in this browser only. Nothing leaves the page and no live source system is contacted.</p>');

      UI.on(wrap, 'click', '[data-act="add-record"]', function () {
        if (sales) deals.openCreate();
        else openRecordDialog(mod);
      });
      if (sales || ims) deals.wire(wrap);

      UI.on(wrap, 'click', '[data-act="run-sync"]', function (event, button) { runPipeline(mod, 'sync', button); });
      UI.on(wrap, 'click', '[data-act="run-bulk"]', function (event, button) { runPipeline(mod, 'bulk', button); });

      UI.on(wrap, 'click', '[data-act="activate"]', function () {
        Store.setModuleStatus(mod.id, 'active');
        UI.toastOk('Module activated', mod.name + ' is back in the sidebar.');
      });

      UI.on(wrap, 'click', '[data-act="source-up"]', function () {
        Store.setSourceState(mod.id, 'up');
        UI.toastOk('Source reachable', mod.name + ' resumes syncing on its normal interval.');
      });

      UI.on(wrap, 'click', '[data-act="page"]', function (event, button) {
        ui.page = Number(button.getAttribute('data-page')) || 1;
        rerender();
      });

      UI.on(wrap, 'click', '[data-act="export"]', function () {
        var columns = mod.schema.map(function (f) { return { key: f.key, label: f.label }; });
        columns.push({ key: '_source', label: 'source' });
        columns.push({ key: '_ingestedAt', label: 'ingested_at' });
        UI.exportCsv(mod.key + '-records.csv', columns, sortedRecords(mod));
        UI.toastInfo('Export started', mod.key + '-records.csv with ' + mod.records.length + ' rows.');
      });

      UI.on(wrap, 'click', '[data-act="mv"]', function (event, button) {
        openMovementDialog(mod, button.getAttribute('data-mv'));
      });

      UI.on(wrap, 'click', '[data-act="export-mv"]', function () {
        var rows = Store.movementsFor(mod.id, 0);
        UI.exportCsv('ims-stock-movements.csv', [
          { key: 'at', label: 'when' },
          { key: 'type', label: 'type' },
          { key: 'sku', label: 'sku' },
          { key: 'itemName', label: 'item_name' },
          { key: 'warehouse', label: 'from' },
          { key: 'toWarehouse', label: 'to' },
          { key: 'delta', label: 'delta' },
          { key: 'ref', label: 'reference' },
          { key: 'note', label: 'note' },
          { key: 'actor', label: 'recorded_by' }
        ], rows);
        UI.toastInfo('Export started', 'ims-stock-movements.csv with ' + rows.length + ' rows.');
      });

      UI.filterRows(UI.fieldOf(wrap, 'records-search'), wrap.querySelector('#records-table'));
      if (ims) UI.filterRows(UI.fieldOf(wrap, 'movements-search'), wrap.querySelector('#movements-table'));
    }
  };
})(window.IFIXZ);
