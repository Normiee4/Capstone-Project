/* iFixz Workspace — application shell: hash router, sidebar, account menu,
   role switching, responsive drawer and boot sequence. */
(function (NS) {
  'use strict';

  var doc = document;
  var UI = NS.UI;
  var Store = NS.Store;
  var ROLES = NS.ROLES;
  var VIEWS = (NS.Views = NS.Views || {});

  var els = {};
  var lastRoute = { name: '', id: '' };
  var menuOpen = false;
  var navOpen = false;

  var PRIMARY = [
    { href: '#/overview', label: 'Overview', icon: 'overview' },
    { href: '#/pipeline', label: 'Data pipeline', icon: 'pipeline' },
    { href: '#/registry', label: 'Module registry', icon: 'registry' },
    { href: '#/backups', label: 'Backups & restore', icon: 'backup' }
  ];

  VIEWS.notfound = {
    title: 'Page not found',
    sub: 'That route is not part of this prototype',
    render: function (root) {
      root.innerHTML = '<div class="view-inner">' +
        UI.emptyState({
          icon: 'alert',
          title: 'Nothing is routed here',
          text: 'The address you followed does not match a screen in this prototype.',
          action: '<a class="btn btn-primary" href="#/overview">Go to the overview</a>'
        }) +
        '</div>';
    }
  };

  function parseHash() {
    var raw = String(window.location.hash || '').replace(/^#\/?/, '');
    var query = {};
    var parts = raw.split('?');
    var path = parts[0].replace(/^\/+|\/+$/g, '');
    if (parts[1]) {
      var pairs = parts[1].split('&');
      for (var i = 0; i < pairs.length; i++) {
        if (!pairs[i]) continue;
        var pair = pairs[i].split('=');
        query[decodeURIComponent(pair[0])] = decodeURIComponent((pair[1] || '').replace(/\+/g, ' '));
      }
    }
    var segments = path.split('/').filter(function (part) { return part; });
    if (!segments.length) return { name: 'overview', params: {}, query: query };
    if (segments[0] === 'module' && segments[1]) {
      return { name: 'module', params: { id: segments[1], tab: segments[2] === 'records' ? 'records' : 'dashboard' }, query: query };
    }
    if (segments[0] === 'pipeline') return { name: 'pipeline', params: {}, query: query };
    if (segments[0] === 'registry') return { name: 'registry', params: {}, query: query };
    if (segments[0] === 'backups') return { name: 'backups', params: {}, query: query };
    if (segments[0] === 'overview') return { name: 'overview', params: {}, query: query };
    return { name: 'notfound', params: { path: path }, query: query };
  }

  function isActive(href, route) {
    var target = href.replace(/^#/, '');
    if (target === '/module/' + route.params.id) return route.name === 'module';
    return route.name === target.slice(1);
  }

  function navItem(href, label, iconName, route, tag, stale) {
    return '<a class="nav-item' + (isActive(href, route) ? ' is-active' : '') + '" href="' + UI.esc(href) + '"' +
      (isActive(href, route) ? ' aria-current="page"' : '') + '>' +
      '<span class="nav-icon">' + UI.icon(iconName) + '</span>' +
      '<span class="nav-label">' + UI.esc(label) + '</span>' +
      (stale ? '<span class="nav-stale" title="Source unreachable"></span>' : '') +
      (tag ? '<span class="nav-tag">' + UI.esc(tag) + '</span>' : '') + '</a>';
  }

  function renderNav(route) {
    var i;
    var html = '<div class="nav-group"><p class="nav-title" id="nav-workspace">Workspace</p><div class="nav-list">';
    for (i = 0; i < PRIMARY.length; i++) html += navItem(PRIMARY[i].href, PRIMARY[i].label, PRIMARY[i].icon, route);
    html += '</div></div>';

    var modules = Store.activeModules();
    html += '<div class="nav-group"><p class="nav-title" id="nav-modules">Modules</p><div class="nav-list">';
    if (!modules.length) {
      html += '<p class="text-xs text-muted" style="padding:0 12px">No active modules.</p>';
    }
    for (i = 0; i < modules.length; i++) {
      var mod = modules[i];
      var rejected = Store.rejectedFor(mod.id).length;
      html += navItem('#/module/' + mod.id, mod.name, 'module', route, rejected ? String(rejected) : '', mod.source.state === 'down');
    }
    html += '</div></div>';

    els.sidebarNav.innerHTML = html;

    var role = Store.role();
    els.sidebarFoot.innerHTML = '<div class="user-meta">' +
      '<span class="user-name">' + UI.esc(role.person.name) + '</span>' +
      '<span class="user-role">' + UI.esc(role.label) + '</span></div>' +
      '<p class="text-xs text-muted" style="margin-top:8px">Sample data · stored in this browser</p>';
  }

  function renderDbStatus() {
    var stale = Store.staleModules();
    var tone = stale.length ? 'warn' : 'ok';
    els.dbStatus.className = 'chip chip-' + tone;
    els.dbStatus.innerHTML = '<span class="chip-dot"></span>Central DB <span class="chip-mono">· ' + UI.fmt.int(Store.recordCount()) + ' records</span>';
    els.dbStatus.setAttribute('title', stale.length
      ? stale.length + ' module(s) serving last synced data'
      : 'All active modules are syncing');
  }

  function renderAccount() {
    var role = Store.role();
    els.accountAvatar.textContent = role.person.initials;
    els.accountName.textContent = role.person.name;
    els.accountRole.textContent = role.label;
    els.accountBtn.setAttribute('aria-expanded', menuOpen ? 'true' : 'false');

    var html = '<div class="menu-head"><p>' + UI.esc(role.person.name) + '</p>' +
      '<span>' + UI.esc(role.label) + ' · ' + UI.esc(role.blurb) + '</span></div>' +
      '<p class="menu-label">View as</p>';
    var ids = ['org_admin', 'user', 'super_admin'];
    for (var i = 0; i < ids.length; i++) {
      var item = ROLES[ids[i]];
      var active = ids[i] === role.id;
      html += '<button class="menu-item" type="button" role="menuitemradio" aria-checked="' + (active ? 'true' : 'false') + '" data-role="' + ids[i] + '">' +
        '<span class="menu-check">' + (active ? UI.icon('check') : '') + '</span>' +
        '<span class="menu-item-body">' + UI.esc(item.label) + '<em>' + UI.esc(item.person.name) + ' · ' + UI.esc(item.blurb) + '</em></span></button>';
    }
    html += '<div class="menu-sep"></div>' +
      '<button class="menu-item" type="button" data-act="reset"><span class="menu-check">' + UI.icon('restore') + '</span>' +
      '<span class="menu-item-body">Reset sample data<em>Restore the seeded workspace state</em></span></button>';

    els.accountMenu.innerHTML = html;
    els.accountMenu.hidden = !menuOpen;
  }

  function render() {
    var route = parseHash();
    var view = VIEWS[route.name] || VIEWS.notfound;
    var title = typeof view.title === 'function' ? view.title(route.params, route.query) : view.title;
    var sub = typeof view.sub === 'function' ? view.sub(route.params, route.query) : view.sub;

    var scrollTop = els.view.scrollTop;
    var sameScreen = lastRoute.name === route.name && lastRoute.id === (route.params.id || '');

    els.pageTitle.textContent = title || '';
    els.pageSub.textContent = sub || '';
    doc.title = (title ? title + ' · ' : '') + 'iFixz Workspace';

    els.view.innerHTML = '';
    try {
      view.render(els.view, route.params, route.query);
    } catch (err) {
      els.view.innerHTML = '<div class="view-inner">' +
        UI.emptyState({
          icon: 'alert',
          title: 'This screen could not be drawn',
          text: String((err && err.message) || err) + ' — the rest of the workspace still works. Pick another tab, or reload the page to reseed the sample data.',
          action: '<a class="btn btn-primary" href="#/overview">Back to overview</a>'
        }) +
        '</div>';
    }
    els.view.scrollTop = sameScreen ? scrollTop : 0;

    renderNav(route);
    renderAccount();
    renderDbStatus();
    setNavOpen(false);

    lastRoute = { name: route.name, id: route.params.id || '' };
  }

  function setNavOpen(open) {
    var wasOpen = navOpen;
    navOpen = !!open;
    els.shell.className = navOpen ? 'shell nav-open' : 'shell';
    els.scrim.hidden = !navOpen;
    els.navToggle.setAttribute('aria-expanded', navOpen ? 'true' : 'false');
    if (navOpen) {
      var first = els.sidebarNav.querySelector('.nav-item');
      if (first && first.focus) first.focus();
    } else if (wasOpen && doc.activeElement && els.sidebar.contains(doc.activeElement)) {
      els.navToggle.focus();
    }
  }

  function navigate(hash) {
    if (String(window.location.hash) === hash) render();
    else window.location.hash = hash;
  }

  function boot() {
    els.shell = doc.querySelector('.shell');
    els.view = doc.getElementById('view');
    els.pageTitle = doc.getElementById('pageTitle');
    els.pageSub = doc.getElementById('pageSub');
    els.dbStatus = doc.getElementById('dbStatus');
    els.sidebar = doc.getElementById('sidebar');
    els.sidebarNav = doc.getElementById('sidebarNav');
    els.sidebarFoot = doc.getElementById('sidebarFoot');
    els.navToggle = doc.getElementById('navToggle');
    els.sidebarClose = doc.getElementById('sidebarClose');
    els.scrim = doc.getElementById('scrim');
    els.accountBtn = doc.getElementById('accountBtn');
    els.accountMenu = doc.getElementById('accountMenu');
    els.accountAvatar = doc.getElementById('accountAvatar');
    els.accountName = doc.getElementById('accountName');
    els.accountRole = doc.getElementById('accountRole');

    Store.load();

    UI.on(els.sidebarNav, 'click', '.nav-item', function () { setNavOpen(false); });
    UI.on(doc, 'click', 'a[href^="#/"]', function (event, link) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      var href = link.getAttribute('href');
      event.preventDefault();
      if (String(window.location.hash) === href) render();
      else window.location.hash = href;
    });

    els.navToggle.addEventListener('click', function () { setNavOpen(!navOpen); });
    els.sidebarClose.addEventListener('click', function () { setNavOpen(false); });
    els.scrim.addEventListener('click', function () { setNavOpen(false); });

    els.accountBtn.addEventListener('click', function (event) {
      event.stopPropagation();
      menuOpen = !menuOpen;
      renderAccount();
      if (menuOpen) {
        var checked = els.accountMenu.querySelector('[aria-checked="true"]');
        if (checked && checked.focus) checked.focus();
      }
    });

    UI.on(els.accountMenu, 'click', '[data-role]', function (event, button) {
      var roleId = button.getAttribute('data-role');
      menuOpen = false;
      Store.setRole(roleId);
      renderAccount();
      UI.toastInfo('Role switched', ROLES[roleId].label + ' — ' + ROLES[roleId].blurb.toLowerCase());
    });

    UI.on(els.accountMenu, 'click', '[data-act="reset"]', function () {
      menuOpen = false;
      renderAccount();
      UI.confirm({
        title: 'Reset sample data',
        heading: 'The workspace returns to its seeded state',
        bodyHtml: 'Runs, rejected records, registered modules, rule changes and snapshots you created in this browser are discarded.',
        confirmLabel: 'Reset workspace',
        danger: true
      }).then(function (ok) {
        if (!ok) return;
        Store.reset();
        navigate('#/overview');
        UI.toastOk('Sample data reset', 'The seeded workspace state is back.');
      });
    });

    doc.addEventListener('click', function (event) {
      if (!menuOpen) return;
      if (event.target.closest && event.target.closest('.menu-wrap')) return;
      menuOpen = false;
      renderAccount();
    });

    doc.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (UI.overlayCount() > 0) return;
      if (menuOpen) {
        menuOpen = false;
        renderAccount();
        els.accountBtn.focus();
        return;
      }
      if (navOpen) setNavOpen(false);
    });

    window.addEventListener('hashchange', function () {
      menuOpen = false;
      render();
      if (els.view.focus) els.view.focus();
    });

    Store.subscribe(function () { render(); });

    if (!window.location.hash) window.location.hash = '#/overview';
    render();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.IFIXZ);
