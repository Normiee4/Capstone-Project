/* iFixz Workspace — Overview view: shared metrics, module coverage, attention
   queue and recent activity across the central database. */
(function (NS) {
  'use strict';

  var UI = NS.UI;
  var Store = NS.Store;
  var VIEWS = (NS.Views = NS.Views || {});

  var ACTIVITY_ICONS = {
    pipeline: 'pipeline',
    sync: 'sync',
    alert: 'alert',
    module: 'registry',
    rule: 'rule',
    backup: 'backup',
    user: 'user',
    deal: 'arrowRight'
  };

  function display(value) {
    if (typeof value === 'string') return value;
    var n = Number(value);
    if (isNaN(n)) return '—';
    if (Math.abs(n) >= 10000) return UI.fmt.compact(n);
    if (n % 1 === 0) return UI.fmt.int(n);
    return UI.fmt.dec(n, 1);
  }

  function metricCard(metric) {
    var unit = metric.unit ? '<span class="unit">' + UI.esc(metric.unit) + '</span>' : '';
    return '<article class="metric"><p class="metric-label">' + UI.esc(metric.label) + '</p>' +
      '<p class="metric-value">' + UI.esc(display(metric.value)) + unit + '</p>' +
      '<p class="metric-foot">' + UI.esc(metric.note) + '</p></article>';
  }

  function moduleMini(mod) {
    var metrics = mod.dashboard.metrics;
    var primary = metrics.length ? Store.metricValue(mod.id, metrics[0].key) : mod.records.length;
    var stale = mod.source.state === 'down';
    return '<a class="module-mini" href="#/module/' + UI.esc(mod.id) + '">' +
      '<span class="module-mini-head">' +
      (stale ? '<span class="nav-stale" title="Source unreachable"></span>' : '') +
      '<span class="module-mini-name od-truncate">' + UI.esc(mod.name) + '</span>' +
      UI.badge(mod.kind === 'native' ? 'Native' : 'External', mod.kind === 'native' ? 'native' : 'external') +
      '</span>' +
      '<span class="module-mini-value">' + UI.esc(display(primary)) + '</span>' +
      '<span class="module-mini-foot">' + UI.esc(metrics.length ? metrics[0].label : 'Records') + ' · ' +
      UI.fmt.int(mod.records.length) + ' records · ' + (stale ? 'stale ' + UI.esc(UI.relTime(mod.source.lastSyncedAt)) : 'synced ' + UI.esc(UI.relTime(mod.source.lastSyncedAt))) + '</span>' +
      '</a>';
  }

  function attentionCard() {
    var stale = Store.staleModules();
    var disabled = [];
    var modules = Store.modules();
    for (var i = 0; i < modules.length; i++) if (modules[i].status !== 'active') disabled.push(modules[i]);
    var rejected = Store.state.rejected.length;

    if (!stale.length && !disabled.length && !rejected) {
      return '<section class="card"><div class="card-head"><div class="card-head-text"><h2 class="card-title">Needs attention</h2>' +
        '<p class="card-sub">Sources reachable, no rejected records</p></div></div>' +
        UI.emptyState({ icon: 'check', title: 'Nothing needs attention', text: 'Every active module is syncing and the rejected queue is empty.' }) +
        '</section>';
    }

    var rows = '';
    for (i = 0; i < stale.length; i++) {
      rows += '<a class="attention-row" href="#/module/' + UI.esc(stale[i].id) + '">' + UI.icon('alert') +
        '<span class="attention-body"><strong>' + UI.esc(stale[i].name) + ' source unreachable</strong>' +
        '<em>Serving the snapshot from ' + UI.esc(UI.stamp(stale[i].source.lastSyncedAt)) + '</em></span>' +
        '<span class="btn btn-secondary btn-sm">Open</span></a>';
    }
    if (rejected) {
      rows += '<a class="attention-row" href="#/pipeline">' + UI.icon('inbox') +
        '<span class="attention-body"><strong>' + UI.fmt.int(rejected) + ' rejected record' + (rejected === 1 ? '' : 's') + '</strong>' +
        '<em>Failing validation rules, waiting for triage</em></span>' +
        '<span class="btn btn-secondary btn-sm">Review</span></a>';
    }
    if (disabled.length) {
      rows += '<a class="attention-row" href="#/registry">' + UI.icon('ban') +
        '<span class="attention-body"><strong>' + UI.fmt.int(disabled.length) + ' module' + (disabled.length === 1 ? '' : 's') + ' deactivated</strong>' +
        '<em>' + UI.esc(UI.fmt.list(disabled.map(function (m) { return m.name; }), 3)) + ' hidden from navigation</em></span>' +
        '<span class="btn btn-secondary btn-sm">Open</span></a>';
    }

    return '<section class="card"><div class="card-head"><div class="card-head-text"><h2 class="card-title">Needs attention</h2>' +
      '<p class="card-sub">Stale sources, rejected records and deactivated modules</p></div>' +
      '<div class="card-actions">' + UI.chip(rows.length + ' open', 'warn', true) + '</div></div>' +
      '<div class="card-body"><div class="attention-list">' + rows + '</div></div></section>';
  }

  function volumeChart() {
    var modules = Store.activeModules();
    var data = [];
    for (var i = 0; i < modules.length; i++) {
      data.push({ label: modules[i].name.length > 12 ? modules[i].name.slice(0, 11) + '…' : modules[i].name, value: modules[i].records.length });
    }
    return UI.chartBlock(
      'Records held per module',
      'Validated rows in the central database, sample data',
      UI.barChart(data, { alt: 'Records per active module', height: 220 })
    );
  }

  function throughputChart() {
    var runs = Store.state.runs.slice(0, 10).reverse();
    var data = [];
    for (var i = 0; i < runs.length; i++) {
      data.push({ label: runs[i].id.replace('RUN-', '#'), value: runs[i].ingested });
    }
    return UI.chartBlock(
      'Records ingested per pipeline run',
      'Last ' + runs.length + ' runs · pass rate ' + UI.fmt.pct(Store.passRate()) + ' across the run history',
      UI.barChart(data, { alt: 'Records ingested per run', height: 200 })
    );
  }

  function activityCard() {
    var items = Store.state.activity.slice(0, 8);
    var rows = '';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      rows += '<div class="activity-row">' + UI.icon(ACTIVITY_ICONS[item.icon] || 'module') +
        '<span><strong>' + UI.esc(item.action) + '</strong><br><span class="text-muted text-xs">' + UI.esc(item.detail) + ' · ' + UI.esc(item.actor) + '</span></span>' +
        '<span class="activity-time" title="' + UI.esc(UI.dateTime(item.at)) + '">' + UI.esc(UI.relTime(item.at)) + '</span></div>';
    }
    return '<section class="card"><div class="card-head"><div class="card-head-text"><h2 class="card-title">Recent activity</h2>' +
      '<p class="card-sub">Pipeline runs, registry changes and backups</p></div></div>' +
      '<div class="card-body"><div class="activity-list">' + rows + '</div></div></section>';
  }

  VIEWS.overview = {
    title: 'Overview',
    sub: 'Shared metrics across every registered module',
    render: function (root) {
      var metrics = Store.sharedMetrics();
      var stale = Store.staleModules();
      var active = Store.activeModules();
      var cards = '';
      for (var i = 0; i < metrics.length; i++) cards += metricCard(metrics[i]);

      var head = '<div class="view-inner">';
      if (stale.length) {
        head += '<div>' + UI.banner('warn', 'alert', 'Serving last synced data for ' + stale.length + ' module' + (stale.length === 1 ? '' : 's'),
          UI.esc(UI.fmt.list(stale.map(function (m) { return m.name; }), 3)) + ' cannot reach its source, so the dashboard shows the most recent successful sync instead of fresh rows.',
          '<a class="btn btn-secondary btn-sm" href="#/registry">Open registry</a>') + '</div>';
      }

      var mini = '';
      for (i = 0; i < active.length; i++) mini += moduleMini(active[i]);

      root.innerHTML = head +
        '<section class="metric-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))">' + cards + '</section>' +
        '<div class="overview-grid"><section class="card"><div class="card-head"><div class="card-head-text">' +
        '<h2 class="card-title">Central database volume</h2>' +
        '<p class="card-sub">' + UI.fmt.int(Store.recordCount()) + ' records across ' + active.length + ' active modules</p></div>' +
        '<div class="card-actions">' + UI.chip(active.length + '/' + Store.modules().length + ' active', 'ok', true) + '</div></div>' +
        '<div class="card-body">' + volumeChart() + '</div></section>' +
        attentionCard() + '</div>' +
        '<section class="section"><div class="section-head"><h2 class="section-title">Registered modules</h2>' +
        '<p class="section-desc">Every active module exposes a dashboard built from its own schema. Native modules accept records typed inside the workspace; external modules stay read-only.</p>' +
        '<a class="link-btn push-right" href="#/registry">Manage registry</a></div>' +
        '<div class="module-mini-grid">' + mini + '</div></section>' +
        '<div class="chart-grid-2"><section class="card"><div class="card-body">' + throughputChart() + '</div></section>' +
        activityCard() + '</div>' +
        '<p class="text-xs text-muted">Prototype workspace with sample data. Values recalculate locally whenever you run the pipeline, retry a rejected record or restore a snapshot.</p>' +
        '</div>';
    }
  };
})(window.IFIXZ);
