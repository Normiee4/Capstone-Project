/* iFixz Workspace — Backups view: schedule configuration, snapshot history
   and restore (organization admin only). */
(function (NS) {
  'use strict';

  var UI = NS.UI;
  var Store = NS.Store;
  var VIEWS = (NS.Views = NS.Views || {});

  var lastRoot = null;
  var lastParams = null;
  var lastQuery = null;

  function shell(root, html) {
    var wrap = UI.el('<div class="view-inner">' + html + '</div>');
    root.innerHTML = '';
    root.appendChild(wrap);
    return wrap;
  }

  function rerender() {
    if (lastRoot) VIEWS.backups.render(lastRoot, lastParams, lastQuery);
  }

  function scheduleCard() {
    var cfg = Store.state.backups.config;
    var canManage = Store.can('manageBackups');
    var items = Store.state.backups.items;
    var last = items.length ? items[0] : null;
    var expired = 0;
    for (var i = 0; i < items.length; i++) {
      var age = (Date.now() - new Date(items[i].createdAt).getTime()) / 86400000;
      if (age > cfg.retentionDays) expired++;
    }

    return '<section class="card"><div class="card-head"><div class="card-head-text"><h2 class="card-title">Schedule</h2>' +
      '<p class="card-sub">Applies to every registered module in one central database</p></div>' +
      '<div class="card-actions">' + (canManage ? UI.chip('Editable', 'ok') : UI.badge('Read only', 'neutral')) + '</div></div>' +
      '<div class="card-body"><form class="form" id="backup-form" novalidate><div class="form-grid">' +
      UI.fieldSelect({ name: 'schedule', label: 'Frequency', value: cfg.schedule, options: [
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' }
      ], disabled: !canManage, hint: 'Weekly runs on the next occurrence of the configured time.' }) +
      UI.fieldText({ name: 'time', label: 'Run at (24h)', type: 'time', value: cfg.time, disabled: !canManage, hint: 'Local server time.' }) +
      UI.fieldText({ name: 'retentionDays', label: 'Retention (days)', type: 'number', value: cfg.retentionDays, inputmode: 'numeric', disabled: !canManage, hint: 'Snapshots older than this are pruned after the next run.' }) +
      UI.fieldText({ name: 'destination', label: 'Destination', value: cfg.destination, disabled: !canManage, full: true, hint: 'Sample destination — the prototype never uploads anything.' }) +
      '</div></form>' +
      '<div class="kv">' +
      '<div class="kv-row"><dt>Next scheduled run</dt><dd>' + UI.esc(UI.dateTime(Store.nextBackupAt())) + ' <span class="text-muted text-xs">(' + UI.esc(UI.relTime(Store.nextBackupAt())) + ')</span></dd></div>' +
      '<div class="kv-row"><dt>Last snapshot</dt><dd>' + (last ? UI.esc(UI.stamp(last.createdAt)) + ' · ' + UI.esc(UI.fmt.mb(last.sizeMb)) + ' · ' + UI.fmt.int(last.records) + ' records' : '—') + '</dd></div>' +
      '<div class="kv-row"><dt>Beyond retention</dt><dd>' + expired + ' snapshot' + (expired === 1 ? '' : 's') + '</dd></div>' +
      '</div></div>' +
      '<div class="card-foot"><div class="row-wrap">' +
      (canManage
        ? '<button class="btn btn-secondary btn-sm" type="button" data-act="save">' + UI.icon('check') + 'Save schedule</button>' +
          '<button class="btn btn-primary btn-sm push-right" type="button" data-act="run-now">' + UI.icon('play') + 'Run backup now</button>'
        : '<span>Only the organization admin can change the schedule or start a manual backup.</span>') +
      '</div></div></section>';
  }

  function dangerCard() {
    return '<section class="card danger-zone"><div class="card-head"><div class="card-head-text">' +
      '<h2 class="card-title">Restore a snapshot</h2>' +
      '<p class="card-sub">Destructive — the central database rolls back to the chosen snapshot</p></div></div>' +
      '<div class="card-body stack-3">' +
      UI.banner('danger', 'alert', 'Restoring replaces current data',
        'Every module keeps serving the snapshot contents after a restore. Rejected records, rule history and pipeline runs recorded after the snapshot timestamp are not part of it.') +
      '<p class="text-sm text-muted">Use the restore action on any row in the history table. The prototype records the restore in the activity log and does not actually move data.</p>' +
      '</div></section>';
  }

  function historyCard() {
    var items = Store.state.backups.items;
    var canManage = Store.can('manageBackups');
    var rows = '';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      rows += '<tr><td class="mono">' + UI.esc(item.id) + '</td>' +
        '<td class="nowrap">' + UI.esc(UI.dateTime(item.createdAt)) + '<br><span class="text-xs text-muted">' + UI.esc(UI.relTime(item.createdAt)) + '</span></td>' +
        '<td>' + UI.badge(item.trigger === 'manual' ? 'Manual' : 'Scheduled', item.trigger === 'manual' ? 'native' : 'neutral') + '</td>' +
        '<td class="num">' + UI.esc(UI.fmt.mb(item.sizeMb)) + '</td>' +
        '<td class="num">' + UI.esc(UI.fmt.clock(item.durationSec)) + '</td>' +
        '<td class="num">' + UI.fmt.int(item.records) + '</td>' +
        '<td>' + UI.badge(item.status === 'verified' ? 'Verified' : item.status, item.status === 'verified' ? 'ok' : 'warn') + '</td>' +
        '<td class="actions">' + (canManage
          ? '<button class="btn btn-secondary btn-sm" type="button" data-act="restore" data-id="' + UI.esc(item.id) + '">' + UI.icon('restore') + 'Restore</button>'
          : '<span class="badge badge-neutral">' + UI.icon('lock') + 'Admin only</span>') + '</td></tr>';
    }

    return '<section class="card"><div class="card-head"><div class="card-head-text"><h2 class="card-title">Snapshot history</h2>' +
      '<p class="card-sub">' + items.length + ' snapshot' + (items.length === 1 ? '' : 's') + ' retained</p></div>' +
      '<div class="card-actions">' + UI.chip(items.length ? 'Retention ' + Store.state.backups.config.retentionDays + 'd' : 'Empty', items.length ? 'ok' : 'warn', true) + '</div></div>' +
      (items.length
        ? '<div class="table-wrap"><table class="data"><caption>Newest first · destination ' + UI.esc(Store.state.backups.config.destination) + '</caption>' +
          '<thead><tr><th scope="col">Snapshot</th><th scope="col">Created</th><th scope="col">Trigger</th><th scope="col" class="num">Size</th>' +
          '<th scope="col" class="num">Duration</th><th scope="col" class="num">Records</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>'
        : UI.emptyState({ icon: 'backup', title: 'No snapshots yet', text: 'Run a backup to create the first snapshot of the central database.' })) +
      '</section>';
  }

  VIEWS.backups = {
    title: 'Backups & restore',
    sub: 'Snapshot schedule, retention and restore for the central database',
    render: function (root, params, query) {
      lastRoot = root;
      lastParams = params;
      lastQuery = query;

      var canManage = Store.can('manageBackups');
      var items = Store.state.backups.items;
      var latest = items.length ? items[0] : null;
      var totalMb = 0;
      for (var i = 0; i < items.length; i++) totalMb += items[i].sizeMb;

      var wrap = shell(root,
        '<section class="metric-grid">' +
        '<article class="metric"><p class="metric-label">Last snapshot</p>' +
        '<p class="metric-value">' + (latest ? UI.esc(UI.relTime(latest.createdAt)) : '—') + '</p>' +
        '<p class="metric-foot">' + (latest ? UI.esc(latest.id) : 'No snapshot recorded yet') + '</p></article>' +
        '<article class="metric"><p class="metric-label">Next scheduled run</p>' +
        '<p class="metric-value">' + UI.esc(UI.dateShort(Store.nextBackupAt())) + '<span class="unit">' + UI.esc(UI.timeShort(Store.nextBackupAt())) + '</span></p>' +
        '<p class="metric-foot">' + UI.esc(Store.state.backups.config.schedule) + ' at ' + UI.esc(Store.state.backups.config.time) + '</p></article>' +
        '<article class="metric"><p class="metric-label">Records captured</p>' +
        '<p class="metric-value">' + UI.esc(UI.fmt.compact(latest ? latest.records : Store.recordCount())) + '</p>' +
        '<p class="metric-foot">' + UI.fmt.int(items.length) + ' snapshots · ' + UI.esc(UI.fmt.mb(totalMb)) + ' retained</p></article>' +
        '<article class="metric' + (items.length ? '' : ' is-warn') + '"><p class="metric-label">Retention window</p>' +
        '<p class="metric-value">' + Store.state.backups.config.retentionDays + '<span class="unit">days</span></p>' +
        '<p class="metric-foot">' + (canManage ? 'Pruned automatically after each run' : 'Read-only for this role') + '</p></article>' +
        '</section>' +
        UI.banner('info', 'info', 'Backups are simulated in this prototype',
          'Snapshots are described but never written to a real destination. Restores are recorded in the activity log only.') +
        (canManage ? '' : UI.gate({ title: 'Backup settings need the organization admin role', text: 'You can read the schedule and history below, but only the organization admin can change the schedule, start a manual backup or restore a snapshot.' })) +
        '<div class="backup-layout"><div class="stack-4">' + scheduleCard() + dangerCard() + '</div>' +
        '<div class="stack-4">' + historyCard() + '</div></div>' +
        '<p class="text-xs text-muted">A real deployment would stream every registered module into one encrypted snapshot and verify its checksum before marking it restorable.</p>');

      UI.on(wrap, 'click', '[data-act="save"]', function (event, button) {
        var values = UI.readForm(wrap);
        UI.clearErrors(wrap);
        var errors = [];
        if (!/^\d{2}:\d{2}$/.test(values.time || '')) errors.push({ id: 'time', message: 'Use a 24-hour time such as 02:00.' });
        var retention = Number(values.retentionDays);
        if (isNaN(retention) || retention < 1 || retention > 90) errors.push({ id: 'retentionDays', message: 'Retention must be between 1 and 90 days.' });
        if (!String(values.destination || '').trim()) errors.push({ id: 'destination', message: 'Enter a destination for the snapshots.' });
        if (errors.length) {
          wrap.insertAdjacentHTML('afterbegin', UI.errorSummary(errors));
          for (var i = 0; i < errors.length; i++) UI.showFieldError(wrap, errors[i].id, errors[i].message);
          var first = wrap.querySelector('#' + errors[0].id);
          if (first && first.focus) first.focus();
          return;
        }
        UI.setBusy(button, true, 'Saving');
        Store.saveBackupConfig({
          schedule: values.schedule,
          time: values.time,
          retentionDays: retention,
          destination: String(values.destination).trim()
        });
        UI.toastOk('Schedule saved', values.schedule + ' at ' + values.time + ' · retention ' + retention + ' days.');
      });

      UI.on(wrap, 'click', '[data-act="run-now"]', function (event, button) {
        UI.confirm({
          title: 'Run a backup now',
          heading: 'A snapshot of every module is captured',
          bodyHtml: 'All ' + UI.fmt.int(Store.recordCount()) + ' records across ' + Store.modules().length + ' registered modules are included.',
          confirmLabel: 'Start backup'
        }).then(function (ok) {
          if (!ok) return;
          UI.setBusy(button, true, 'Running');
          window.setTimeout(function () {
            var item = Store.runBackupNow();
            UI.toastOk('Backup complete', item.id + ' · ' + UI.fmt.mb(item.sizeMb) + ' · ' + UI.fmt.int(item.records) + ' records verified.');
          }, 520);
        });
      });

      UI.on(wrap, 'click', '[data-act="restore"]', function (event, button) {
        var id = button.getAttribute('data-id');
        var item = null;
        for (var i = 0; i < items.length; i++) if (items[i].id === id) item = items[i];
        if (!item) return;
        UI.confirm({
          title: 'Restore snapshot',
          heading: 'The central database rolls back to this snapshot',
          bodyHtml: 'Every module serves the snapshot contents afterwards. Records ingested after <strong>' + UI.esc(UI.stamp(item.createdAt)) + '</strong> are not part of it.',
          detail: UI.confirmList([
            ['Snapshot', item.id],
            ['Created', UI.dateTime(item.createdAt)],
            ['Records', UI.fmt.int(item.records)],
            ['Size', UI.fmt.mb(item.sizeMb)],
            ['Trigger', item.trigger]
          ]),
          confirmLabel: 'Restore snapshot',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          Store.restoreBackup(id);
          UI.toastInfo('Restore recorded', id + ' — the prototype logs the restore without moving data.');
        });
      });
    }
  };
})(window.IFIXZ);
