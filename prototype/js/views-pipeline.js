/* iFixz Workspace — ETL pipeline view: validation rules, run controls,
   run history and the rejected-record queue with retry/discard. */
(function (NS) {
  'use strict';

  var UI = NS.UI;
  var Store = NS.Store;
  var VIEWS = (NS.Views = NS.Views || {});

  var ui = { moduleId: 'ims' };
  var lastRoot = null;
  var lastParams = null;
  var lastQuery = null;

  function rerender() {
    if (lastRoot) VIEWS.pipeline.render(lastRoot, lastParams, lastQuery);
  }

  function shell(root, html) {
    var wrap = UI.el('<div class="view-inner">' + html + '</div>');
    root.innerHTML = '';
    root.appendChild(wrap);
    return wrap;
  }

  function ruleById(ruleId) {
    var modules = Store.modules();
    for (var i = 0; i < modules.length; i++) {
      for (var r = 0; r < modules[i].rules.length; r++) {
        if (modules[i].rules[r].id === ruleId) return { module: modules[i], rule: modules[i].rules[r] };
      }
    }
    return null;
  }

  function fieldLabel(mod, key) {
    for (var i = 0; i < mod.schema.length; i++) if (mod.schema[i].key === key) return mod.schema[i].label;
    return key;
  }

  function modulePicker(mod) {
    var modules = Store.activeModules();
    var html = '<div class="chip-rail">';
    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      var count = Store.rejectedFor(m.id).length;
      html += '<button class="chip-btn" type="button" data-act="pick" data-id="' + UI.esc(m.id) + '" aria-pressed="' + (m.id === mod.id) + '">' +
        UI.esc(m.name) +
        (m.source.state === 'down' ? '<span class="nav-stale" title="Source unreachable"></span>' : '') +
        (count ? '<span class="chip-btn-count">' + count + '</span>' : '') + '</button>';
    }
    return html + '</div>';
  }

  function rulesCard(mod) {
    var failures = Store.ruleFailureCounts();
    var canEdit = Store.can('editRules');
    var rows = '';
    for (var i = 0; i < mod.rules.length; i++) {
      var rule = mod.rules[i];
      var hits = failures[rule.id] || 0;
      rows += '<div class="rule-row' + (rule.enabled ? '' : ' is-off') + '">' +
        '<span class="rule-type">' + UI.esc(rule.type) + '</span>' +
        '<span class="rule-body"><span class="rule-text">' + UI.esc(rule.label) + '</span>' +
        '<span class="rule-meta">' + UI.esc(rule.field) + ' · ' + UI.esc(fieldLabel(mod, rule.field)) +
        (hits ? ' · ' + hits + ' rejected record' + (hits === 1 ? '' : 's') : ' · no recent failures') + '</span></span>' +
        '<span class="rule-actions">' +
        (canEdit
          ? '<span class="switch"><input type="checkbox" id="rule-' + UI.esc(rule.id) + '" data-act="toggle-rule" data-id="' + UI.esc(rule.id) + '"' + (rule.enabled ? ' checked' : '') +
            ' aria-label="' + UI.esc((rule.enabled ? 'Disable' : 'Enable') + ' rule: ' + rule.label) + '"><span class="switch-track"></span></span>' +
            '<button class="link-btn" type="button" data-act="remove-rule" data-id="' + UI.esc(rule.id) + '">Remove</button>'
          : '<span class="badge badge-neutral">' + UI.icon('lock') + 'Admin only</span>') +
        '</span></div>';
    }

    var foot = '<div class="card-foot">' + mod.rules.length + ' rule' + (mod.rules.length === 1 ? '' : 's') + ' · ' +
      mod.rules.filter(function (r) { return r.enabled; }).length + ' enabled · evaluated on every run before a record reaches the central database.</div>';

    return '<section class="card"><div class="card-head"><div class="card-head-text"><h2 class="card-title">Validation rules</h2>' +
      '<p class="card-sub">' + UI.esc(mod.name) + ' · rules run in order, every failing rule is reported</p></div>' +
      '<div class="card-actions">' +
      (canEdit ? '<button class="btn btn-primary btn-sm" type="button" data-act="add-rule">' + UI.icon('plus') + 'Add rule</button>' : '') +
      '</div></div><div class="card-body">' +
      (mod.rules.length ? '<div class="rule-list">' + rows + '</div>' : UI.emptyState({ icon: 'rule', title: 'No rules yet', text: 'Without rules every inbound record is accepted as-is.' })) +
      '</div>' + foot + '</section>';
  }

  function rejectedCard() {
    var all = Store.state.rejected;
    var rows = '';
    var limit = Math.min(all.length, 20);
    for (var i = 0; i < limit; i++) {
      var row = all[i];
      var mod = Store.module(row.moduleId);
      var reasons = '';
      for (var r = 0; r < row.reasons.length; r++) {
        reasons += '<span class="reason-item">' + UI.icon('alert') + '<span>' + UI.esc(row.reasons[r].message) +
          ' <span class="mono">(' + UI.esc(row.reasons[r].value) + ')</span></span></span>';
      }
      var payload = '';
      var shown = 0;
      if (mod) {
        for (var f = 0; f < mod.schema.length && shown < 3; f++) {
          var key = mod.schema[f].key;
          var value = row.payload[key];
          if (value === undefined || value === '') continue;
          payload += '<span>' + UI.esc(key) + ': <span class="mono">' + UI.esc(String(value)).slice(0, 28) + '</span></span>';
          shown++;
        }
      }
      rows += '<tr><td><span class="rejected-id">' + UI.esc(row.id) + '</span></td>' +
        '<td>' + (mod ? '<a href="#/module/' + UI.esc(mod.id) + '">' + UI.esc(mod.name) + '</a>' : '—') +
        '<br><span class="text-xs text-muted">' + UI.esc(row.source) + ' · ' + UI.esc(UI.relTime(row.receivedAt)) + '</span></td>' +
        '<td><span class="reason-list">' + reasons + '</span></td>' +
        '<td><span class="stack-tight">' + (payload || '<span class="text-muted">—</span>') + '</span></td>' +
        '<td class="actions"><button class="btn btn-secondary btn-sm" type="button" data-act="retry" data-id="' + UI.esc(row.id) + '">Retry</button>' +
        '<button class="link-btn" type="button" data-act="discard" data-id="' + UI.esc(row.id) + '">Discard</button></td></tr>';
    }

    var table = all.length
      ? '<div class="table-wrap"><table class="data" id="rejected-table"><caption>Showing ' + limit + ' of ' + all.length +
        ' rejected records · <span data-filter-count>' + all.length + ' of ' + all.length + '</span></caption>' +
        '<thead><tr><th scope="col">Record</th><th scope="col">Module</th><th scope="col">Failing rules</th><th scope="col">Payload</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>'
      : UI.emptyState({ icon: 'check', title: 'Rejected queue is empty', text: 'Every record received so far passed validation.' });

    return '<section class="card"><div class="card-head"><div class="card-head-text"><h2 class="card-title">Rejected records</h2>' +
      '<p class="card-sub">Kept with the failing rules and the original payload — nothing is dropped silently</p></div>' +
      '<div class="card-actions">' + UI.chip(all.length + ' waiting', all.length ? 'warn' : 'ok', true) + '</div></div>' +
      '<div class="filters-row">' + UI.searchField('rejected-search', 'Search id, module, field or value…', 'Search rejected records') +
      '<a class="btn btn-ghost btn-sm" href="#/pipeline">' + UI.icon('sync') + 'Show all modules</a></div>' +
      table + '</section>';
  }

  function runCard(mod) {
    var last = null;
    var runs = Store.state.runs;
    for (var i = 0; i < runs.length; i++) if (runs[i].moduleId === mod.id) { last = runs[i]; break; }
    var queued = Store.queued(mod.id).length;
    var down = mod.source.state === 'down';

    var kv = '<div class="kv">' +
      '<div class="kv-row"><dt>Module</dt><dd>' + UI.esc(mod.name) + '</dd></div>' +
      '<div class="kv-row"><dt>Adapter</dt><dd>' + UI.esc(mod.adapter.type) + ' · ' + UI.esc(mod.adapter.syncMode) + '</dd></div>' +
      '<div class="kv-row"><dt>Interval</dt><dd>' + UI.esc(mod.adapter.interval) + '</dd></div>' +
      '<div class="kv-row"><dt>Last synced</dt><dd>' + (last ? UI.esc(UI.stamp(last.at)) + ' <span class="text-muted text-xs">(' + UI.esc(UI.relTime(last.at)) + ')</span>' : '—') + '</dd></div>' +
      (mod.kind === 'native' ? '<div class="kv-row"><dt>Queued input</dt><dd>' + queued + ' record' + (queued === 1 ? '' : 's') + '</dd></div>' : '') +
      '</div>';

    var actions = '';
    if (mod.kind === 'external') {
      actions = '<button class="btn btn-primary btn-block" type="button" data-act="sync"' + (down ? ' disabled title="Source is unreachable"' : '') + '>' +
        UI.icon('sync') + (down ? 'Source unreachable' : 'Sync now') + '</button>';
    } else {
      actions = '<button class="btn btn-primary btn-block" type="button" data-act="bulk">' + UI.icon('play') + 'Run pipeline (import batch)</button>' +
        (queued ? '<button class="btn btn-secondary btn-block" type="button" data-act="run-queued">' + UI.icon('inbox') + 'Validate ' + queued + ' queued record' + (queued === 1 ? '' : 's') + '</button>' : '');
    }

    return '<section class="card"><div class="card-head"><div class="card-head-text"><h2 class="card-title">Run the pipeline</h2>' +
      '<p class="card-sub">Simulated ingestion — rules run before records land</p></div></div>' +
      '<div class="card-body stack-4">' +
      (down ? UI.banner('warn', 'alert', 'Source unreachable', 'Nothing can be pulled from this source. The dashboard keeps serving the last synced snapshot.', '') : '') +
      kv + actions + '</div></section>';
  }

  function healthCard(mod) {
    var pass = Store.passRate();
    var runs = Store.state.runs;
    var ingested = 0;
    var rejected = 0;
    var i;
    for (i = 0; i < runs.length; i++) { ingested += runs[i].ingested; rejected += runs[i].rejected; }
    var failures = Store.ruleFailureCounts();
    var top = [];
    for (var id in failures) {
      if (!Object.prototype.hasOwnProperty.call(failures, id)) continue;
      var found = ruleById(id);
      top.push({ id: id, label: found ? found.rule.label : id, module: found ? found.module.name : '', value: failures[id] });
    }
    top.sort(function (a, b) { return b.value - a.value; });
    top = top.slice(0, 4);

    var topHtml = top.length
      ? UI.shareRows(top.map(function (t) { return { label: t.label, value: t.value }; }))
      : '<p class="text-sm text-muted">No rule failures recorded in the current sample history.</p>';

    return '<section class="card"><div class="card-head"><div class="card-head-text"><h2 class="card-title">Pipeline health</h2>' +
      '<p class="card-sub">Across all modules and ' + runs.length + ' recorded runs</p></div></div>' +
      '<div class="card-body stack-4">' +
      '<div class="stack-tight"><div class="row-wrap"><span class="text-sm">Pass rate</span><span class="push-right text-sm value-strong">' + UI.fmt.pct(pass) + '</span></div>' +
      '<div class="progress"><div class="progress-bar' + (pass >= 97 ? ' is-ok' : ' is-warn') + '" style="width:' + Math.max(2, Math.min(100, pass)) + '%"></div></div></div>' +
      '<div class="run-stats">' +
      '<div class="run-stat"><span>Runs</span><strong>' + runs.length + '</strong></div>' +
      '<div class="run-stat"><span>Ingested</span><strong>' + UI.fmt.compact(ingested) + '</strong></div>' +
      '<div class="run-stat"><span>Rejected</span><strong>' + UI.fmt.compact(rejected) + '</strong></div>' +
      '<div class="run-stat"><span>Rules</span><strong>' + mod.rules.length + '</strong></div>' +
      '</div>' +
      '<div class="stack-2"><h3 class="chart-title">Most frequent failures</h3>' + topHtml + '</div>' +
      '</div></section>';
  }

  function runsCard() {
    var runs = Store.state.runs.slice(0, 6);
    var rows = '';
    for (var i = 0; i < runs.length; i++) {
      var run = runs[i];
      var mod = Store.module(run.moduleId);
      rows += '<div class="activity-row">' + UI.icon(run.source === 'sync' ? 'sync' : 'pipeline') +
        '<span><strong>' + UI.esc(mod ? mod.name : run.moduleId) + '</strong><br><span class="mono text-xs">' + UI.esc(run.id) + ' · ' + UI.esc(run.source) + '</span></span>' +
        '<span class="stack-tight"><span class="activity-time">' + UI.esc(UI.relTime(run.at)) + '</span>' +
        '<span class="text-xs"><span class="text-ok">' + run.passed + ' passed</span> · <span class="text-danger">' + run.rejected + ' rejected</span> · ' + UI.esc(UI.fmt.ms(run.durationMs)) + '</span></span></div>';
    }
    return '<section class="card"><div class="card-head"><div class="card-head-text"><h2 class="card-title">Recent runs</h2>' +
      '<p class="card-sub">Newest first</p></div></div><div class="card-body">' +
      (runs.length ? '<div class="activity-list">' + rows + '</div>' : UI.emptyState({ icon: 'pipeline', title: 'No runs yet', text: 'Trigger a run to see the history here.' })) +
      '</div></section>';
  }

  function showRunResult(mod, result) {
    var run = result.run;
    var reasons = '';
    for (var i = 0; i < result.failed.length && i < 6; i++) {
      var row = result.failed[i];
      var list = '';
      for (var r = 0; r < row.reasons.length; r++) {
        list += '<span class="reason-item">' + UI.icon('alert') + '<span>' + UI.esc(row.reasons[r].message) + '</span></span>';
      }
      reasons += '<div class="review-block"><h4>' + UI.esc(row.id) + ' · <span class="mono">' + UI.esc(run.source) + '</span></h4>' +
        '<div class="reason-list">' + list + '</div></div>';
    }

    UI.dialog({
      title: 'Pipeline run ' + run.id,
      sub: mod.name + ' · ' + run.source + ' · ' + UI.dateTime(run.at),
      wide: true,
      body: '<div class="run-result">' +
        '<div class="run-stats">' +
        '<div class="run-stat"><span>Ingested</span><strong>' + run.ingested + '</strong></div>' +
        '<div class="run-stat"><span>Passed</span><strong class="text-ok">' + run.passed + '</strong></div>' +
        '<div class="run-stat"><span>Rejected</span><strong class="text-danger">' + run.rejected + '</strong></div>' +
        '<div class="run-stat"><span>Duration</span><strong>' + UI.esc(UI.fmt.ms(run.durationMs)) + '</strong></div>' +
        '</div>' +
        (result.failed.length
          ? '<div class="stack-2"><h3 class="chart-title">Rejected in this run</h3>' + reasons +
            (result.failed.length > 6 ? '<p class="text-xs text-muted">+ ' + (result.failed.length - 6) + ' more in the rejected queue.</p>' : '') + '</div>'
          : UI.banner('info', 'check', 'Every record passed', 'All ' + run.ingested + ' inbound records cleared the enabled validation rules.')) +
        '</div>',
      foot: '<a class="btn btn-secondary" href="#/pipeline">' + UI.icon('inbox') + 'Open rejected queue</a>' +
        '<span class="spacer"></span><button class="btn btn-primary" type="button" data-overlay-close>Done</button>'
    });
  }

  function openRuleDialog(mod) {
    var fieldOptions = mod.schema.map(function (f) { return { value: f.key, label: f.label + ' (' + f.key + ')' }; });
    var ctx = UI.dialog({
      title: 'Add validation rule',
      sub: mod.name + ' · applies to every future run',
      body: '<form class="form" id="rule-form" novalidate>' +
        '<div class="form-grid">' +
        UI.fieldSelect({ name: 'field', label: 'Field', options: fieldOptions, placeholder: 'Select a field…', required: true, full: true }) +
        UI.fieldSelect({
          name: 'type', label: 'Rule type', required: true, full: true,
          options: [
            { value: 'required', label: 'Required — value must not be empty' },
            { value: 'numeric', label: 'Numeric — value must parse as a number' },
            { value: 'allowed', label: 'Allowed — value must be in a fixed list' },
            { value: 'duplicate', label: 'Duplicate — key must be unique' },
            { value: 'format', label: 'Format — date, email or pay period' }
          ]
        }) +
        UI.fieldText({ name: 'label', label: 'Rule description', placeholder: 'Shown to users in the rejected queue', required: true, full: true }) +
        '<div data-param="numeric" hidden>' + UI.fieldText({ name: 'min', label: 'Minimum value', type: 'number', value: '0', inputmode: 'numeric', hint: 'Records below this value are rejected.' }) + '</div>' +
        '<div data-param="allowed" hidden>' + UI.fieldText({ name: 'values', label: 'Allowed values', placeholder: 'Open, Invoiced, Closed', hint: 'Comma separated. Leave empty to use every option on the field.' }) + '</div>' +
        '<div data-param="format" hidden>' + UI.fieldSelect({ name: 'kind', label: 'Expected format', options: ['date', 'email', 'period'], value: 'date' }) + '</div>' +
        '<div data-param="duplicate" hidden>' + UI.fieldText({ name: 'scope', label: 'Unique together with (optional)', placeholder: 'warehouse', hint: 'Leave empty for a single-field uniqueness check.' }) + '</div>' +
        '</div></form>',
      foot: '<button class="btn btn-secondary" type="button" data-overlay-close>Cancel</button><span class="spacer"></span>' +
        '<button class="btn btn-primary" type="button" data-act="save-rule">' + UI.icon('check') + 'Add rule</button>'
    });

    if (!ctx) return;

    var typeSelect = UI.fieldOf(ctx.body, 'type');
    var syncParams = function () {
      var type = typeSelect ? typeSelect.value : '';
      var blocks = UI.nodes(ctx.body, '[data-param]');
      for (var i = 0; i < blocks.length; i++) blocks[i].hidden = blocks[i].getAttribute('data-param') !== type;
    };
    if (typeSelect) typeSelect.addEventListener('change', syncParams);
    syncParams();

    UI.on(ctx.overlay, 'click', '[data-act="save-rule"]', function () {
      var values = UI.readForm(ctx.body);
      UI.clearErrors(ctx.body);
      var errors = [];
      if (!values.field) errors.push({ id: 'field', message: 'Choose the field this rule validates.' });
      if (!values.type) errors.push({ id: 'type', message: 'Choose a rule type.' });
      if (!String(values.label || '').trim()) errors.push({ id: 'label', message: 'Describe the rule so users understand the rejection.' });

      var field = null;
      for (var i = 0; i < mod.schema.length; i++) if (mod.schema[i].key === values.field) field = mod.schema[i];
      if (values.type === 'allowed') {
        var list = String(values.values || '').split(',').map(function (v) { return v.trim(); }).filter(function (v) { return v; });
        if (field && !list.length) list = (field.options || []).slice();
        if (!list.length) errors.push({ id: 'values', message: 'List at least one allowed value.' });
        values.values = list;
      }
      if (values.type === 'numeric' && values.min === '') errors.push({ id: 'min', message: 'Enter the minimum accepted value (0 allows any non-negative number).' });

      if (errors.length) {
        ctx.body.insertAdjacentHTML('afterbegin', UI.errorSummary(errors));
        UI.showFieldError(ctx.body, errors[0].id, errors[0].message);
        var first = ctx.body.querySelector('#' + errors[0].id);
        if (first && first.focus) first.focus();
        return;
      }

      var params = {};
      if (values.type === 'numeric') params.min = Number(values.min || 0);
      if (values.type === 'allowed') params.values = values.values;
      if (values.type === 'format') params.kind = values.kind || 'date';
      if (values.type === 'duplicate' && values.scope) params.scope = values.scope;

      Store.addRule(mod.id, {
        field: values.field,
        type: values.type,
        label: String(values.label).trim(),
        params: params
      });
      ctx.close();
      UI.toastOk('Rule added', mod.name + ' — ' + String(values.label).trim());
    });

    UI.wireErrorSummary(ctx.body);
  }

  function runPipeline(mod, source, button) {
    UI.setBusy(button, true, 'Running');
    window.setTimeout(function () {
      var result = Store.runPipeline({ moduleId: mod.id, source: source });
      if (!result) {
        UI.toastError('Run failed', 'The pipeline did not return a result for this module.');
        return;
      }
      if (result.blocked) {
        UI.toastError('Sync blocked', result.message);
        return;
      }
      showRunResult(mod, result);
    }, 420);
  }

  VIEWS.pipeline = {
    title: 'Data pipeline',
    sub: 'Validation rules, run history and the rejected-record queue',
    render: function (root, params, query) {
      lastRoot = root;
      lastParams = params;
      lastQuery = query;

      var modules = Store.activeModules();
      if (!modules.length) {
        root.innerHTML = '<div class="view-inner">' +
          UI.emptyState({ icon: 'registry', title: 'No active modules', text: 'Register a module to start validating inbound records.', action: '<a class="btn btn-primary" href="#/registry">Open registry</a>' }) +
          '</div>';
        return;
      }

      if (query && query.module) {
        var asked = Store.module(query.module);
        if (asked && asked.status === 'active') ui.moduleId = asked.id;
      }
      var mod = Store.module(ui.moduleId);
      if (!mod || mod.status !== 'active') {
        mod = modules[0];
        ui.moduleId = mod.id;
      }

      var wrap = shell(root,
        '<section class="section"><div class="section-head"><h2 class="section-title">Modules</h2>' +
        '<p class="section-desc">Each module owns its own schema and rule set. A run pulls sample inbound rows, validates them and writes the passing ones into the central database.</p></div>' +
        modulePicker(mod) + '</section>' +
        '<div class="pipeline-layout"><div class="stack-4">' +
        rulesCard(mod) +
        rejectedCard() +
        '</div><div class="stack-4">' +
        runCard(mod) +
        healthCard(mod) +
        runsCard() +
        '</div></div>');

      UI.on(wrap, 'click', '[data-act="pick"]', function (event, button) {
        ui.moduleId = button.getAttribute('data-id');
        rerender();
      });

      UI.on(wrap, 'change', '[data-act="toggle-rule"]', function (event, input) {
        Store.toggleRule(mod.id, input.getAttribute('data-id'), input.checked);
      });

      UI.on(wrap, 'click', '[data-act="remove-rule"]', function (event, button) {
        var ruleId = button.getAttribute('data-id');
        var found = ruleById(ruleId);
        var label = found ? found.rule.label : ruleId;
        UI.confirm({
          title: 'Remove validation rule',
          heading: 'Records will no longer be checked against this rule',
          bodyHtml: UI.esc(label) + ' is removed from ' + UI.esc(mod.name) + '. Existing rejected records stay in the queue until they are retried or discarded.',
          confirmLabel: 'Remove rule',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          Store.removeRule(mod.id, ruleId);
          UI.toastInfo('Rule removed', label);
        });
      });

      UI.on(wrap, 'click', '[data-act="add-rule"]', function () { openRuleDialog(mod); });

      UI.on(wrap, 'click', '[data-act="sync"]', function (event, button) { runPipeline(mod, 'sync', button); });
      UI.on(wrap, 'click', '[data-act="bulk"]', function (event, button) { runPipeline(mod, 'bulk', button); });

      UI.on(wrap, 'click', '[data-act="run-queued"]', function (event, button) {
        UI.setBusy(button, true, 'Validating');
        window.setTimeout(function () {
          var result = Store.runQueued(mod.id);
          if (!result) {
            UI.toastInfo('Nothing queued', 'No pending records for ' + mod.name + '.');
            return;
          }
          UI.toastOk('Queued records validated', result.run.passed + ' accepted · ' + result.run.rejected + ' moved to the rejected queue.');
        }, 320);
      });

      UI.on(wrap, 'click', '[data-act="retry"]', function (event, button) {
        var id = button.getAttribute('data-id');
        var result = Store.retryRejected(id);
        if (!result || !result.ok) {
          UI.toastError('Record not found', id + ' is no longer in the rejected queue.');
          return;
        }
        if (result.accepted) {
          UI.toastOk('Record accepted', id + ' passed re-validation and is now in the central database.');
          return;
        }
        UI.toastError('Still failing validation', id + ' breaks ' + result.reasons.length + ' rule' + (result.reasons.length === 1 ? '' : 's') + ' again. Correct the source data, then retry.');
      });

      UI.on(wrap, 'click', '[data-act="discard"]', function (event, button) {
        var id = button.getAttribute('data-id');
        var row = null;
        var rejected = Store.state.rejected;
        for (var i = 0; i < rejected.length; i++) if (rejected[i].id === id) row = rejected[i];
        UI.confirm({
          title: 'Discard rejected record',
          heading: 'This payload is dropped permanently',
          bodyHtml: UI.esc(id) + (row ? ' · ' + UI.esc(row.reasons.length) + ' failing rule' + (row.reasons.length === 1 ? '' : 's') : ''),
          confirmLabel: 'Discard record',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          Store.discardRejected(id);
          UI.toastInfo('Record discarded', id + ' removed from the rejected queue.');
        });
      });

      UI.filterRows(UI.fieldOf(wrap, 'rejected-search'), wrap.querySelector('#rejected-table'));
    }
  };
})(window.IFIXZ);
