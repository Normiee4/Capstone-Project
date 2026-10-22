/* iFixz Workspace — Deal lifecycle layer (FigJam TO-BE overlay): lifecycle
   board, deal queue, deal dialog with stage actions, new-deal entry and the
   IMS handoff card. Gated to Sales Operation and IMS so the shared module
   template stays generic. Every step is backed by Store.advanceDeal. */
(function (NS) {
  'use strict';

  var UI = NS.UI;
  var Store = NS.Store;
  var D = NS.DEALS;
  var SALES = 'sales-operation';
  var QUEUE_LIMIT = 25;
  var MAIN_LANES = [
    { id: 'sales', title: 'Sales pipeline', owner: 'Sales Operation' },
    { id: 'ops', title: 'Operations', owner: 'Sales Operation · IMS' },
    { id: 'closed', title: 'Closed', owner: 'Sales Operation' }
  ];

  function money(value) {
    var n = Number(value);
    if (isNaN(n)) return '—';
    return '₱' + (Math.abs(n) >= 1000000 ? UI.fmt.compact(n) : UI.fmt.int(n));
  }

  function stageTone(label) {
    if (label === 'Done') return 'ok';
    if (label === 'Deal Lost') return 'danger';
    if (label === 'Unpaid / Terms' || label === 'Pending' || label === 'Approval') return 'warn';
    return 'native';
  }

  function stageBadge(label) { return UI.badge(label, stageTone(label)); }

  /* The deal number opens the deal too, so on a phone (where the Open column
     is hidden) the first cell is the way in. */
  function dealLink(deal) {
    return '<button class="link-btn mono" type="button" data-deal-open="' + UI.esc(deal.id) + '">' + UI.esc(deal.dealNo) + '</button>';
  }

  function openButton(deal) {
    return '<button class="btn btn-secondary btn-sm" type="button" data-deal-open="' + UI.esc(deal.id) + '" tabindex="-1" aria-hidden="true">Open</button>';
  }

  function isClosed(deal) { return D.closed.indexOf(deal.stage) !== -1; }

  function time(iso) { return new Date(iso || 0).getTime() || 0; }

  function nextStep(deal) {
    if (deal.stage === 'Done') return { text: 'Closed — fully paid', muted: true };
    if (deal.stage === 'Deal Lost') return { text: deal.lostReason || 'Lost', muted: true };
    var actions = Store.dealActions(deal);
    var pickA = null;
    for (var i = 0; i < actions.length; i++) if (actions[i].primary && actions[i].enabled) { pickA = actions[i]; break; }
    /* "Client replied" is an assumption off the board — never suggest it. */
    for (i = 0; !pickA && i < actions.length; i++) if (actions[i].enabled && actions[i].tone !== 'danger' && actions[i].id !== 'replied') pickA = actions[i];
    if (pickA) return { text: pickA.label, muted: false };
    var stage = Store.dealStage(deal);
    return { text: stage.key === 'approval' ? 'General Manager approval' : stage.hint, muted: true };
  }

  /* ------------------------------------------------------- lifecycle board -- */

  function tile(stage, slot, activeKey) {
    var active = stage.key === activeKey;
    return '<a class="stage-tile' + (active ? ' is-active' : '') + ' is-' + stageTone(stage.label) + '" href="#/module/' + SALES + '?stage=' + stage.key + '"' +
      (active ? ' aria-current="true"' : '') + ' title="' + UI.esc(stage.hint) + '">' +
      '<span class="stage-tile-head"><span class="stage-tile-name">' + UI.esc(stage.label) + '</span>' +
      (stage.owner === 'ims' ? '<span class="stage-tile-owner">IMS</span>' : '') + '</span>' +
      '<span class="stage-tile-count">' + UI.fmt.int(slot.count) + '</span>' +
      '<span class="stage-tile-value">' + UI.esc(money(slot.value)) + '</span></a>';
  }

  function boardCard(activeKey) {
    var counts = Store.dealCounts();
    var lanes = '';
    for (var l = 0; l < MAIN_LANES.length; l++) {
      var lane = MAIN_LANES[l];
      var tiles = '';
      for (var s = 0; s < D.stages.length; s++) {
        if (D.stages[s].lane === lane.id) tiles += tile(D.stages[s], counts[D.stages[s].label], activeKey);
      }
      lanes += '<div class="deal-lane is-' + lane.id + '"><p class="deal-lane-head"><strong>' + UI.esc(lane.title) + '</strong>' +
        '<span>' + UI.esc(lane.owner) + '</span></p><div class="stage-row">' + tiles + '</div></div>';
    }
    return '<section class="card"><div class="card-head"><div class="card-head-text">' +
      '<h2 class="card-title">Deal lifecycle</h2>' +
      '<p class="card-sub">One deal record from New Deal to Done · pick a stage to open its queue</p></div>' +
      '<div class="card-actions">' + (activeKey ? '<a class="btn btn-ghost btn-sm" href="#/module/' + SALES + '">' + UI.icon('x') + 'Clear stage</a>' : '') + '</div></div>' +
      '<div class="card-body"><div class="deal-lanes">' + lanes + '</div></div>' +
      '<div class="card-foot">Tiles marked IMS are handled by the IMS module on the same deal record · count and deal value per stage.</div></section>';
  }

  /* ------------------------------------------------------------ deal queue -- */

  function queueCard(activeKey) {
    var stage = activeKey ? D.stageByKey[activeKey] : null;
    var rows = Store.deals().filter(function (deal) {
      return stage ? deal.stage === stage.label : !isClosed(deal);
    });
    var closedView = stage && stage.lane === 'closed';
    rows.sort(function (a, b) {
      return closedView ? time(b.updatedAt) - time(a.updatedAt) : time(a.updatedAt) - time(b.updatedAt);
    });
    var shown = rows.slice(0, QUEUE_LIMIT);
    var canInput = Store.can('inputRecords') && Store.module(SALES).status === 'active';

    var body = '';
    for (var i = 0; i < shown.length; i++) {
      var deal = shown[i];
      var next = nextStep(deal);
      body += '<tr>' +
        '<td class="nowrap">' + dealLink(deal) + '</td>' +
        '<td>' + UI.esc(deal.customer) + '</td>' +
        '<td class="col-optional">' + UI.esc(deal.track) + '</td>' +
        '<td>' + stageBadge(deal.stage) + '</td>' +
        '<td class="' + (next.muted ? 'text-muted' : '') + '">' + UI.esc(next.text) + '</td>' +
        '<td class="num nowrap">' + UI.esc(money(deal.amount)) + '</td>' +
        '<td class="nowrap text-xs text-muted col-optional" title="' + UI.esc(UI.dateTime(deal.updatedAt)) + '">' + UI.esc(UI.relTime(deal.updatedAt)) + '</td>' +
        '<td class="col-optional">' + openButton(deal) + '</td>' +
        '</tr>';
    }

    var toolbar = '<div class="records-toolbar">' +
      UI.searchField('deals-search', 'Search deals, customers, stages…', 'Search deals') +
      '<span class="chip chip-mono"><span data-filter-count>' + shown.length + ' of ' + shown.length + '</span></span>' +
      '<span class="spacer"></span>' +
      (canInput ? '<button class="btn btn-primary btn-sm" type="button" data-act="new-deal">' + UI.icon('plus') + 'New deal</button>' : '') +
      '</div>';

    var inner = rows.length
      ? '<div class="table-wrap"><table class="data" id="deals-table"><thead><tr>' +
        '<th scope="col">Deal no.</th><th scope="col">Customer</th><th scope="col" class="col-optional">Track</th><th scope="col">Stage</th>' +
        '<th scope="col">Next step</th><th scope="col" class="num">Value</th><th scope="col" class="col-optional">Last moved</th>' +
        '<th scope="col" class="col-optional"><span class="sr-only">Open</span></th>' +
        '</tr></thead><tbody>' + body + '</tbody></table></div>'
      : UI.emptyState({
        icon: 'inbox',
        title: stage ? 'No deals in ' + stage.label : 'No open deals',
        text: stage ? stage.hint + '. Deals appear here when they reach this stage.' : 'Every deal is Done or Lost. Enter a new deal or import a lead batch.'
      });

    return '<section class="card"><div class="card-head"><div class="card-head-text">' +
      '<h2 class="card-title">' + UI.esc(stage ? stage.label + ' queue' : 'Open deals') + '</h2>' +
      '<p class="card-sub">' + UI.esc(stage ? stage.hint : 'Every deal not yet Done or Lost') + ' · ' + (closedView ? 'latest first' : 'waiting longest first') + '</p></div>' +
      '<div class="card-actions">' + UI.badge(UI.fmt.int(rows.length) + ' deal' + (rows.length === 1 ? '' : 's'), 'neutral') + '</div></div>' +
      toolbar + inner +
      '<div class="card-foot">Showing ' + shown.length + ' of ' + UI.fmt.int(rows.length) + ' · open a deal to take its next step.</div></section>';
  }

  function glossaryCard() {
    var rows = '';
    for (var i = 0; i < D.glossary.length; i++) {
      rows += '<div class="kv-row"><dt>' + UI.esc(D.glossary[i].term) + '</dt><dd>' + UI.esc(D.glossary[i].text) + '</dd></div>';
    }
    return '<section class="card"><div class="card-head"><div class="card-head-text"><h2 class="card-title">Terms used in the deal lifecycle</h2>' +
      '<p class="card-sub">Documents and steps named on the deal record</p></div></div>' +
      '<div class="card-body"><dl class="kv glossary">' + rows + '</dl></div></section>';
  }

  /* ------------------------------------------------------- IMS handoff card -- */

  function imsCard() {
    var sales = Store.module(SALES);
    if (!sales) return '';
    var rows = Store.deals().filter(function (deal) { return Store.dealStage(deal).owner === 'ims'; });
    rows.sort(function (a, b) { return time(a.updatedAt) - time(b.updatedAt); });
    var counts = Store.dealCounts();
    var body = '';
    for (var i = 0; i < rows.length; i++) {
      var deal = rows[i];
      var stock = Store.skuStock(deal.sku);
      var short = stock.total < Number(deal.qty);
      body += '<tr>' +
        '<td class="nowrap">' + dealLink(deal) + '</td>' +
        '<td class="col-optional">' + UI.esc(deal.customer) + '</td>' +
        '<td><span class="mono">' + UI.esc(deal.sku) + '</span> · ' + UI.esc(stock.name) + '</td>' +
        '<td class="num">' + UI.fmt.int(deal.qty) + '</td>' +
        '<td class="num">' + (short ? UI.badge(UI.fmt.int(stock.total) + ' on hand', 'warn') : UI.fmt.int(stock.total)) + '</td>' +
        '<td>' + stageBadge(deal.stage) + '</td>' +
        '<td class="mono col-optional">' + UI.esc(deal.poNo || '—') + '</td>' +
        '<td class="col-optional">' + openButton(deal) + '</td>' +
        '</tr>';
    }
    var inner = rows.length
      ? '<div class="table-wrap"><table class="data"><thead><tr><th scope="col">Deal no.</th><th scope="col" class="col-optional">Customer</th><th scope="col">Item</th>' +
        '<th scope="col" class="num">Order qty</th><th scope="col" class="num">On hand</th><th scope="col">Stage</th><th scope="col" class="col-optional">PO</th>' +
        '<th scope="col" class="col-optional"><span class="sr-only">Open</span></th></tr></thead><tbody>' + body + '</tbody></table></div>'
      : UI.emptyState({ icon: 'inbox', title: 'No deals waiting on IMS', text: 'Won deals arrive here after Accounting clears the credit check.' });

    return '<section class="card"><div class="card-head"><div class="card-head-text">' +
      '<h2 class="card-title">Deals in IMS</h2>' +
      '<p class="card-sub">Purchasing, Order Basis and Inventory for won deals · oldest first</p></div>' +
      '<div class="card-actions">' +
      UI.chip(UI.fmt.int(counts['Purchasing'].count) + ' purchasing') +
      UI.chip(UI.fmt.int(counts['Order Basis'].count) + ' order basis', counts['Order Basis'].count ? 'warn' : '') +
      UI.chip(UI.fmt.int(counts['Inventory'].count) + ' inventory') +
      '<a class="btn btn-secondary btn-sm" href="#/module/' + SALES + '">' + UI.icon('arrowRight') + 'Deal lifecycle</a></div></div>' +
      inner +
      '<div class="card-foot">Same deal record as Sales Operation · posting an RR receives the units into the stock ledger below.</div></section>';
  }

  /* ----------------------------------------------------------- deal dialog -- */

  function stepPath(deal) {
    var visited = {};
    var history = deal.history || [];
    for (var i = 0; i < history.length; i++) {
      var hs = D.stageByLabel[history[i].to];
      if (hs) visited[hs.key] = true;
    }
    var current = Store.dealStage(deal).key;
    visited[current] = true;
    var path = ['new', deal.track === 'Government' ? 'gov' : 'followup'];
    if (visited.pending) path.push('pending');
    path = path.concat(['approval', 'won', 'accounting', 'purchasing']);
    if (visited.orderbasis) path.push('orderbasis');
    path = path.concat(['inventory', 'invoicing', 'delivery']);
    if (visited.terms) path.push('terms');
    path.push('done');
    if (current === 'lost') {
      var cut = 0;
      for (i = 0; i < path.length; i++) if (visited[path[i]]) cut = i;
      path = path.slice(0, cut + 1);
      path.push('lost');
    }
    var out = [];
    for (i = 0; i < path.length; i++) {
      out.push({ stage: D.stageByKey[path[i]], state: path[i] === current ? 'current' : visited[path[i]] ? 'done' : 'next' });
    }
    return out;
  }

  function stepper(deal) {
    var steps = stepPath(deal);
    var html = '<ol class="deal-steps" aria-label="Deal lifecycle progress">';
    for (var i = 0; i < steps.length; i++) {
      var st = steps[i];
      var lost = st.stage.key === 'lost';
      html += '<li class="deal-step is-' + st.state + (lost ? ' is-lost' : '') + '"' + (st.state === 'current' ? ' aria-current="step"' : '') + '>' +
        '<span class="deal-step-dot">' + (st.state === 'done' ? UI.icon('check') : lost ? UI.icon('x') : String(i + 1)) + '</span>' +
        '<span class="deal-step-name">' + UI.esc(st.stage.label) + '</span>' +
        (st.stage.owner === 'ims' ? '<span class="deal-step-owner">IMS</span>' : '') +
        '<span class="sr-only"> — ' + (st.state === 'done' ? 'completed' : st.state === 'current' ? 'current stage' : 'not reached') + '</span></li>';
    }
    return html + '</ol>';
  }

  function kv(label, value, mono) {
    return '<div class="kv-row"><dt>' + UI.esc(label) + '</dt><dd' + (mono ? ' class="mono"' : '') + '>' + value + '</dd></div>';
  }

  function detailList(deal) {
    var stock = Store.skuStock(deal.sku);
    var none = '<span class="text-muted">Not yet recorded</span>';
    return '<dl class="kv">' +
      kv('Customer', UI.esc(deal.customer)) +
      kv('Track · region', UI.esc(deal.track + ' · ' + deal.region)) +
      kv('Item', '<span class="mono">' + UI.esc(deal.sku) + '</span> ' + UI.esc(stock.name) + ' × ' + UI.fmt.int(deal.qty)) +
      kv('Deal value', UI.esc(money(deal.amount))) +
      (deal.track === 'Government'
        ? kv('Bid reference', deal.bidRef ? UI.esc(deal.bidRef) : none)
        : kv('Follow-ups', UI.fmt.int(Number(deal.followUps) || 0) + ' of 3')) +
      kv('PO', deal.poNo ? UI.esc(deal.poNo) : none, !!deal.poNo) +
      kv('RR', deal.rrNo ? UI.esc(deal.rrNo + ' · ' + deal.warehouse) : none, !!deal.rrNo) +
      kv('SI / WR', deal.siNo ? UI.esc(deal.siNo) + ' <span class="text-muted">' + UI.esc(deal.docType || '') + '</span>' : none, !!deal.siNo) +
      (deal.terms ? kv('Payment terms', UI.esc(deal.terms)) : '') +
      (deal.lostReason ? kv('Lost reason', UI.esc(deal.lostReason)) : '') +
      kv('Created', UI.esc(UI.dateFull(deal.createdAt))) +
      '</dl>';
  }

  function stageContext(deal) {
    var stage = Store.dealStage(deal);
    if (stage.key === 'accounting') {
      var cc = Store.creditCheck(deal);
      return cc.balance > 0
        ? UI.banner('warn', 'alert', 'Unpaid balance on file',
          UI.esc(deal.customer) + ' still owes <strong>' + UI.esc(money(cc.balance)) + '</strong> on ' + cc.count + ' unpaid / terms deal' + (cc.count === 1 ? '' : 's') +
          ' (' + UI.esc(UI.fmt.list(cc.deals, 3)) + '). Clearing the check needs a note on why this deal may proceed.')
        : UI.banner('info', 'check', 'No unpaid balances', 'The central database holds no unpaid or terms deals for ' + UI.esc(deal.customer) + '.');
    }
    if (stage.owner === 'ims') {
      var stock = Store.skuStock(deal.sku);
      var lines = stock.lines.map(function (l) { return l.warehouse + ' ' + UI.fmt.int(l.qty); });
      return UI.banner(stock.total >= Number(deal.qty) ? 'info' : 'warn', 'database', 'Stock vs. order',
        'Order needs <strong>' + UI.fmt.int(deal.qty) + '</strong> × ' + UI.esc(deal.sku) + '. IMS holds ' + UI.fmt.int(stock.total) + ' on hand' +
        (lines.length ? ' (' + UI.esc(lines.join(' · ')) + ')' : '') + '.');
    }
    if (stage.key === 'delivery') {
      var at = Store.skuStock(deal.sku).lines.filter(function (l) { return l.warehouse === deal.warehouse; });
      var have = at.length ? at[0].qty : 0;
      return UI.banner(have >= Number(deal.qty) ? 'info' : 'warn', 'upload', 'Delivery issues stock',
        'Delivering issues ' + UI.fmt.int(deal.qty) + ' units of ' + UI.esc(deal.sku) + ' from ' + UI.esc(deal.warehouse || 'the receiving warehouse') +
        ', which holds ' + UI.fmt.int(have) + '.');
    }
    return '';
  }

  function actionForm(deal, act) {
    var fields = '';
    for (var i = 0; i < act.fields.length; i++) {
      var f = act.fields[i];
      fields += f.type === 'select'
        ? UI.fieldSelect({ id: 'deal-' + f.name, name: f.name, label: f.label, options: f.options, placeholder: 'Select…', required: f.required })
        : UI.fieldText({ id: 'deal-' + f.name, name: f.name, label: f.label, placeholder: f.placeholder || '', required: f.required });
    }
    var credit = act.id === 'credit' && Store.creditCheck(deal).balance > 0;
    fields += UI.fieldTextarea({
      id: 'deal-note', name: 'note', full: true, rows: 2,
      label: act.noteRequired || credit ? 'Reason' : 'Note',
      required: act.noteRequired || credit,
      hint: act.noteRequired || credit ? 'Required — kept in the deal history.' : 'Optional — kept in the deal history.'
    });
    return '<form class="form deal-form" id="deal-step-form" novalidate>' +
      '<p class="deal-form-title">' + UI.icon(act.icon) + '<strong>' + UI.esc(act.label) + '</strong>' +
      '<span class="text-muted">' + UI.esc(deal.stage) + ' → ' + UI.esc(act.to) + '</span></p>' +
      '<p class="text-sm text-muted">' + UI.esc(act.help) + '</p>' +
      '<div class="form-grid">' + fields + '</div>' +
      '<div class="row-wrap"><button class="btn ' + (act.tone === 'danger' ? 'btn-danger' : 'btn-primary') + ' btn-sm" type="submit" data-deal-confirm>' +
      UI.icon('check') + 'Confirm</button>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-deal-cancel>Cancel</button></div></form>';
  }

  function nextSection(deal, picked) {
    var actions = Store.dealActions(deal);
    if (!actions.length) {
      return '<section class="deal-next"><h3 class="chart-title">Next step</h3>' +
        UI.banner(deal.stage === 'Done' ? 'info' : 'danger', deal.stage === 'Done' ? 'check' : 'ban',
          deal.stage === 'Done' ? 'Deal closed' : 'Deal lost',
          deal.stage === 'Done' ? 'Delivered and fully paid. Nothing left to do on this deal.' : UI.esc(deal.lostReason || 'Closed as lost.')) +
        '</section>';
    }
    var buttons = '';
    var reasons = [];
    var current = null;
    for (var i = 0; i < actions.length; i++) {
      var a = actions[i];
      if (a.id === picked && a.enabled) current = a;
      var cls = !a.enabled ? 'btn-secondary' : a.tone === 'danger' ? 'btn-ghost' : a.primary ? 'btn-primary' : 'btn-secondary';
      buttons += '<button class="btn ' + cls + ' btn-sm" type="button" data-deal-act="' + a.id + '"' +
        (a.enabled ? '' : ' disabled') + (a.id === picked ? ' aria-pressed="true"' : '') + '>' + UI.icon(a.icon) + UI.esc(a.label) + '</button>';
      if (!a.enabled && reasons.indexOf(a.reason) === -1) reasons.push(a.reason);
    }
    return '<section class="deal-next"><h3 class="chart-title">Next step</h3>' +
      stageContext(deal) +
      '<div class="row-wrap">' + buttons + '</div>' +
      (reasons.length ? '<ul class="deal-reasons">' + reasons.map(function (r) { return '<li>' + UI.icon('lock') + UI.esc(r) + '</li>'; }).join('') + '</ul>' : '') +
      (current ? actionForm(deal, current) : '') +
      '</section>';
  }

  function historyList(deal) {
    var items = (deal.history || []).slice().reverse();
    var html = '<ol class="deal-history">';
    for (var i = 0; i < items.length; i++) {
      var h = items[i];
      html += '<li><span class="deal-history-time" title="' + UI.esc(UI.dateTime(h.at)) + '">' + UI.esc(UI.dateShort(h.at)) + '</span>' +
        '<span><strong>' + UI.esc(h.action) + '</strong><br><span class="text-xs text-muted">' + UI.esc(h.actor) +
        (h.from ? ' · ' + UI.esc(h.from) + ' → ' + UI.esc(h.to) : '') + '</span>' +
        (h.note ? '<br><span class="text-sm">' + UI.esc(h.note) + '</span>' : '') + '</span></li>';
    }
    return html + '</ol>';
  }

  function dealBody(deal, picked) {
    var stage = Store.dealStage(deal);
    return '<div class="stack-4">' +
      '<div class="row-wrap">' + stageBadge(deal.stage) + UI.badge(deal.track, 'neutral') +
      UI.badge(stage.owner === 'ims' ? 'Handled in IMS' : 'Handled in Sales Operation', stage.owner === 'ims' ? 'external' : 'neutral') +
      '<span class="text-xs text-muted">' + UI.esc(stage.hint) + '</span></div>' +
      stepper(deal) +
      '<div class="deal-grid"><div class="stack-3">' + nextSection(deal, picked) + '</div>' +
      '<div class="stack-3"><h3 class="chart-title">Deal record</h3>' + detailList(deal) + '</div></div>' +
      '<div class="stack-2"><h3 class="chart-title">History</h3>' + historyList(deal) + '</div>' +
      '</div>';
  }

  function openDeal(id) {
    var deal = Store.deal(id);
    if (!deal) {
      UI.toastError('Deal not found', 'It may have been reset. Reload the queue and try again.');
      return;
    }
    var picked = '';
    var ctx = UI.dialog({
      title: deal.dealNo + ' · ' + deal.customer,
      sub: money(deal.amount) + ' · ' + deal.stage,
      wide: true,
      body: '',
      foot: '<span class="text-xs text-muted">Every step is written to the central database and the deal history.</span><span class="spacer"></span>' +
        '<button class="btn btn-secondary" type="button" data-overlay-close>Close</button>'
    });
    if (!ctx) return;

    function draw(focusSel) {
      var current = Store.deal(id);
      if (!current) { ctx.close(); return; }
      ctx.setBody(dealBody(current, picked));
      ctx.setSub(money(current.amount) + ' · ' + current.stage);
      var target = focusSel ? ctx.body.querySelector(focusSel) : null;
      if (target && target.focus) target.focus();
    }

    UI.on(ctx.overlay, 'click', '[data-deal-act]', function (event, button) {
      picked = button.getAttribute('data-deal-act');
      draw('#deal-step-form input, #deal-step-form select, #deal-step-form textarea');
    });
    UI.on(ctx.overlay, 'click', '[data-deal-cancel]', function () {
      var was = picked;
      picked = '';
      draw('[data-deal-act="' + was + '"]');
    });
    UI.on(ctx.overlay, 'submit', '#deal-step-form', function (event, form) {
      event.preventDefault();
      UI.clearErrors(form);
      var res = Store.advanceDeal(id, picked, UI.readForm(form));
      if (!res.ok) {
        if (res.field) UI.showFieldError(form, res.field, res.message);
        form.insertAdjacentHTML('afterbegin', UI.errorSummary([{ id: res.field ? 'deal-' + res.field : 'deal-note', message: res.message }], 'This step cannot be taken yet'));
        var summary = form.querySelector('[data-error-summary]');
        if (summary && summary.focus) summary.focus();
        return;
      }
      picked = '';
      draw('.deal-next .btn-primary:not([disabled]), [data-overlay-close]');
      UI.toastOk(res.summary, res.deal.dealNo + ' moved from ' + res.from + ' to ' + res.deal.stage + '.');
    });
    UI.wireErrorSummary(ctx.body);
    draw();
  }

  /* -------------------------------------------------------- new deal entry -- */

  function openCreate() {
    var mod = Store.module(SALES);
    if (!mod || !Store.can('inputRecords') || mod.status !== 'active') return;
    var dealNo = Store.nextDealNo();
    var body = '<form class="form" id="new-deal-form" novalidate><div class="form-grid">' +
      UI.fieldText({ id: 'nd-dealNo', name: 'dealNo', label: 'Deal no.', value: dealNo, readonly: true, hint: 'Assigned by the workspace.' }) +
      UI.fieldText({ id: 'nd-customer', name: 'customer', label: 'Customer', required: true }) +
      UI.fieldSelect({ id: 'nd-track', name: 'track', label: 'Track', options: D.tracks, value: 'Private', required: true, hint: 'Government clients go through the bidding track.' }) +
      UI.fieldSelect({ id: 'nd-region', name: 'region', label: 'Region', options: ['NCR', 'Luzon', 'Visayas', 'Mindanao'], placeholder: 'Select…', required: true }) +
      UI.fieldSelect({ id: 'nd-sku', name: 'sku', label: 'Item (from IMS)', options: Store.skuOptions(), placeholder: 'Select…', required: true, full: true }) +
      UI.fieldText({ id: 'nd-qty', name: 'qty', label: 'Quantity', inputmode: 'numeric', placeholder: '0', required: true }) +
      UI.fieldText({ id: 'nd-amount', name: 'amount', label: 'Deal value (₱)', inputmode: 'decimal', placeholder: '0', required: true }) +
      '</div></form>' +
      UI.banner('info', 'pipeline', 'Saved through the ETL pipeline', 'The deal is validated against the Sales Operation rules before it reaches the central database. A deal that breaks a rule is kept in the rejected queue.');

    var ctx = UI.dialog({
      title: 'New deal',
      sub: 'Starts at New Deal · same rules as the Bitrix24 lead sync',
      wide: true,
      body: body,
      foot: '<button class="btn btn-secondary" type="button" data-overlay-close>Cancel</button><span class="spacer"></span>' +
        '<button class="btn btn-primary" type="button" data-act="save-deal">' + UI.icon('check') + 'Validate and save</button>'
    });
    if (!ctx) return;

    UI.on(ctx.overlay, 'click', '[data-act="save-deal"]', function (event, button) {
      var form = ctx.body.querySelector('#new-deal-form');
      var values = UI.readForm(form);
      var payload = {
        dealNo: values.dealNo,
        customer: String(values.customer || '').trim(),
        track: values.track,
        region: values.region,
        sku: values.sku,
        qty: values.qty,
        amount: values.amount,
        stage: 'New Deal',
        createdAt: new Date().toISOString()
      };
      UI.clearErrors(ctx.body);
      var reasons = NS.util.validateRecord(mod, payload);
      if (reasons.length) {
        var summary = [];
        for (var r = 0; r < reasons.length; r++) {
          summary.push({ id: 'nd-' + reasons[r].field, message: reasons[r].message });
          UI.showFieldError(form, reasons[r].field, reasons[r].message);
        }
        ctx.body.insertAdjacentHTML('afterbegin', UI.errorSummary(summary, 'This deal breaks ' + reasons.length + ' validation rule' + (reasons.length === 1 ? '' : 's')));
        var first = ctx.body.querySelector('[data-error-summary]');
        if (first && first.focus) first.focus();
        return;
      }
      UI.setBusy(button, true, 'Validating');
      Store.queueRecord(mod.id, payload);
      var result = Store.runQueued(mod.id);
      ctx.close();
      if (result && result.run.passed) {
        UI.toastOk('Deal created', payload.dealNo + ' · ' + payload.customer + ' is at New Deal.');
        openDeal(payload.dealNo);
      } else {
        UI.toastError('Deal rejected', 'It is in the rejected queue with its failing rules attached.');
      }
    });
    UI.wireErrorSummary(ctx.body);
  }

  NS.DealViews = {
    isSales: function (mod) { return mod.id === SALES; },
    isIms: function (mod) { return mod.id === 'ims'; },
    salesSections: function (query) {
      var key = query && query.stage && D.stageByKey[query.stage] ? query.stage : '';
      return boardCard(key) + queueCard(key);
    },
    glossaryCard: glossaryCard,
    imsCard: imsCard,
    openDeal: openDeal,
    openCreate: openCreate,
    wire: function (wrap) {
      UI.on(wrap, 'click', '[data-deal-open]', function (event, button) { openDeal(button.getAttribute('data-deal-open')); });
      UI.on(wrap, 'click', '[data-act="new-deal"]', function () { openCreate(); });
      UI.filterRows(UI.fieldOf(wrap, 'deals-search'), wrap.querySelector('#deals-table'));
    }
  };
})(window.IFIXZ);
