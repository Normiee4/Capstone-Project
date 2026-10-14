/* iFixz Workspace — Module registry view: registered modules with status and
   source controls, plus the organization-admin registration wizard. */
(function (NS) {
  'use strict';

  var UI = NS.UI;
  var Store = NS.Store;
  var VIEWS = (NS.Views = NS.Views || {});
  var ADAPTERS = NS.ADAPTERS;
  var PRESETS = NS.SCHEMA_PRESETS;

  var FILTERS = [
    { id: 'all', label: 'All modules' },
    { id: 'active', label: 'Active' },
    { id: 'disabled', label: 'Deactivated' },
    { id: 'native', label: 'Native' },
    { id: 'external', label: 'External' }
  ];
  var ui = { filter: 'all' };
  var lastRoot = null;
  var lastParams = null;
  var lastQuery = null;

  function rerender() {
    if (lastRoot) VIEWS.registry.render(lastRoot, lastParams, lastQuery);
  }

  function shell(root, html) {
    var wrap = UI.el('<div class="view-inner">' + html + '</div>');
    root.innerHTML = '';
    root.appendChild(wrap);
    return wrap;
  }

  function lower(text) { return String(text || '').toLowerCase(); }

  function adapterLabel(type) {
    return ADAPTERS[type] ? ADAPTERS[type].label : String(type);
  }

  function moduleCard(mod) {
    var active = mod.status === 'active';
    var down = mod.source.state === 'down';
    var canManage = Store.can('manageModules');
    var mappingKeys = [];
    for (var key in mod.adapter.mapping) {
      if (Object.prototype.hasOwnProperty.call(mod.adapter.mapping, key)) mappingKeys.push(key);
    }
    var connection = mod.adapter.connection;
    var connectionKeys = [];
    for (var ck in connection) {
      if (Object.prototype.hasOwnProperty.call(connection, ck)) connectionKeys.push(ck);
    }

    var actions = '<a class="btn btn-secondary btn-sm" href="#/module/' + UI.esc(mod.id) + '">' + UI.icon('eye') + 'Open dashboard</a>';
    if (canManage) {
      actions += active
        ? '<button class="btn btn-ghost btn-sm" type="button" data-act="toggle-status" data-id="' + UI.esc(mod.id) + '" data-status="disabled">' + UI.icon('ban') + 'Deactivate</button>'
        : '<button class="btn btn-primary btn-sm" type="button" data-act="toggle-status" data-id="' + UI.esc(mod.id) + '" data-status="active">' + UI.icon('check') + 'Activate</button>';
      if (mod.kind === 'external') {
        actions += down
          ? '<button class="btn btn-secondary btn-sm" type="button" data-act="toggle-source" data-id="' + UI.esc(mod.id) + '" data-state="up">' + UI.icon('sync') + 'Source reachable</button>'
          : '<button class="btn btn-ghost btn-sm" type="button" data-act="toggle-source" data-id="' + UI.esc(mod.id) + '" data-state="down">' + UI.icon('alert') + 'Mark unreachable</button>';
      }
    }

    var connectionRows = '';
    for (var i = 0; i < connectionKeys.length; i++) {
      var ckey = connectionKeys[i];
      connectionRows += '<div class="kv-row"><dt>' + UI.esc(ckey) + '</dt><dd class="mono">' + UI.esc(connection[ckey]) + '</dd></div>';
    }

    var mappingRows = '';
    for (i = 0; i < mappingKeys.length && i < 5; i++) {
      mappingRows += '<div class="kv-row"><dt>' + UI.esc(mod.adapter.mapping[mappingKeys[i]]) + '</dt><dd class="mono">→ ' + UI.esc(mappingKeys[i]) + '</dd></div>';
    }
    if (mappingKeys.length > 5) mappingRows += '<div class="kv-row"><dt>…</dt><dd class="mono">+' + (mappingKeys.length - 5) + ' more mapped fields</dd></div>';
    if (!mappingKeys.length) mappingRows = '<div class="kv-row"><dt>Mapping</dt><dd class="text-muted">Records are typed directly in this module</dd></div>';

    return '<section class="card"><div class="card-head"><div class="card-head-text">' +
      '<h2 class="card-title">' + UI.esc(mod.name) + '</h2>' +
      '<p class="card-sub">' + UI.esc(mod.description) + '</p></div>' +
      '<div class="card-actions">' +
      UI.badge(mod.kind === 'native' ? 'Native module' : 'External module', mod.kind === 'native' ? 'native' : 'external') +
      (active ? UI.chip('Active', 'ok') : UI.chip('Deactivated')) +
      (down ? UI.chip('Source down', 'warn') : '') +
      '<span class="chip chip-mono">v' + UI.esc(mod.version) + '</span>' +
      actions + '</div></div>' +
      '<div class="card-body"><div class="overview-grid">' +
      '<div class="kv">' +
      '<div class="kv-row"><dt>Module key</dt><dd class="mono">#/' + UI.esc(mod.key) + '</dd></div>' +
      '<div class="kv-row"><dt>Owner</dt><dd>' + UI.esc(mod.owner) + '</dd></div>' +
      '<div class="kv-row"><dt>Adapter</dt><dd>' + UI.esc(adapterLabel(mod.adapter.type)) + ' · ' + UI.esc(mod.adapter.syncMode) + '</dd></div>' +
      '<div class="kv-row"><dt>Sync interval</dt><dd>' + UI.esc(mod.adapter.interval) + '</dd></div>' +
      '<div class="kv-row"><dt>Records</dt><dd>' + UI.fmt.int(mod.records.length) + '</dd></div>' +
      '<div class="kv-row"><dt>Last synced</dt><dd>' + UI.esc(UI.stamp(mod.source.lastSyncedAt)) + ' <span class="text-muted text-xs">(' + UI.esc(UI.relTime(mod.source.lastSyncedAt)) + ')</span></dd></div>' +
      '<div class="kv-row"><dt>Registered</dt><dd>' + UI.esc(UI.dateFull(mod.createdAt)) + '</dd></div>' +
      '</div>' +
      '<div class="stack-4">' +
      '<div class="kv">' + connectionRows + '</div>' +
      '<div class="kv">' + mappingRows + '</div>' +
      '</div></div>' +
      '<div class="card-foot">' + UI.esc(UI.fmt.list(mod.events, 4)) + ' · ' + mod.schema.length + ' schema fields · ' + mod.rules.length + ' validation rules</div>' +
      '</section>';
  }

  function filteredModules() {
    var modules = Store.modules();
    var out = [];
    for (var i = 0; i < modules.length; i++) {
      var mod = modules[i];
      var keep = ui.filter === 'all'
        || (ui.filter === 'active' && mod.status === 'active')
        || (ui.filter === 'disabled' && mod.status !== 'active')
        || (ui.filter === 'native' && mod.kind === 'native')
        || (ui.filter === 'external' && mod.kind === 'external');
      if (keep) out.push(mod);
    }
    return out;
  }

  function filterRail() {
    var modules = Store.modules();
    var counts = { all: modules.length, active: 0, disabled: 0, native: 0, external: 0 };
    for (var i = 0; i < modules.length; i++) {
      if (modules[i].status === 'active') counts.active++;
      else counts.disabled++;
      if (modules[i].kind === 'native') counts.native++;
      else counts.external++;
    }
    var html = '<div class="chip-rail">';
    for (i = 0; i < FILTERS.length; i++) {
      html += '<button class="chip-btn" type="button" data-act="filter" data-id="' + FILTERS[i].id + '" aria-pressed="' + (ui.filter === FILTERS[i].id) + '">' +
        UI.esc(FILTERS[i].label) + '<span class="chip-btn-count">' + counts[FILTERS[i].id] + '</span></button>';
    }
    return html + '</div>';
  }

  function presetSchema(presetId) {
    var preset = PRESETS[presetId];
    if (!preset) return [];
    var out = [];
    for (var i = 0; i < preset.fields.length; i++) {
      var field = preset.fields[i];
      var copy = { key: field.key, label: field.label, type: field.type, required: field.required !== false };
      if (field.options) copy.options = field.options.slice();
      out.push(copy);
    }
    return out;
  }

  function buildDashboard(schema) {
    var idField = schema.length ? schema[0] : null;
    var numberField = null;
    var dateField = null;
    var enumField = null;
    var textField = null;
    var i;
    for (i = 0; i < schema.length; i++) {
      if (!numberField && schema[i].type === 'number') numberField = schema[i];
      if (!dateField && schema[i].type === 'date') dateField = schema[i];
      if (!enumField && schema[i].type === 'enum') enumField = schema[i];
      if (!textField && i > 0 && (schema[i].type === 'text' || schema[i].type === 'email')) textField = schema[i];
    }

    var candidates = [];
    candidates.push({ key: 'records', label: 'Records in this module', type: 'count' });
    if (numberField) candidates.push({ key: 'total', label: 'Total ' + lower(numberField.label), type: 'sum', field: numberField.key });
    else if (idField) candidates.push({ key: 'distinctKeys', label: 'Distinct ' + lower(idField.label), type: 'distinct', field: idField.key });
    if (enumField) {
      var first = enumField.options && enumField.options.length ? enumField.options[0] : 'Open';
      candidates.push({ key: 'primary', label: enumField.label + ': ' + first, type: 'countWhere', field: enumField.key, params: { values: [first] } });
      candidates.push({ key: 'distinctStates', label: 'Distinct ' + lower(enumField.label) + ' values', type: 'distinct', field: enumField.key });
    }
    if (textField) candidates.push({ key: 'distinctText', label: 'Distinct ' + lower(textField.label), type: 'distinct', field: textField.key });
    if (idField) candidates.push({ key: 'uniqueKeys', label: 'Unique keys', type: 'distinct', field: idField.key });

    var metrics = candidates.slice(0, 4);
    while (metrics.length < 4 && idField) {
      metrics.push({ key: 'distinctExtra' + metrics.length, label: 'Distinct ' + lower(idField.label), type: 'distinct', field: idField.key });
    }

    return {
      metrics: metrics,
      trend: dateField
        ? { field: dateField.key, label: lower(dateField.label) + ' per day', type: numberField ? 'sum' : 'count', bucket: 'day', days: 14 }
        : null,
      group: enumField
        ? { field: enumField.key, label: 'Records by ' + lower(enumField.label), type: 'count' }
        : (schema.length > 1 ? { field: schema[1].key, label: 'Records by ' + lower(schema[1].label), type: 'count' } : null)
    };
  }

  function stepBar(step) {
    var labels = ['Identity & adapter', 'Schema & mapping', 'Review & activate'];
    var html = '<div class="wizard-steps">';
    for (var i = 0; i < labels.length; i++) {
      if (i) html += '<span class="wizard-step-sep"></span>';
      var state = i + 1 < step ? ' is-done' : (i + 1 === step ? ' is-current' : '');
      var num = i + 1 < step ? UI.icon('check') : String(i + 1);
      html += '<span class="wizard-step' + state + '"><span class="num">' + num + '</span>' + UI.esc(labels[i]) + '</span>';
    }
    return html + '</div>';
  }

  function connectionFields(adapterType, values) {
    var adapter = ADAPTERS[adapterType];
    if (!adapter || !adapter.fields.length) return '';
    var html = '<div class="wizard-section"><h3 class="wizard-section-title">Connection</h3>' +
      '<p class="wizard-section-hint">' + UI.esc(adapter.hint) + '. Stored as sample configuration — the prototype never opens a real connection.</p>' +
      '<div class="form-grid">';
    for (var i = 0; i < adapter.fields.length; i++) {
      var field = adapter.fields[i];
      var value = values && values[field.key] !== undefined ? values[field.key] : '';
      if (field.type === 'select') {
        html += UI.fieldSelect({ id: 'conn-' + field.key, name: 'conn-' + field.key, label: field.label, options: field.options, value: value, required: field.required });
      } else {
        html += UI.fieldText({ id: 'conn-' + field.key, name: 'conn-' + field.key, label: field.label, value: value, placeholder: field.placeholder, required: field.required });
      }
    }
    return html + '</div></div>';
  }

  function schemaEditor(draft) {
    var html = '<div class="wizard-section"><h3 class="wizard-section-title">Field mapping</h3>' +
      '<p class="wizard-section-hint">' + (draft.kind === 'external'
        ? 'Each workspace field maps to a column coming from the source system. Unmapped fields arrive empty and fail their required rules.'
        : 'Native modules own their schema — records are typed directly in the workspace, so no source columns are needed.') + '</p>' +
      '<div class="mapping-list">';
    for (var i = 0; i < draft.schema.length; i++) {
      var field = draft.schema[i];
      var mapped = draft.mapping[field.key] || '';
      html += '<div class="mapping-row' + (draft.kind === 'external' && !mapped ? ' is-missing' : '') + '" data-schema-row data-key="' + UI.esc(field.key) + '">' +
        '<span class="mapping-fields">' +
        '<input class="input" id="label-' + UI.esc(field.key) + '" name="label-' + UI.esc(field.key) + '" value="' + UI.esc(field.label) + '" aria-label="Label for ' + UI.esc(field.key) + '">' +
        '<span class="mapping-type">' + UI.esc(field.type) + ' · <span class="mono">' + UI.esc(field.key) + '</span></span>' +
        '</span>' +
        '<span class="mapping-arrow">' + UI.icon('arrowRight') + '</span>' +
        '<span class="mapping-fields">' +
        (draft.kind === 'external'
          ? '<input class="input" id="map-' + UI.esc(field.key) + '" name="map-' + UI.esc(field.key) + '" value="' + UI.esc(mapped) + '" placeholder="source_column" aria-label="Source column for ' + UI.esc(field.key) + '">'
          : '<span class="text-muted text-sm">Typed in the workspace</span>') +
        '<span class="mapping-type">' + (draft.kind === 'external' ? 'source column' : 'no adapter mapping') +
        ' · <button class="link-btn" type="button" data-act="drop-field" data-key="' + UI.esc(field.key) + '">Remove</button></span>' +
        '</span>' +
        '</div>';
    }
    if (!draft.schema.length) html += '<div class="mapping-row"><span class="text-muted text-sm">No fields yet — pick a template or add a field.</span></div>';
    return html + '</div><div class="row-wrap"><button class="btn btn-secondary btn-sm" type="button" data-act="add-field">' + UI.icon('plus') + 'Add custom field</button></div></div>';
  }

  function openWizard() {
    var draft = {
      step: 1,
      kind: 'external',
      adapterType: 'api',
      syncMode: 'realtime',
      interval: 'Every hour',
      preset: 'assets',
      schema: presetSchema('assets'),
      mapping: {},
      connection: {},
      keyTouched: false
    };

    var ctx = UI.dialog({ title: 'Register a module', sub: 'Step 1 of 3 · identity and adapter', wide: true, body: '', foot: '' });
    if (!ctx) return;

    function draw() {
      var body = stepBar(draft.step);
      if (draft.step === 1) {
        body += '<form class="form wizard-body" id="wizard-form" novalidate><div class="form-grid">' +
          UI.fieldText({ name: 'name', label: 'Module name', value: draft.name, placeholder: 'Asset register', required: true }) +
          UI.fieldText({ name: 'key', label: 'Module key', value: draft.key, placeholder: 'asset-register', hint: 'Lowercase slug used in routes: #/module/<key>', required: true }) +
          UI.fieldText({ name: 'owner', label: 'Owning team', value: draft.owner, placeholder: 'Facilities', required: true }) +
          UI.fieldTextarea({ name: 'description', label: 'Description', value: draft.description, placeholder: 'What this module tracks and where its data comes from.', required: true, full: true }) +
          '</div><div class="wizard-section"><h3 class="wizard-section-title">Module type</h3>' +
          '<div class="choice-grid">' +
          UI.choiceCard({ name: 'kind', value: 'native', title: 'Native module', hint: 'Records are typed inside the workspace. Input rights follow the member role.', checked: draft.kind === 'native' }) +
          UI.choiceCard({ name: 'kind', value: 'external', title: 'External module', hint: 'Read-only mirror of an existing system, file, database or API.', checked: draft.kind === 'external' }) +
          '</div></div>';
        if (draft.kind === 'external') {
          body += '<div class="form-grid">' +
            UI.fieldSelect({ name: 'adapterType', label: 'Adapter', value: draft.adapterType, required: true, options: [
              { value: 'api', label: 'API' },
              { value: 'database', label: 'Database' },
              { value: 'file', label: 'File' },
              { value: 'webhook', label: 'Webhook' }
            ] }) +
            UI.fieldSelect({ name: 'syncMode', label: 'Sync mode', value: draft.syncMode, required: true, options: [
              { value: 'realtime', label: 'Realtime' },
              { value: 'batch', label: 'Scheduled batch' }
            ] }) +
            (draft.syncMode === 'batch' ? UI.fieldSelect({ name: 'interval', label: 'Batch interval', value: draft.interval, required: true, full: true, options: ['Every 15 minutes', 'Every hour', 'Daily at 02:00', 'Weekly on Sunday'] }) : '') +
            '</div>' + connectionFields(draft.adapterType, draft.connection);
        }
        body += '</form>';
      } else if (draft.step === 2) {
        body += '<div class="wizard-body"><div class="wizard-section"><h3 class="wizard-section-title">Schema template</h3>' +
          '<p class="wizard-section-hint">Templates pre-fill the field list. Validation rules are generated from the final schema.</p>' +
          '<div class="choice-grid">' +
          UI.choiceCard({ name: 'preset', value: 'assets', title: PRESETS.assets.label, hint: PRESETS.assets.hint, checked: draft.preset === 'assets' }) +
          UI.choiceCard({ name: 'preset', value: 'serviceRequests', title: PRESETS.serviceRequests.label, hint: PRESETS.serviceRequests.hint, checked: draft.preset === 'serviceRequests' }) +
          UI.choiceCard({ name: 'preset', value: 'fulfilment', title: PRESETS.fulfilment.label, hint: PRESETS.fulfilment.hint, checked: draft.preset === 'fulfilment' }) +
          UI.choiceCard({ name: 'preset', value: 'blank', title: 'Start blank', hint: 'Add every field yourself', checked: draft.preset === 'blank' }) +
          '</div></div>' + schemaEditor(draft) + '</div>';
      } else {
        var rules = Store.buildRulesFor(draft.schema);
        var unmapped = 0;
        for (var i = 0; i < draft.schema.length; i++) {
          if (draft.kind === 'external' && !draft.mapping[draft.schema[i].key]) unmapped++;
        }
        var schemaLines = '';
        for (i = 0; i < draft.schema.length; i++) {
          var field = draft.schema[i];
          schemaLines += '<div class="kv-row"><dt>' + UI.esc(field.label) + '</dt><dd class="mono">' + UI.esc(field.key) + ' · ' + UI.esc(field.type) +
            (field.options ? ' · ' + UI.esc(UI.fmt.list(field.options, 4)) : '') +
            (draft.kind === 'external' ? '<br>' + (draft.mapping[field.key] ? 'from ' + UI.esc(draft.mapping[field.key]) : '<span class="text-danger">unmapped</span>') : '') + '</dd></div>';
        }
        var connectionText = '';
        for (var ck in draft.connection) {
          if (Object.prototype.hasOwnProperty.call(draft.connection, ck) && draft.connection[ck] !== '') {
            connectionText += '<div class="kv-row"><dt>' + UI.esc(ck) + '</dt><dd class="mono">' + UI.esc(draft.connection[ck]) + '</dd></div>';
          }
        }
        body += '<div class="wizard-body">' +
          (unmapped ? UI.banner('warn', 'alert', unmapped + ' unmapped field' + (unmapped === 1 ? '' : 's'), 'Unmapped fields will always be empty, so their required rule rejects every inbound record.') : '') +
          '<div class="review-list">' +
          '<div class="review-block"><h4>Identity</h4><div class="kv">' +
          '<div class="kv-row"><dt>Name</dt><dd>' + UI.esc(draft.name) + '</dd></div>' +
          '<div class="kv-row"><dt>Route</dt><dd class="mono">#/module/' + UI.esc(draft.key) + '</dd></div>' +
          '<div class="kv-row"><dt>Owner</dt><dd>' + UI.esc(draft.owner) + '</dd></div>' +
          '<div class="kv-row"><dt>Type</dt><dd>' + (draft.kind === 'native' ? 'Native module' : 'External module · ' + UI.esc(adapterLabel(draft.adapterType))) + '</dd></div>' +
          '<div class="kv-row"><dt>Sync</dt><dd>' + UI.esc(draft.syncMode === 'batch' ? draft.interval : 'Realtime where supported') + '</dd></div>' +
          '</div></div>' +
          (draft.kind === 'external' && connectionText ? '<div class="review-block"><h4>Connection</h4><div class="kv">' + connectionText + '</div></div>' : '') +
          '<div class="review-block"><h4>Schema · ' + draft.schema.length + ' field' + (draft.schema.length === 1 ? '' : 's') + '</h4><div class="kv">' + schemaLines + '</div></div>' +
          '<div class="review-block"><h4>Generated validation rules · ' + rules.length + '</h4>' +
          '<div class="stack-2">' + rules.slice(0, 8).map(function (rule) {
            return '<p class="text-sm"><span class="rule-type">' + UI.esc(rule.type) + '</span> ' + UI.esc(rule.label) + '</p>';
          }).join('') + (rules.length > 8 ? '<p class="text-xs text-muted">+' + (rules.length - 8) + ' more generated from the schema.</p>' : '') + '</div></div>' +
          '</div>' +
          UI.switchRow({ name: 'activate', label: 'Activate immediately after registration', checked: true }) +
          '</div>';
      }

      ctx.setSub('Step ' + draft.step + ' of 3 · ' + (draft.step === 1 ? 'identity and adapter' : draft.step === 2 ? 'schema and mapping' : 'review and activate'));
      ctx.setBody(body);
      ctx.setFoot(draft.step === 1
        ? '<button class="btn btn-secondary" type="button" data-overlay-close>Cancel</button><span class="spacer"></span>' +
          '<button class="btn btn-primary" type="button" data-act="wizard-next">' + UI.icon('arrowRight') + 'Continue</button>'
        : draft.step === 2
          ? '<button class="btn btn-secondary" type="button" data-act="wizard-back">Back</button><span class="spacer"></span>' +
            '<button class="btn btn-primary" type="button" data-act="wizard-next">' + UI.icon('arrowRight') + 'Continue</button>'
          : '<button class="btn btn-secondary" type="button" data-act="wizard-back">Back</button><span class="spacer"></span>' +
            '<button class="btn btn-primary" type="button" data-act="wizard-register">' + UI.icon('check') + 'Register module</button>');
      wire();
    }

    function readInputs() {
      if (draft.step === 1) {
        var values = UI.readForm(ctx.body);
        draft.name = values.name || '';
        draft.key = values.key || '';
        draft.owner = values.owner || '';
        draft.description = values.description || '';
        draft.kind = values.kind === 'native' ? 'native' : 'external';
        if (draft.kind === 'external') {
          draft.adapterType = values.adapterType || 'api';
          draft.syncMode = values.syncMode === 'batch' ? 'batch' : 'realtime';
          draft.interval = values.interval || draft.interval;
          draft.connection = {};
          var inputs = UI.nodes(ctx.body, '[name^="conn-"]');
          for (var i = 0; i < inputs.length; i++) draft.connection[inputs[i].name.slice(6)] = inputs[i].value;
        }
      } else if (draft.step === 2) {
        var preset = UI.fieldOf(ctx.body, 'preset');
        var schema = [];
        var rows = UI.nodes(ctx.body, '[data-schema-row]');
        var previous = {};
        for (var p = 0; p < draft.schema.length; p++) previous[draft.schema[p].key] = draft.schema[p];
        for (var r = 0; r < rows.length; r++) {
          var key = rows[r].getAttribute('data-key');
          var labelInput = rows[r].querySelector('[name="label-' + key + '"]');
          var source = previous[key] || { key: key, label: key, type: 'text', required: true, options: null };
          schema.push({
            key: key,
            label: labelInput ? labelInput.value : source.label,
            type: source.type || 'text',
            required: source.required !== false,
            options: source.options || null
          });
        }
        var mapping = {};
        var maps = UI.nodes(ctx.body, '[name^="map-"]');
        for (var m = 0; m < maps.length; m++) mapping[maps[m].name.slice(4)] = maps[m].value;
        draft.schema = schema;
        draft.mapping = mapping;
        draft.preset = preset ? preset.value : draft.preset;
      } else {
        var activate = UI.fieldOf(ctx.body, 'activate');
        draft.activate = activate ? activate.checked : true;
      }
    }

    function validateStep1() {
      var errors = [];
      if (!String(draft.name).trim()) errors.push({ id: 'name', message: 'Give the module a name users will recognise.' });
      if (!String(draft.key).trim()) errors.push({ id: 'key', message: 'A module key is required to build the route.' });
      else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(draft.key)) errors.push({ id: 'key', message: 'Use a lowercase slug: letters, numbers and single hyphens.' });
      else if (Store.keyExists(draft.key)) errors.push({ id: 'key', message: 'That module key is already registered. Pick another one.' });
      if (!String(draft.owner).trim()) errors.push({ id: 'owner', message: 'Name the owning team so escalations have an owner.' });
      if (String(draft.description).trim().length < 12) errors.push({ id: 'description', message: 'Add a short description (at least 12 characters).' });
      if (draft.kind === 'external') {
        var adapter = ADAPTERS[draft.adapterType];
        if (adapter) {
          for (var i = 0; i < adapter.fields.length; i++) {
            var field = adapter.fields[i];
            if (field.required && !String(draft.connection[field.key] || '').trim()) {
              errors.push({ id: 'conn-' + field.key, message: field.label + ' is required for the ' + adapter.label + ' adapter.' });
            }
          }
        }
        if (draft.syncMode === 'batch' && !draft.interval) errors.push({ id: 'interval', message: 'Choose how often the batch runs.' });
      }
      return errors;
    }

    function validateStep2() {
      var errors = [];
      if (!draft.schema.length) errors.push({ id: 'wizard-body', message: 'Add at least one field — a module without a schema has nothing to validate.' });
      for (var i = 0; i < draft.schema.length; i++) {
        var field = draft.schema[i];
        if (!String(field.label).trim()) errors.push({ id: 'label-' + field.key, message: 'Every field needs a label.' });
        if (field.type === 'enum' && (!field.options || !field.options.length)) {
          errors.push({ id: 'label-' + field.key, message: field.label + ' is an enum field and needs at least one option.' });
        }
        if (draft.kind === 'external' && !draft.mapping[field.key] && i === 0) {
          errors.push({ id: 'map-' + field.key, message: 'Map the key field to a source column — without it every record is a duplicate.' });
        }
      }
      return errors;
    }

    function wire() {
      var nameInput = UI.fieldOf(ctx.body, 'name');
      var keyInput = UI.fieldOf(ctx.body, 'key');
      if (nameInput) {
        nameInput.addEventListener('input', function () {
          if (draft.keyTouched || !keyInput) return;
          keyInput.value = UI.slugify(nameInput.value);
        });
      }
      if (keyInput) {
        keyInput.addEventListener('input', function () { draft.keyTouched = true; });
      }

      var kindRadios = UI.nodes(ctx.body, '[name="kind"]');
      for (var k = 0; k < kindRadios.length; k++) {
        kindRadios[k].addEventListener('change', function () { readInputs(); draw(); });
      }
      var adapterSelect = UI.fieldOf(ctx.body, 'adapterType');
      if (adapterSelect) adapterSelect.addEventListener('change', function () { readInputs(); draw(); });
      var syncSelect = UI.fieldOf(ctx.body, 'syncMode');
      if (syncSelect) syncSelect.addEventListener('change', function () { readInputs(); draw(); });

      var presets = UI.nodes(ctx.body, '[name="preset"]');
      for (var p = 0; p < presets.length; p++) {
        presets[p].addEventListener('change', function (event) {
          readInputs();
          draft.preset = event.target.value;
          draft.schema = event.target.value === 'blank' ? [] : presetSchema(event.target.value);
          draft.mapping = {};
          draw();
        });
      }
    }

    function bindOnce() {
      UI.on(ctx.body, 'click', '[data-act="add-field"]', function () {
        readInputs();
        var index = draft.schema.length + 1;
        var key = 'field' + index;
        draft.schema.push({ key: key, label: 'New field ' + index, type: 'text', required: true });
        draw();
      });

      UI.on(ctx.body, 'click', '[data-act="drop-field"]', function (event, button) {
        readInputs();
        var key = button.getAttribute('data-key');
        var kept = [];
        for (var i = 0; i < draft.schema.length; i++) if (draft.schema[i].key !== key) kept.push(draft.schema[i]);
        draft.schema = kept;
        draw();
      });

      UI.on(ctx.body, 'click', '[data-act="wizard-next"]', function () {
        readInputs();
        UI.clearErrors(ctx.body);
        var errors = draft.step === 1 ? validateStep1() : validateStep2();
        if (errors.length) {
          ctx.body.insertAdjacentHTML('afterbegin', UI.errorSummary(errors));
          var target = ctx.body.querySelector('#' + errors[0].id);
          if (target && target.focus) target.focus();
          else {
            var firstInput = ctx.body.querySelector('input,select,textarea');
            if (firstInput) firstInput.focus();
          }
          return;
        }
        draft.step = draft.step + 1;
        draw();
      });

      UI.on(ctx.body, 'click', '[data-act="wizard-back"]', function () {
        readInputs();
        draft.step = draft.step - 1;
        draw();
      });

      UI.on(ctx.body, 'click', '[data-act="wizard-register"]', function () {
        readInputs();
        var manifest = {
          key: draft.key,
          name: String(draft.name).trim(),
          owner: String(draft.owner).trim(),
          description: String(draft.description).trim(),
          kind: draft.kind,
          adapterType: draft.kind === 'native' ? 'native' : draft.adapterType,
          syncMode: draft.kind === 'native' ? 'realtime' : draft.syncMode,
          interval: draft.interval,
          connection: draft.connection,
          mapping: draft.mapping,
          schema: draft.schema,
          rules: Store.buildRulesFor(draft.schema),
          dashboard: buildDashboard(draft.schema)
        };
        var created = Store.registerModule(manifest);
        if (!draft.activate) Store.setModuleStatus(created.id, 'disabled');
        ctx.close();
        ui.filter = 'all';
        UI.toastOk('Module registered', created.name + ' is live at #/module/' + created.key + ' with ' + created.rules.length + ' generated validation rules.');
        window.location.hash = '#/module/' + created.key;
      });

      UI.wireErrorSummary(ctx.body);
    }

    draw();
    bindOnce();
  }

  VIEWS.registry = {
    title: 'Module registry',
    sub: 'Registered modules, adapters and activation state',
    render: function (root, params, query) {
      lastRoot = root;
      lastParams = params;
      lastQuery = query;

      var canManage = Store.can('manageModules');
      var modules = filteredModules();
      var cards = '';
      for (var i = 0; i < modules.length; i++) cards += moduleCard(modules[i]);
      if (!modules.length) {
        cards = UI.emptyState({ icon: 'registry', title: 'No modules match this filter', text: 'Switch the filter or register a new module.' });
      }

      var wrap = shell(root,
        '<section class="section"><div class="section-head"><div class="stack-2">' +
        '<p class="eyebrow">Registry</p><h2 class="section-title">Registered modules</h2>' +
        '<p class="section-desc">Activation is instant: a module appears in the sidebar, gets its dashboard route and inherits the shared-metrics layer. No deployment step in this prototype.</p>' +
        '</div>' +
        (canManage
          ? '<button class="btn btn-primary push-right" type="button" data-act="wizard-open">' + UI.icon('plus') + 'Register module</button>'
          : '') +
        '</div>' +
        (canManage ? '' : UI.gate({ title: 'Registry changes need the organization admin role', text: 'You can review every registered module here, but only the organization admin can register, activate or deactivate modules.' })) +
        filterRail() + '</section>' +
        '<div class="stack-4">' + cards + '</div>');

      UI.on(wrap, 'click', '[data-act="filter"]', function (event, button) {
        ui.filter = button.getAttribute('data-id');
        rerender();
      });

      UI.on(wrap, 'click', '[data-act="wizard-open"]', function () { openWizard(); });

      UI.on(wrap, 'click', '[data-act="toggle-status"]', function (event, button) {
        var id = button.getAttribute('data-id');
        var status = button.getAttribute('data-status');
        var mod = Store.module(id);
        if (!mod) return;
        if (status === 'disabled') {
          UI.confirm({
            title: 'Deactivate module',
            heading: mod.name + ' is hidden from navigation',
            bodyHtml: 'Its dashboard route stops resolving and it drops out of the shared metrics. Validated records are kept in the central database.',
            confirmLabel: 'Deactivate',
            danger: true
          }).then(function (ok) {
            if (!ok) return;
            Store.setModuleStatus(id, 'disabled');
            UI.toastInfo('Module deactivated', mod.name + ' is hidden from the sidebar.');
            if (String(window.location.hash).indexOf('#/module/' + id) === 0) window.location.hash = '#/registry';
          });
          return;
        }
        Store.setModuleStatus(id, 'active');
        UI.toastOk('Module activated', mod.name + ' is back in the sidebar with its dashboard route.');
      });

      UI.on(wrap, 'click', '[data-act="toggle-source"]', function (event, button) {
        var id = button.getAttribute('data-id');
        var state = button.getAttribute('data-state');
        var mod = Store.module(id);
        if (!mod) return;
        if (state === 'down') {
          UI.confirm({
            title: 'Mark source unreachable',
            heading: mod.name + ' keeps serving its last synced snapshot',
            bodyHtml: 'Pipeline syncs are blocked while the source is down, and the dashboard shows the timestamp of the last successful sync.',
            confirmLabel: 'Mark unreachable',
            danger: true
          }).then(function (ok) {
            if (!ok) return;
            Store.setSourceState(id, 'down');
            UI.toastError('Source marked unreachable', mod.name + ' is serving the snapshot from ' + UI.stamp(mod.source.lastSyncedAt) + '.');
          });
          return;
        }
        Store.setSourceState(id, 'up');
        UI.toastOk('Source reachable', mod.name + ' resumes syncing on its normal interval.');
      });
    }
  };
})(window.IFIXZ);
