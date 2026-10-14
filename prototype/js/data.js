/* iFixz Workspace — prototype mock central database + local store.
   Classic script (no ES modules) so index.html also runs from file://.
   Sample data only: no real customer, financial or personal records. */
window.IFIXZ = window.IFIXZ || {};

(function (NS) {
  'use strict';

  var STORAGE_KEY = 'ifixz.workspace.prototype.v1';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function isoOf(d) { return d.toISOString(); }
  function daysAgoIso(n, hour) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hour === undefined ? 9 : hour, (n * 7) % 60, 0, 0);
    return isoOf(d);
  }
  function minutesAgoIso(m) {
    var d = new Date();
    d.setMinutes(d.getMinutes() - m);
    return isoOf(d);
  }
  function dayKeyOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function periodOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }

  /* ------------------------------------------------------------------- rng -- */

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var RNG = mulberry32(20260904);
  function rnd() { return RNG(); }
  function intBetween(min, max) { return min + Math.floor(rnd() * (max - min + 1)); }
  function pick(list) { return list[Math.floor(rnd() * list.length)]; }
  function maybe(p) { return rnd() < p; }

  /* ------------------------------------------------------------------ roles -- */

  var ROLES = {
    org_admin: {
      id: 'org_admin',
      label: 'Organization admin',
      blurb: 'Registers modules, edits pipeline rules, configures backups',
      person: { name: 'Aria Mendoza', initials: 'AM' },
      perms: { manageModules: true, editRules: true, manageBackups: true, inputRecords: true, viewAll: true }
    },
    user: {
      id: 'user',
      label: 'Department employee',
      blurb: 'Reads dashboards and enters records in native modules',
      person: { name: 'Rafael Dela Cruz', initials: 'RD' },
      perms: { manageModules: false, editRules: false, manageBackups: false, inputRecords: true, viewAll: true }
    },
    super_admin: {
      id: 'super_admin',
      label: 'Client super admin',
      blurb: 'Read-only oversight across every registered module',
      person: { name: 'Bea Alonzo', initials: 'BA' },
      perms: { manageModules: false, editRules: false, manageBackups: false, inputRecords: false, viewAll: true }
    }
  };

  var ADAPTERS = {
    native: { id: 'native', label: 'Native module', hint: 'Records are entered directly inside the workspace', fields: [] },
    file: {
      id: 'file', label: 'File', hint: 'Delimited export dropped on a schedule',
      fields: [
        { key: 'path', label: 'File location', placeholder: '/exports/payroll/period-export.csv', required: true },
        { key: 'delimiter', label: 'Delimiter', type: 'select', options: ['Comma', 'Semicolon', 'Tab', 'Pipe'], required: true },
        { key: 'encoding', label: 'Encoding', type: 'select', options: ['UTF-8', 'Windows-1252'], required: true }
      ]
    },
    database: {
      id: 'database', label: 'Database', hint: 'Read-only connection to an existing system of record',
      fields: [
        { key: 'host', label: 'Host', placeholder: '10.20.4.18', required: true },
        { key: 'port', label: 'Port', type: 'select', options: ['3306', '5432', '1433'], required: true },
        { key: 'database', label: 'Database name', placeholder: 'crm_prod', required: true },
        { key: 'user', label: 'Read-only user', placeholder: 'crm_ro', required: true }
      ]
    },
    api: {
      id: 'api', label: 'API', hint: 'Records pulled from a documented endpoint',
      fields: [
        { key: 'endpoint', label: 'Base endpoint', placeholder: 'https://billing.ifixz.co/v1/invoices', required: true },
        { key: 'auth', label: 'Authentication', type: 'select', options: ['Bearer token', 'API key header', 'OAuth 2.0 client'], required: true },
        { key: 'pageSize', label: 'Page size', type: 'select', options: ['50', '100', '250'], required: true }
      ]
    },
    webhook: {
      id: 'webhook', label: 'Webhook', hint: 'Source pushes events into a workspace receiver',
      fields: [
        { key: 'receiver', label: 'Receiver URL', placeholder: 'https://workspace.ifixz.co/hooks/support', required: true },
        { key: 'secret', label: 'Signing secret', placeholder: 'whsec_sample_3f81', required: true },
        { key: 'events', label: 'Subscribed events', type: 'select', options: ['All events', 'Created and updated', 'Created only'], required: true }
      ]
    }
  };

  /* ------------------------------------------------------- schema templates -- */

  var SCHEMA_PRESETS = {
    assets: {
      id: 'assets',
      label: 'Asset register',
      hint: 'Tracked equipment, licences and network gear',
      fields: [
        { key: 'assetTag', label: 'Asset tag', type: 'text', required: true },
        { key: 'description', label: 'Description', type: 'text', required: true },
        { key: 'category', label: 'Category', type: 'enum', required: true, options: ['Hardware', 'Software', 'Furniture', 'Network'] },
        { key: 'unitValue', label: 'Unit value', type: 'number', required: true },
        { key: 'condition', label: 'Condition', type: 'enum', required: true, options: ['New', 'Good', 'Fair', 'Retired'] },
        { key: 'updatedAt', label: 'Last updated', type: 'date', required: true }
      ]
    },
    serviceRequests: {
      id: 'serviceRequests',
      label: 'Service request log',
      hint: 'Requests captured from the support channels',
      fields: [
        { key: 'requestNo', label: 'Request no.', type: 'text', required: true },
        { key: 'requester', label: 'Requester', type: 'text', required: true },
        { key: 'channel', label: 'Channel', type: 'enum', required: true, options: ['Email', 'Phone', 'Walk-in', 'Portal'] },
        { key: 'priority', label: 'Priority', type: 'enum', required: true, options: ['Urgent', 'High', 'Normal', 'Low'] },
        { key: 'openedAt', label: 'Opened at', type: 'date', required: true }
      ]
    },
    fulfilment: {
      id: 'fulfilment',
      label: 'Order fulfilment',
      hint: 'Outbound orders handed to logistics',
      fields: [
        { key: 'orderRef', label: 'Order ref', type: 'text', required: true },
        { key: 'customer', label: 'Customer', type: 'text', required: true },
        { key: 'region', label: 'Region', type: 'enum', required: true, options: ['NCR', 'Luzon', 'Visayas', 'Mindanao'] },
        { key: 'value', label: 'Order value', type: 'number', required: true },
        { key: 'status', label: 'Status', type: 'enum', required: true, options: ['Open', 'Picked', 'Delivered', 'Returned'] },
        { key: 'orderedAt', label: 'Ordered at', type: 'date', required: true }
      ]
    }
  };

  /* ------------------------------------------------------------- seed data -- */

  var WAREHOUSES = ['Cebu Main', 'Manila Hub', 'Davao Depot'];
  var REGIONS = ['NCR', 'Luzon', 'Visayas', 'Mindanao'];
  var COMPANIES = [
    'Cebu Agri Coop', 'Manila Ridge Foods', 'Davao Timberworks', 'Cordillera Mining Co.', 'Bicol Fresh Retail',
    'Metro Care Hospitals', 'Visayas Logistics', 'Ilocos Textile Mills', 'Central Luzon Motors', 'Zamboanga Poultry',
    'Cavite Steelworks', 'Baguio Cold Storage', 'Negros Sugar Corp.', 'Pampanga Packaging', 'Quezon Water District',
    'Palawan Tourism Co.', 'Romblon Saltworks', 'Bicol Marine Corp.', 'Aklan Rice Mills', 'Nueva Ecija Poultry'
  ];
  var CONTACTS = [
    'maria.santos@ifixz.co', 'j.delacruz@ifixz.co', 'a.reyes@ifixz.co', 'k.mabini@ifixz.co',
    'r.torres@ifixz.co', 'l.mercado@ifixz.co', 'd.villanueva@ifixz.co', 'p.ocon@ifixz.co'
  ];
  var OWNERS = ['A. Mendoza', 'R. Dela Cruz', 'J. Uy', 'C. Ramos', 'P. Lim'];
  var SUBJECTS = [
    'Cannot access the sales dashboard', 'Invoice PDF will not download', 'POS terminal loses connection',
    'Request for an additional seat', 'Wrong item delivered', 'Password reset link expired',
    'Barcode scanner not reading labels', 'Sync delay on yesterday records', 'Request to update billing address',
    'Stock count mismatch report', 'User locked out after retries', 'Need a copy of last month invoice'
  ];
  var ITEMS = [
    ['SKU-1001', 'Ergonomic task chair', 4850], ['SKU-1002', 'Standing desk frame', 12400],
    ['SKU-1003', '27-inch LED monitor', 8900], ['SKU-1004', 'USB-C docking station', 5600],
    ['SKU-1005', 'Thermal receipt printer', 7300], ['SKU-1006', 'Barcode scanner 2D', 4100],
    ['SKU-1007', 'Label printer 4x6', 3200], ['SKU-1008', 'POS terminal 15-inch', 21900],
    ['SKU-1009', 'Cash drawer steel', 2750], ['SKU-1010', 'Thermal paper roll 80mm', 145],
    ['SKU-1011', 'Carton box medium', 46], ['SKU-1012', 'Stretch film roll', 210],
    ['SKU-1013', 'Pallet plastic 1200x1000', 780], ['SKU-1014', 'Safety vest hi-vis', 165],
    ['SKU-1015', 'Safety gloves pair', 92], ['SKU-1016', 'Forklift battery 48V', 96000],
    ['SKU-1017', 'Pallet jack 2-ton', 54500], ['SKU-1018', 'Shelving bay 5-tier', 12800],
    ['SKU-1019', 'Cold storage thermostat', 7400], ['SKU-1020', 'Aircon 1.5HP', 26800],
    ['SKU-1021', 'Router dual-band', 3990], ['SKU-1022', 'Network switch 24-port', 18900],
    ['SKU-1023', 'Cat6 cable box 305m', 4300], ['SKU-1024', 'Access point ceiling', 6800],
    ['SKU-1025', 'Inkjet cartridge CMYK', 5200], ['SKU-1026', 'A4 paper ream', 285],
    ['SKU-1027', 'Cleaning kit industrial', 1180], ['SKU-1028', 'First aid kit wall', 1650],
    ['SKU-1029', 'Fire extinguisher 6kg', 2100], ['SKU-1030', 'Hand truck 250kg', 3400],
    ['SKU-1031', 'Label tape 36mm', 240], ['SKU-1032', 'Cardboard mailer #2', 18],
    ['SKU-1033', 'Battery AA 4-pack', 220], ['SKU-1034', 'Coffee beans 1kg', 480],
    ['SKU-1035', 'Cleaning mop head', 130], ['SKU-1036', 'Visitor chair', 3600],
    ['SKU-1037', 'Conference table 12-seater', 46500], ['SKU-1038', 'Whiteboard 120x90', 4200],
    ['SKU-1039', 'Tablet 10-inch', 17800], ['SKU-1040', 'Headset with microphone', 2350]
  ];

  function seededModules() {
    var now = new Date();
    var i, r;

    var imsRecords = [];
    for (i = 0; i < ITEMS.length; i++) {
      var rows = intBetween(2, 5);
      for (r = 0; r < rows; r++) {
        var roll = rnd();
        imsRecords.push({
          id: 'IMS-' + ITEMS[i][0] + '-' + pad(r + 1),
          sku: ITEMS[i][0],
          itemName: ITEMS[i][1],
          qty: roll < 0.07 ? 0 : roll < 0.3 ? intBetween(1, 20) : intBetween(21, 240),
          reorderPoint: 12 + (imsRecords.length % 24),
          warehouse: pick(WAREHOUSES),
          unitCost: ITEMS[i][2] + intBetween(-40, 40),
          updatedAt: daysAgoIso(intBetween(0, 28), intBetween(7, 19)),
          _source: 'bulk',
          _ingestedAt: daysAgoIso(intBetween(0, 28), 2)
        });
      }
    }

    var salesRecords = [];
    for (i = 0; i < 260; i++) {
      salesRecords.push({
        id: 'SO-' + (20260 + i),
        orderRef: 'SO-' + (90210 + i),
        customer: pick(COMPANIES),
        region: pick(REGIONS),
        amount: intBetween(18, 640) * 100,
        status: pick(['Open', 'Invoiced', 'Invoiced', 'Closed', 'Closed', 'Cancelled']),
        placedAt: daysAgoIso(intBetween(0, 29), intBetween(8, 20)),
        _source: 'native',
        _ingestedAt: daysAgoIso(intBetween(0, 29), 21)
      });
    }

    var billingRecords = [];
    for (i = 0; i < 170; i++) {
      billingRecords.push({
        id: 'INV-' + (2026000 + i),
        invoiceNo: 'INV-2026-' + pad(i + 1),
        customer: pick(COMPANIES),
        amount: intBetween(45, 900) * 100,
        status: pick(['Paid', 'Paid', 'Sent', 'Sent', 'Overdue', 'Draft']),
        issuedAt: daysAgoIso(intBetween(0, 29), intBetween(9, 18)),
        _source: 'sync',
        _ingestedAt: minutesAgoIso(intBetween(2, 900))
      });
    }

    var supportRecords = [];
    for (i = 0; i < 150; i++) {
      supportRecords.push({
        id: 'TKT-' + (4100 + i),
        ticketId: 'TKT-' + (4100 + i),
        subject: pick(SUBJECTS),
        priority: pick(['Urgent', 'High', 'High', 'Normal', 'Normal', 'Normal', 'Low']),
        status: pick(['Open', 'Open', 'Pending', 'Resolved', 'Resolved', 'Resolved']),
        contactEmail: pick(CONTACTS),
        openedAt: daysAgoIso(intBetween(0, 21), intBetween(7, 20)),
        _source: 'sync',
        _ingestedAt: minutesAgoIso(intBetween(2, 420))
      });
    }

    var EMPLOYEES = [
      ['EMP-101', 'M. Santos'], ['EMP-102', 'J. Uy'], ['EMP-103', 'C. Ramos'], ['EMP-104', 'P. Lim'],
      ['EMP-105', 'L. Mercado'], ['EMP-106', 'D. Villanueva'], ['EMP-107', 'R. Torres'], ['EMP-108', 'K. Mabini'],
      ['EMP-109', 'A. Reyes'], ['EMP-110', 'S. Aquino'], ['EMP-111', 'T. Bautista'], ['EMP-112', 'N. Domingo']
    ];
    var periods = [
      periodOf(now),
      periodOf(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      periodOf(new Date(now.getFullYear(), now.getMonth() - 2, 1))
    ];
    var payrollRecords = [];
    for (i = 0; i < EMPLOYEES.length; i++) {
      for (r = 0; r < periods.length; r++) {
        payrollRecords.push({
          id: EMPLOYEES[i][0] + '-' + periods[r],
          employeeId: EMPLOYEES[i][0],
          employee: EMPLOYEES[i][1],
          period: periods[r],
          gross: 28000 + intBetween(0, 42) * 500,
          status: r === 0 ? pick(['Draft', 'Draft', 'Approved']) : 'Paid',
          _source: 'sync',
          _ingestedAt: daysAgoIso(r * 30, 3)
        });
      }
    }

    var crmRecords = [];
    for (i = 0; i < 130; i++) {
      crmRecords.push({
        id: 'ACC-' + (7200 + i),
        accountId: 'ACC-' + (7200 + i),
        account: pick(COMPANIES),
        owner: pick(OWNERS),
        stage: pick(['Prospect', 'Qualify', 'Proposal', 'Negotiation', 'Negotiation', 'Won', 'Won', 'Lost']),
        value: intBetween(30, 1200) * 100,
        updatedAt: daysAgoIso(intBetween(0, 20), intBetween(8, 19)),
        _source: 'sync',
        _ingestedAt: minutesAgoIso(137)
      });
    }

    return [
      {
        id: 'ims',
        name: 'IMS',
        key: 'ims',
        kind: 'native',
        owner: 'Operations',
        version: '2.4.0',
        description: 'Inventory Management System — stock positions per warehouse and the workspace system of record for physical goods.',
        status: 'active',
        createdAt: daysAgoIso(210, 9),
        adapter: { type: 'native', syncMode: 'realtime', interval: 'On save', connection: {}, mapping: {} },
        schema: [
          { key: 'sku', label: 'SKU', type: 'text', required: true },
          { key: 'itemName', label: 'Item name', type: 'text', required: true },
          { key: 'qty', label: 'Quantity', type: 'number', required: true },
          { key: 'reorderPoint', label: 'Reorder point', type: 'number', required: true },
          { key: 'warehouse', label: 'Warehouse', type: 'enum', required: true, options: WAREHOUSES },
          { key: 'unitCost', label: 'Unit cost', type: 'number', required: true },
          { key: 'updatedAt', label: 'Last updated', type: 'date', required: true }
        ],
        rules: [
          { id: 'ims-r1', field: 'sku', type: 'required', label: 'SKU is required', enabled: true },
          { id: 'ims-r2', field: 'itemName', type: 'required', label: 'Item name is required', enabled: true },
          { id: 'ims-r3', field: 'qty', type: 'numeric', label: 'Quantity must be a number of at least 1', enabled: true, params: { min: 1 } },
          { id: 'ims-r4', field: 'unitCost', type: 'numeric', label: 'Unit cost cannot be negative', enabled: true, params: { min: 0 } },
          { id: 'ims-r5', field: 'warehouse', type: 'allowed', label: 'Warehouse must be a known location', enabled: true, params: { values: WAREHOUSES } },
          { id: 'ims-r6', field: 'sku', type: 'duplicate', label: 'SKU + warehouse must be unique in the central database', enabled: true, params: { scope: 'warehouse' } },
          { id: 'ims-r7', field: 'updatedAt', type: 'format', label: 'Last updated must be a valid date', enabled: true, params: { kind: 'date' } },
          { id: 'ims-r8', field: 'reorderPoint', type: 'numeric', label: 'Reorder point must be a number of at least 0', enabled: true, params: { min: 0 } }
        ],
        dashboard: {
          metrics: [
            { key: 'units', label: 'Units on hand', type: 'sum', field: 'qty' },
            { key: 'value', label: 'Stock value', type: 'sumProduct', field: 'qty', field2: 'unitCost' },
            { key: 'skus', label: 'Active SKUs', type: 'distinct', field: 'sku' },
            { key: 'depleted', label: 'Out-of-stock lines', type: 'countWhere', field: 'qty', params: { values: ['0'] } }
          ],
          trend: { field: 'qty', label: 'Units received per day', type: 'sum', bucket: 'day', days: 14 },
          group: { field: 'warehouse', label: 'Units by warehouse', type: 'sum', valueField: 'qty' },
          panels: [
            {
              id: 'replenishment',
              title: 'Replenishment watch',
              sub: 'Lowest stock lines · on hand against reorder point',
              tag: 'Qty · ascending',
              columns: ['sku', 'itemName', 'qty', 'reorderPoint', 'warehouse'],
              sort: { field: 'qty', dir: 'asc' },
              limit: 8,
              emptyTitle: 'Nothing is running low',
              emptyText: 'Every validated SKU in this module still has stock on hand.'
            }
          ]
        },
        sharedMetrics: ['records', 'stock'],
        permissions: { user: ['view', 'input'], admin: ['*'] },
        routes: { dashboard: '#/module/ims', records: '#/module/ims/records' },
        events: ['record.rejected', 'module.sync'],
        source: { state: 'up', lastSyncedAt: minutesAgoIso(4) },
        records: imsRecords
      },
      {
        id: 'sales-operation',
        name: 'Sales Operation',
        key: 'sales-operation',
        kind: 'native',
        owner: 'Commercial',
        version: '1.9.2',
        description: 'Order intake and pipeline for the commercial team. Feeds invoicing through the shared metrics layer.',
        status: 'active',
        createdAt: daysAgoIso(198, 10),
        adapter: { type: 'native', syncMode: 'realtime', interval: 'On save', connection: {}, mapping: {} },
        schema: [
          { key: 'orderRef', label: 'Order ref', type: 'text', required: true },
          { key: 'customer', label: 'Customer', type: 'text', required: true },
          { key: 'region', label: 'Region', type: 'enum', required: true, options: REGIONS },
          { key: 'amount', label: 'Amount', type: 'number', required: true },
          { key: 'status', label: 'Status', type: 'enum', required: true, options: ['Open', 'Invoiced', 'Closed', 'Cancelled'] },
          { key: 'placedAt', label: 'Placed at', type: 'date', required: true }
        ],
        rules: [
          { id: 'so-r1', field: 'orderRef', type: 'required', label: 'Order ref is required', enabled: true },
          { id: 'so-r2', field: 'orderRef', type: 'duplicate', label: 'Order ref must be unique', enabled: true },
          { id: 'so-r3', field: 'amount', type: 'numeric', label: 'Amount must be at least 1', enabled: true, params: { min: 1 } },
          { id: 'so-r4', field: 'region', type: 'allowed', label: 'Region must be one of NCR, Luzon, Visayas, Mindanao', enabled: true, params: { values: REGIONS } },
          { id: 'so-r5', field: 'status', type: 'allowed', label: 'Status must be Open, Invoiced, Closed or Cancelled', enabled: true, params: { values: ['Open', 'Invoiced', 'Closed', 'Cancelled'] } },
          { id: 'so-r6', field: 'customer', type: 'required', label: 'Customer is required', enabled: true }
        ],
        dashboard: {
          metrics: [
            { key: 'revenue', label: 'Order value (30d)', type: 'sum', field: 'amount', params: { notStatus: 'Cancelled' } },
            { key: 'orders', label: 'Orders (30d)', type: 'count' },
            { key: 'aov', label: 'Average order', type: 'avg', field: 'amount', params: { notStatus: 'Cancelled' } },
            { key: 'open', label: 'Open orders', type: 'countWhere', field: 'status', params: { values: ['Open'] } }
          ],
          trend: { field: 'amount', label: 'Order value per day', type: 'sum', bucket: 'day', days: 14 },
          group: { field: 'region', label: 'Orders by region', type: 'count' },
          panels: [
            {
              id: 'open-orders',
              title: 'Open orders',
              sub: 'Awaiting invoicing or close · largest value first',
              tag: 'Status · Open',
              columns: ['orderRef', 'customer', 'region', 'amount', 'placedAt'],
              filters: [{ field: 'status', values: ['Open'] }],
              sort: { field: 'amount', dir: 'desc' },
              limit: 8,
              emptyTitle: 'No open orders',
              emptyText: 'Every order is invoiced, closed or cancelled.'
            }
          ]
        },
        sharedMetrics: ['records', 'revenue', 'openWork'],
        permissions: { user: ['view', 'input'], admin: ['*'] },
        routes: { dashboard: '#/module/sales-operation', records: '#/module/sales-operation/records' },
        events: ['record.rejected', 'module.sync'],
        source: { state: 'up', lastSyncedAt: minutesAgoIso(6) },
        records: salesRecords
      },
      {
        id: 'billing-api',
        name: 'Billing API',
        key: 'billing-api',
        kind: 'external',
        owner: 'Finance',
        version: '1.2.0',
        description: 'Invoices issued by the legacy billing service. Read-only inside the workspace — nothing is written back to the source.',
        status: 'inactive',
        createdAt: daysAgoIso(96, 11),
        adapter: {
          type: 'api', syncMode: 'realtime', interval: 'Every 5 minutes',
          connection: { endpoint: 'https://billing.ifixz.co/v1/invoices', auth: 'Bearer token', pageSize: '100' },
          mapping: { invoiceNo: 'invoice_number', customer: 'client_name', amount: 'total_due', status: 'invoice_status', issuedAt: 'issue_date' }
        },
        schema: [
          { key: 'invoiceNo', label: 'Invoice no.', type: 'text', required: true },
          { key: 'customer', label: 'Customer', type: 'text', required: true },
          { key: 'amount', label: 'Amount', type: 'number', required: true },
          { key: 'status', label: 'Status', type: 'enum', required: true, options: ['Draft', 'Sent', 'Paid', 'Overdue'] },
          { key: 'issuedAt', label: 'Issued at', type: 'date', required: true }
        ],
        rules: [
          { id: 'bill-r1', field: 'invoiceNo', type: 'required', label: 'Invoice no. is required', enabled: true },
          { id: 'bill-r2', field: 'invoiceNo', type: 'duplicate', label: 'Invoice no. must not be synced twice', enabled: true },
          { id: 'bill-r3', field: 'amount', type: 'numeric', label: 'Amount must be a number of at least 0', enabled: true, params: { min: 0 } },
          { id: 'bill-r4', field: 'status', type: 'allowed', label: 'Status must be Draft, Sent, Paid or Overdue', enabled: true, params: { values: ['Draft', 'Sent', 'Paid', 'Overdue'] } }
        ],
        dashboard: {
          metrics: [
            { key: 'invoiced', label: 'Invoiced (30d)', type: 'sum', field: 'amount', params: { notStatus: 'Draft' } },
            { key: 'collected', label: 'Collected', type: 'sumWhere', field: 'amount', params: { status: 'Paid' } },
            { key: 'overdue', label: 'Overdue value', type: 'sumWhere', field: 'amount', params: { status: 'Overdue' } },
            { key: 'invoices', label: 'Invoices', type: 'count' }
          ],
          trend: { field: 'amount', label: 'Invoiced value per day', type: 'sum', bucket: 'day', days: 14 },
          group: { field: 'status', label: 'Invoices by status', type: 'count' },
          panels: [
            {
              id: 'overdue-invoices',
              title: 'Overdue invoices',
              sub: 'Past due and still unpaid · largest balance first',
              tag: 'Status · Overdue',
              columns: ['invoiceNo', 'customer', 'amount', 'issuedAt'],
              filters: [{ field: 'status', values: ['Overdue'] }],
              sort: { field: 'amount', dir: 'desc' },
              limit: 8,
              emptyTitle: 'Nothing overdue',
              emptyText: 'No invoice in this module is past due.'
            }
          ]
        },
        sharedMetrics: ['records', 'revenue'],
        permissions: { user: ['view'], admin: ['*'] },
        routes: { dashboard: '#/module/billing-api', records: '#/module/billing-api/records' },
        events: ['record.rejected', 'module.sync', 'source.unreachable'],
        source: { state: 'up', lastSyncedAt: minutesAgoIso(7) },
        records: billingRecords
      },
      {
        id: 'support-desk',
        name: 'Support Desk',
        key: 'support-desk',
        kind: 'external',
        owner: 'Customer care',
        version: '1.0.4',
        description: 'Tickets pushed by the helpdesk webhook receiver, reconciled on an hourly batch run.',
        status: 'inactive',
        createdAt: daysAgoIso(74, 13),
        adapter: {
          type: 'webhook', syncMode: 'batch', interval: 'Every hour',
          connection: { receiver: 'https://workspace.ifixz.co/hooks/support', secret: 'whsec_sample_3f81', events: 'All events' },
          mapping: { ticketId: 'ticket_ref', subject: 'summary', priority: 'urgency', status: 'state', contactEmail: 'reporter.email', openedAt: 'created_at' }
        },
        schema: [
          { key: 'ticketId', label: 'Ticket ID', type: 'text', required: true },
          { key: 'subject', label: 'Subject', type: 'text', required: true },
          { key: 'priority', label: 'Priority', type: 'enum', required: true, options: ['Urgent', 'High', 'Normal', 'Low'] },
          { key: 'status', label: 'Status', type: 'enum', required: true, options: ['Open', 'Pending', 'Resolved'] },
          { key: 'contactEmail', label: 'Contact email', type: 'email', required: true },
          { key: 'openedAt', label: 'Opened at', type: 'date', required: true }
        ],
        rules: [
          { id: 'sup-r1', field: 'ticketId', type: 'required', label: 'Ticket ID is required', enabled: true },
          { id: 'sup-r2', field: 'ticketId', type: 'duplicate', label: 'Ticket ID must not be synced twice', enabled: true },
          { id: 'sup-r3', field: 'contactEmail', type: 'format', label: 'Contact email must be a valid address', enabled: true, params: { kind: 'email' } },
          { id: 'sup-r4', field: 'priority', type: 'allowed', label: 'Priority must be Urgent, High, Normal or Low', enabled: true, params: { values: ['Urgent', 'High', 'Normal', 'Low'] } },
          { id: 'sup-r5', field: 'status', type: 'allowed', label: 'Status must be Open, Pending or Resolved', enabled: true, params: { values: ['Open', 'Pending', 'Resolved'] } }
        ],
        dashboard: {
          metrics: [
            { key: 'open', label: 'Open tickets', type: 'countWhere', field: 'status', params: { values: ['Open', 'Pending'] } },
            { key: 'urgent', label: 'Urgent open', type: 'countWhere', field: 'priority', params: { values: ['Urgent'] } },
            { key: 'resolved', label: 'Resolved', type: 'countWhere', field: 'status', params: { values: ['Resolved'] } },
            { key: 'emails', label: 'Distinct reporters', type: 'distinct', field: 'contactEmail' }
          ],
          trend: { field: 'ticketId', label: 'Tickets opened per day', type: 'count', bucket: 'day', days: 14 },
          group: { field: 'priority', label: 'Tickets by priority', type: 'count' },
          panels: [
            {
              id: 'urgent-queue',
              title: 'Urgent open queue',
              sub: 'Urgent tickets not yet resolved · oldest first',
              tag: 'Priority · Urgent',
              columns: ['ticketId', 'subject', 'priority', 'status', 'openedAt'],
              filters: [
                { field: 'priority', values: ['Urgent'] },
                { field: 'status', values: ['Resolved'], exclude: true }
              ],
              sort: { field: 'openedAt', dir: 'asc' },
              limit: 8,
              emptyTitle: 'Queue is clear',
              emptyText: 'No urgent ticket is waiting for a reply.'
            }
          ]
        },
        sharedMetrics: ['records', 'openWork'],
        permissions: { user: ['view'], admin: ['*'] },
        routes: { dashboard: '#/module/support-desk', records: '#/module/support-desk/records' },
        events: ['record.rejected', 'module.sync'],
        source: { state: 'up', lastSyncedAt: minutesAgoIso(11) },
        records: supportRecords
      },
      {
        id: 'payroll-export',
        name: 'Payroll Export',
        key: 'payroll-export',
        kind: 'external',
        owner: 'People ops',
        version: '1.1.0',
        description: 'Monthly payroll export dropped as a delimited file and validated before it reaches the central database.',
        status: 'inactive',
        createdAt: daysAgoIso(61, 14),
        adapter: {
          type: 'file', syncMode: 'batch', interval: 'Daily at 02:00',
          connection: { path: '/exports/payroll/period-export.csv', delimiter: 'Comma', encoding: 'UTF-8' },
          mapping: { employeeId: 'emp_no', employee: 'emp_name', period: 'pay_period', gross: 'gross_amount', status: 'pay_status' }
        },
        schema: [
          { key: 'employeeId', label: 'Employee ID', type: 'text', required: true },
          { key: 'employee', label: 'Employee', type: 'text', required: true },
          { key: 'period', label: 'Pay period', type: 'text', required: true },
          { key: 'gross', label: 'Gross pay', type: 'number', required: true },
          { key: 'status', label: 'Status', type: 'enum', required: true, options: ['Draft', 'Approved', 'Paid'] }
        ],
        rules: [
          { id: 'pay-r1', field: 'employeeId', type: 'required', label: 'Employee ID is required', enabled: true },
          { id: 'pay-r2', field: 'employeeId', type: 'duplicate', label: 'Employee ID + pay period must be unique', enabled: true, params: { scope: 'period' } },
          { id: 'pay-r3', field: 'period', type: 'format', label: 'Pay period must look like 2026-09', enabled: true, params: { kind: 'period' } },
          { id: 'pay-r4', field: 'gross', type: 'numeric', label: 'Gross pay must be at least 0', enabled: true, params: { min: 0 } },
          { id: 'pay-r5', field: 'status', type: 'allowed', label: 'Status must be Draft, Approved or Paid', enabled: true, params: { values: ['Draft', 'Approved', 'Paid'] } }
        ],
        dashboard: {
          metrics: [
            { key: 'headcount', label: 'Employees in period', type: 'count' },
            { key: 'gross', label: 'Gross payroll', type: 'sum', field: 'gross' },
            { key: 'pending', label: 'Pending approval', type: 'countWhere', field: 'status', params: { values: ['Draft'] } },
            { key: 'avg', label: 'Average gross', type: 'avg', field: 'gross' }
          ],
          trend: { field: 'gross', label: 'Gross payroll per period', type: 'sum', bucket: 'period', count: 6 },
          group: { field: 'status', label: 'Records by pay status', type: 'count' },
          panels: [
            {
              id: 'pending-approval',
              title: 'Awaiting approval',
              sub: 'Pay runs still in draft · latest period first',
              tag: 'Status · Draft',
              columns: ['employeeId', 'employee', 'period', 'gross', 'status'],
              filters: [{ field: 'status', values: ['Draft'] }],
              sort: { field: 'period', dir: 'desc' },
              limit: 8,
              emptyTitle: 'Nothing pending',
              emptyText: 'Every pay run in this export is approved or paid.'
            }
          ]
        },
        sharedMetrics: ['records', 'payroll'],
        permissions: { user: ['view'], admin: ['*'] },
        routes: { dashboard: '#/module/payroll-export', records: '#/module/payroll-export/records' },
        events: ['record.rejected', 'module.sync'],
        source: { state: 'up', lastSyncedAt: minutesAgoIso(52) },
        records: payrollRecords
      },
      {
        id: 'crm-mirror',
        name: 'CRM Mirror',
        key: 'crm-mirror',
        kind: 'external',
        owner: 'Commercial',
        version: '0.9.3',
        description: 'Read-only mirror of the sales CRM database. The source is unreachable right now, so the workspace serves the last successful sync.',
        status: 'inactive',
        createdAt: daysAgoIso(43, 15),
        adapter: {
          type: 'database', syncMode: 'realtime', interval: 'Every 15 minutes',
          connection: { host: '10.20.4.18', port: '3306', database: 'crm_prod', user: 'crm_ro' },
          mapping: { accountId: 'account_no', account: 'company_name', owner: 'account_owner', stage: 'pipeline_stage', value: 'deal_value', updatedAt: 'last_touch' }
        },
        schema: [
          { key: 'accountId', label: 'Account ID', type: 'text', required: true },
          { key: 'account', label: 'Account', type: 'text', required: true },
          { key: 'owner', label: 'Owner', type: 'text', required: true },
          { key: 'stage', label: 'Stage', type: 'enum', required: true, options: ['Prospect', 'Qualify', 'Proposal', 'Negotiation', 'Won', 'Lost'] },
          { key: 'value', label: 'Deal value', type: 'number', required: true },
          { key: 'updatedAt', label: 'Last updated', type: 'date', required: true }
        ],
        rules: [
          { id: 'crm-r1', field: 'accountId', type: 'required', label: 'Account ID is required', enabled: true },
          { id: 'crm-r2', field: 'accountId', type: 'duplicate', label: 'Account ID must not be synced twice', enabled: true },
          { id: 'crm-r3', field: 'value', type: 'numeric', label: 'Deal value must be at least 0', enabled: true, params: { min: 0 } },
          { id: 'crm-r4', field: 'stage', type: 'allowed', label: 'Stage must be a known pipeline stage', enabled: true, params: { values: ['Prospect', 'Qualify', 'Proposal', 'Negotiation', 'Won', 'Lost'] } }
        ],
        dashboard: {
          metrics: [
            { key: 'pipeline', label: 'Open pipeline', type: 'sumWhereNot', field: 'value', params: { values: ['Won', 'Lost'] } },
            { key: 'open', label: 'Open opportunities', type: 'countWhereNot', field: 'stage', params: { values: ['Won', 'Lost'] } },
            { key: 'won', label: 'Won value', type: 'sumWhere', field: 'value', params: { status: 'Won' } },
            { key: 'accounts', label: 'Accounts mirrored', type: 'distinct', field: 'accountId' }
          ],
          trend: { field: 'value', label: 'Deal value touched per day', type: 'sum', bucket: 'day', days: 14 },
          group: { field: 'stage', label: 'Accounts by stage', type: 'count' },
          panels: [
            {
              id: 'open-deals',
              title: 'Open deals',
              sub: 'Opportunities not yet won or lost · largest value first',
              tag: 'Stage · Open',
              columns: ['accountId', 'account', 'owner', 'stage', 'value'],
              filters: [{ field: 'stage', values: ['Won', 'Lost'], exclude: true }],
              sort: { field: 'value', dir: 'desc' },
              limit: 8,
              emptyTitle: 'No open opportunities',
              emptyText: 'Every mirrored account is closed — won or lost.'
            }
          ]
        },
        sharedMetrics: ['records'],
        permissions: { user: ['view'], admin: ['*'] },
        routes: { dashboard: '#/module/crm-mirror', records: '#/module/crm-mirror/records' },
        events: ['record.rejected', 'module.sync', 'source.unreachable'],
        source: { state: 'down', lastSyncedAt: minutesAgoIso(137) },
        records: crmRecords
      }
    ];
  }

  function seedRuns() {
    return [
      { id: 'RUN-4471', moduleId: 'billing-api', source: 'sync', ingested: 42, passed: 41, rejected: 1, durationMs: 1180, at: minutesAgoIso(7), actor: 'system' },
      { id: 'RUN-4470', moduleId: 'sales-operation', source: 'bulk', ingested: 120, passed: 118, rejected: 2, durationMs: 2140, at: minutesAgoIso(38), actor: 'A. Mendoza' },
      { id: 'RUN-4469', moduleId: 'ims', source: 'bulk', ingested: 96, passed: 94, rejected: 2, durationMs: 1860, at: minutesAgoIso(64), actor: 'system' },
      { id: 'RUN-4468', moduleId: 'support-desk', source: 'sync', ingested: 24, passed: 22, rejected: 2, durationMs: 940, at: minutesAgoIso(96), actor: 'system' },
      { id: 'RUN-4467', moduleId: 'payroll-export', source: 'sync', ingested: 36, passed: 36, rejected: 0, durationMs: 820, at: minutesAgoIso(140), actor: 'system' }
    ];
  }

  function seedRejected() {
    return [
      {
        id: 'REJ-0184', moduleId: 'ims', source: 'bulk', receivedAt: minutesAgoIso(64),
        payload: { sku: 'SKU-1021', itemName: '', qty: -4, warehouse: 'Cebu Main', unitCost: 3990, updatedAt: daysAgoIso(0, 8) },
        reasons: [
          { ruleId: 'ims-r2', field: 'itemName', message: 'Item name is required', value: '(empty)' },
          { ruleId: 'ims-r3', field: 'qty', message: 'Quantity must be a number of at least 1', value: '-4' }
        ]
      },
      {
        id: 'REJ-0183', moduleId: 'ims', source: 'bulk', receivedAt: minutesAgoIso(64),
        payload: { sku: 'SKU-1005', itemName: 'Thermal receipt printer', qty: 12, warehouse: 'Cebu Main', unitCost: 7300, updatedAt: daysAgoIso(1, 10) },
        reasons: [{ ruleId: 'ims-r6', field: 'sku', message: 'SKU + warehouse must be unique in the central database (existing IMS-SKU-1005-2)', value: 'SKU-1005' }]
      },
      {
        id: 'REJ-0182', moduleId: 'sales-operation', source: 'bulk', receivedAt: minutesAgoIso(38),
        payload: { orderRef: 'SO-90277', customer: 'Cebu Agri Coop', region: 'Cebu', amount: 0, status: 'Open', placedAt: daysAgoIso(0, 11) },
        reasons: [
          { ruleId: 'so-r4', field: 'region', message: 'Region must be one of NCR, Luzon, Visayas, Mindanao', value: 'Cebu' },
          { ruleId: 'so-r3', field: 'amount', message: 'Amount must be at least 1', value: '0' }
        ]
      },
      {
        id: 'REJ-0181', moduleId: 'sales-operation', source: 'bulk', receivedAt: minutesAgoIso(38),
        payload: { orderRef: '', customer: 'Bicol Marine Corp.', region: 'Luzon', amount: 24500, status: 'Invoiced', placedAt: daysAgoIso(0, 12) },
        reasons: [{ ruleId: 'so-r1', field: 'orderRef', message: 'Order ref is required', value: '(empty)' }]
      },
      {
        id: 'REJ-0180', moduleId: 'billing-api', source: 'sync', receivedAt: minutesAgoIso(7),
        payload: { invoiceNo: 'INV-2026-0142', customer: 'Pampanga Packaging', amount: 'n/a', status: 'Sent', issuedAt: daysAgoIso(0, 9) },
        reasons: [{ ruleId: 'bill-r3', field: 'amount', message: 'Amount must be a number of at least 0', value: 'n/a' }]
      },
      {
        id: 'REJ-0179', moduleId: 'support-desk', source: 'sync', receivedAt: minutesAgoIso(96),
        payload: { ticketId: 'TKT-4211', subject: 'Sync delay on yesterday records', priority: 'Critical', status: 'Open', contactEmail: 'support(at)ifixz.co', openedAt: daysAgoIso(0, 8) },
        reasons: [
          { ruleId: 'sup-r4', field: 'priority', message: 'Priority must be Urgent, High, Normal or Low', value: 'Critical' },
          { ruleId: 'sup-r3', field: 'contactEmail', message: 'Contact email must be a valid address', value: 'support(at)ifixz.co' }
        ]
      },
      {
        id: 'REJ-0178', moduleId: 'support-desk', source: 'sync', receivedAt: minutesAgoIso(96),
        payload: { ticketId: '', subject: 'Need a copy of last month invoice', priority: 'Normal', status: 'Pending', contactEmail: 'l.mercado@ifixz.co', openedAt: daysAgoIso(0, 13) },
        reasons: [{ ruleId: 'sup-r1', field: 'ticketId', message: 'Ticket ID is required', value: '(empty)' }]
      }
    ];
  }

  function seedActivity() {
    return [
      { at: minutesAgoIso(4), actor: 'System', action: 'Pipeline run completed', detail: 'IMS — 18 ingested, 17 passed', icon: 'pipeline' },
      { at: minutesAgoIso(7), actor: 'System', action: 'External sync completed', detail: 'Billing API — 42 records pulled', icon: 'sync' },
      { at: minutesAgoIso(52), actor: 'System', action: 'File sync completed', detail: 'Payroll Export — 36 records validated', icon: 'sync' },
      { at: minutesAgoIso(137), actor: 'System', action: 'Source unreachable', detail: 'CRM Mirror — serving last synced snapshot', icon: 'alert' },
      { at: minutesAgoIso(180), actor: 'A. Mendoza', action: 'Module activated', detail: 'Payroll Export — sidebar entry and routing live', icon: 'module' },
      { at: minutesAgoIso(320), actor: 'A. Mendoza', action: 'Validation rule updated', detail: 'IMS — warehouse allowed values', icon: 'rule' },
      { at: minutesAgoIso(1400), actor: 'System', action: 'Backup completed', detail: 'Scheduled backup BKP-2026-0902-0200', icon: 'backup' },
      { at: minutesAgoIso(2600), actor: 'Bea Alonzo', action: 'Module registered', detail: 'CRM Mirror — database adapter, real-time', icon: 'module' }
    ];
  }

  function seedBackups() {
    return {
      config: { schedule: 'daily', time: '02:00', retentionDays: 14, destination: 's3://ifixz-central-db/backups' },
      items: [
        { id: 'BKP-2026-0902-0200', createdAt: daysAgoIso(2, 2), trigger: 'scheduled', sizeMb: 412, durationSec: 96, records: 1243, status: 'verified' },
        { id: 'BKP-2026-0901-0200', createdAt: daysAgoIso(3, 2), trigger: 'scheduled', sizeMb: 408, durationSec: 94, records: 1218, status: 'verified' },
        { id: 'BKP-2026-0831-1810', createdAt: daysAgoIso(4, 18), trigger: 'manual', sizeMb: 401, durationSec: 91, records: 1196, status: 'verified' },
        { id: 'BKP-2026-0830-0200', createdAt: daysAgoIso(5, 2), trigger: 'scheduled', sizeMb: 396, durationSec: 90, records: 1172, status: 'verified' }
      ]
    };
  }

  function seedMovements(ims) {
    if (!ims || !ims.records || !ims.records.length) return [];
    var types = ['receive', 'issue', 'issue', 'receive', 'adjust', 'issue', 'transfer', 'receive'];
    var actors = ['A. Mendoza', 'R. Dela Cruz', 'J. Uy', 'C. Ramos', 'P. Lim'];
    var notes = ['Cycle count correction', 'Damage write-off', 'Packaging shrinkage found in count', 'Found in overflow bay'];
    var count = 46;
    var out = [];
    for (var i = 0; i < count; i++) {
      var rec = ims.records[intBetween(0, ims.records.length - 1)];
      var type = pick(types);
      var onHand = Number(rec.qty);
      if (isNaN(onHand)) onHand = 0;
      if ((type === 'issue' || type === 'transfer') && onHand < 3) type = 'receive';
      var qty = intBetween(2, 48);
      if (type === 'issue' || type === 'transfer') qty = Math.min(qty, Math.max(1, onHand));
      var delta = type === 'receive' ? qty
        : type === 'issue' ? -qty
          : type === 'adjust' ? (rnd() < 0.5 ? -1 : 1) * intBetween(1, 9)
            : -qty;
      var to = '';
      if (type === 'transfer') {
        var others = WAREHOUSES.filter(function (w) { return w !== rec.warehouse; });
        to = pick(others);
      }
      out.push({
        id: 'MOV-' + ('0000' + (count - i)).slice(-4),
        moduleId: 'ims',
        type: type,
        sku: rec.sku,
        itemName: rec.itemName,
        warehouse: rec.warehouse,
        toWarehouse: to,
        qty: Math.abs(delta),
        delta: delta,
        ref: type === 'receive' ? 'PO-' + intBetween(8800, 8899)
          : type === 'issue' ? 'SO-' + intBetween(90210, 90999)
            : type === 'adjust' ? 'CC-' + intBetween(100, 499)
              : 'TRF-' + intBetween(200, 699),
        note: type === 'adjust' ? pick(notes) : '',
        actor: pick(actors),
        at: minutesAgoIso(i * 47 + intBetween(0, 30))
      });
    }
    return out;
  }

  function initialState() {
    var modules = seededModules();
    var ims = null;
    for (var i = 0; i < modules.length; i++) if (modules[i].id === 'ims') ims = modules[i];
    return {
      version: 1,
      builtAt: isoOf(new Date()),
      role: 'org_admin',
      hideExtras: true,
      modules: modules,
      rejected: seedRejected(),
      runs: seedRuns(),
      activity: seedActivity(),
      backups: seedBackups(),
      movements: seedMovements(ims),
      inbound: []
    };
  }

  /* -------------------------------------------------------------- validate -- */

  function isBlank(v) { return v === null || v === undefined || String(v).trim() === ''; }

  function numeric(v) {
    if (typeof v === 'number') return isNaN(v) ? NaN : v;
    if (isBlank(v)) return NaN;
    var n = Number(String(v).replace(/[,\s]/g, ''));
    return isNaN(n) ? NaN : n;
  }

  function compositeKey(record, rule) {
    var key = record[rule.field];
    if (rule.params && rule.params.scope) key = String(key) + '|' + String(record[rule.params.scope]);
    return String(key);
  }

  function validateRecord(mod, record) {
    var reasons = [];
    for (var i = 0; i < mod.rules.length; i++) {
      var rule = mod.rules[i];
      if (!rule.enabled) continue;
      var raw = record[rule.field];
      var blank = isBlank(raw);
      var text = blank ? '(empty)' : String(raw);

      if (rule.type === 'required') {
        if (blank) reasons.push({ ruleId: rule.id, field: rule.field, message: rule.label, value: '(empty)' });
        continue;
      }
      if (blank) continue;

      if (rule.type === 'numeric') {
        var n = numeric(raw);
        var min = rule.params && rule.params.min !== undefined ? rule.params.min : null;
        var max = rule.params && rule.params.max !== undefined ? rule.params.max : null;
        if (isNaN(n)) reasons.push({ ruleId: rule.id, field: rule.field, message: rule.label, value: text });
        else if (min !== null && n < min) reasons.push({ ruleId: rule.id, field: rule.field, message: rule.label, value: text });
        else if (max !== null && n > max) reasons.push({ ruleId: rule.id, field: rule.field, message: rule.label, value: text });
      } else if (rule.type === 'allowed') {
        var values = (rule.params && rule.params.values) || [];
        if (values.indexOf(String(raw)) === -1) reasons.push({ ruleId: rule.id, field: rule.field, message: rule.label, value: text });
      } else if (rule.type === 'duplicate') {
        var key = compositeKey(record, rule);
        var clash = null;
        for (var j = 0; j < mod.records.length; j++) {
          if (compositeKey(mod.records[j], rule) === key) { clash = mod.records[j]; break; }
        }
        if (clash) reasons.push({ ruleId: rule.id, field: rule.field, message: rule.label + ' (existing record ' + clash.id + ')', value: text });
      } else if (rule.type === 'format') {
        var kind = rule.params && rule.params.kind;
        var bad = false;
        if (kind === 'email') bad = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(raw));
        else if (kind === 'period') bad = !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(raw));
        else if (kind === 'date') bad = isNaN(new Date(String(raw)).getTime());
        if (bad) reasons.push({ ruleId: rule.id, field: rule.field, message: rule.label, value: text });
      }
    }
    return reasons;
  }

  /* -------------------------------------------------------------- selectors -- */

  function moduleById(state, id) {
    for (var i = 0; i < state.modules.length; i++) if (state.modules[i].id === id) return state.modules[i];
    return null;
  }

  function matchesExtras(record, params) {
    if (!params) return true;
    if (params.status && record.status !== params.status) return false;
    if (params.notStatus && record.status === params.notStatus) return false;
    return true;
  }

  function computeMetric(mod, metric) {
    var rows = mod.records;
    var i, n, total = 0, count = 0;
    var seen = {};
    var params = metric.params || {};
    switch (metric.type) {
      case 'count':
        return rows.length;
      case 'countWhere':
        for (i = 0; i < rows.length; i++) {
          if (params.values.indexOf(String(rows[i][metric.field])) !== -1) count++;
        }
        return count;
      case 'countWhereNot':
        for (i = 0; i < rows.length; i++) {
          if (params.values.indexOf(String(rows[i][metric.field])) === -1) count++;
        }
        return count;
      case 'sum':
        for (i = 0; i < rows.length; i++) {
          if (!matchesExtras(rows[i], params)) continue;
          n = numeric(rows[i][metric.field]);
          if (!isNaN(n)) total += n;
        }
        return total;
      case 'sumWhere':
        for (i = 0; i < rows.length; i++) {
          if (!matchesExtras(rows[i], params)) continue;
          n = numeric(rows[i][metric.field]);
          if (!isNaN(n)) total += n;
        }
        return total;
      case 'sumWhereNot':
        for (i = 0; i < rows.length; i++) {
          if (params.values.indexOf(String(rows[i][metric.field])) !== -1) continue;
          n = numeric(rows[i][metric.field]);
          if (!isNaN(n)) total += n;
        }
        return total;
      case 'sumProduct':
        for (i = 0; i < rows.length; i++) {
          n = numeric(rows[i][metric.field]) * numeric(rows[i][metric.field2]);
          if (!isNaN(n)) total += n;
        }
        return total;
      case 'avg':
        for (i = 0; i < rows.length; i++) {
          if (!matchesExtras(rows[i], params)) continue;
          n = numeric(rows[i][metric.field]);
          if (!isNaN(n)) { total += n; count++; }
        }
        return count ? total / count : 0;
      case 'distinct':
        for (i = 0; i < rows.length; i++) seen[String(rows[i][metric.field])] = true;
        return Object.keys(seen).length;
      default:
        return 0;
    }
  }

  function computeTrend(mod) {
    var cfg = mod.dashboard.trend;
    var buckets = [];
    var i, k;
    if (cfg.bucket === 'period') {
      var keys = {};
      for (i = 0; i < mod.records.length; i++) keys[String(mod.records[i][cfg.field])] = true;
      var all = Object.keys(keys).sort();
      all = all.slice(Math.max(0, all.length - (cfg.count || 6)));
      for (i = 0; i < all.length; i++) buckets.push({ key: all[i], label: all[i], value: 0 });
      for (i = 0; i < mod.records.length; i++) {
        var rec = mod.records[i];
        for (k = 0; k < all.length; k++) {
          if (all[k] === String(rec[cfg.field])) {
            buckets[k].value += cfg.type === 'sum' ? (isNaN(numeric(rec[cfg.field])) ? 0 : numeric(rec[cfg.field])) : 1;
            break;
          }
        }
      }
      return buckets;
    }
    var days = cfg.days || 14;
    var start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    for (i = 0; i < days; i++) {
      var d = new Date(start.getTime());
      d.setDate(start.getDate() + i);
      buckets.push({ key: dayKeyOf(d), label: MONTHS[d.getMonth()] + ' ' + d.getDate(), value: 0 });
    }
    for (i = 0; i < mod.records.length; i++) {
      var row = mod.records[i];
      var when = new Date(row[cfg.field]);
      if (isNaN(when.getTime())) continue;
      var key = dayKeyOf(when);
      for (k = 0; k < buckets.length; k++) {
        if (buckets[k].key === key) {
          buckets[k].value += cfg.type === 'sum' ? (isNaN(numeric(row[cfg.field])) ? 0 : numeric(row[cfg.field])) : 1;
          break;
        }
      }
    }
    return buckets;
  }

  function computeGroup(mod) {
    var cfg = mod.dashboard.group;
    var map = {};
    var order = [];
    for (var i = 0; i < mod.records.length; i++) {
      var row = mod.records[i];
      var label = String(row[cfg.field]);
      if (map[label] === undefined) { map[label] = 0; order.push(label); }
      map[label] += cfg.type === 'sum' ? (isNaN(numeric(row[cfg.valueField])) ? 0 : numeric(row[cfg.valueField])) : 1;
    }
    var out = order.map(function (label) { return { label: label, value: map[label] }; });
    out.sort(function (a, b) { return b.value - a.value; });
    return out;
  }

  var SHARED_METRICS = [
    { key: 'records', label: 'Records in central database', unit: 'records', note: 'Validated records from every active module' },
    { key: 'revenue', label: 'Billed & invoiced value', unit: '', note: 'Sales Operation (excl. cancelled) + Billing API (excl. draft)' },
    { key: 'openWork', label: 'Open work items', unit: 'items', note: 'Open sales orders + open support tickets' },
    { key: 'payroll', label: 'Gross payroll (all synced periods)', unit: '', note: 'Payroll Export file sync' },
    { key: 'coverage', label: 'Modules reporting', unit: '', note: 'Active modules with a reachable or last-synced source' }
  ];

  function computeShared(state, key) {
    var i, r, s;
    if (key === 'records') {
      var total = 0;
      for (i = 0; i < state.modules.length; i++) if (state.modules[i].status === 'active') total += state.modules[i].records.length;
      return total;
    }
    if (key === 'coverage') {
      var active = 0;
      var reporting = 0;
      for (i = 0; i < state.modules.length; i++) {
        if (state.modules[i].status !== 'active') continue;
        active++;
        if (state.modules[i].source.state === 'up' || state.modules[i].records.length) reporting++;
      }
      return reporting + '/' + active;
    }
    var sum = 0;
    if (key === 'revenue') {
      var sales = moduleById(state, 'sales-operation');
      if (sales && sales.status === 'active') {
        for (r = 0; r < sales.records.length; r++) {
          if (sales.records[r].status === 'Cancelled') continue;
          var sv = numeric(sales.records[r].amount);
          if (!isNaN(sv)) sum += sv;
        }
      }
      var bill = moduleById(state, 'billing-api');
      if (bill && bill.status === 'active') {
        for (r = 0; r < bill.records.length; r++) {
          if (bill.records[r].status === 'Draft') continue;
          var bv = numeric(bill.records[r].amount);
          if (!isNaN(bv)) sum += bv;
        }
      }
      return sum;
    }
    if (key === 'openWork') {
      var so = moduleById(state, 'sales-operation');
      if (so && so.status === 'active') {
        for (r = 0; r < so.records.length; r++) if (String(so.records[r].status) === 'Open') sum++;
      }
      var sd = moduleById(state, 'support-desk');
      if (sd && sd.status === 'active') {
        for (r = 0; r < sd.records.length; r++) {
          var st = String(sd.records[r].status);
          if (st === 'Open' || st === 'Pending') sum++;
        }
      }
      return sum;
    }
    if (key === 'payroll') {
      var pay = moduleById(state, 'payroll-export');
      if (pay && pay.status === 'active') {
        for (r = 0; r < pay.records.length; r++) {
          var g = numeric(pay.records[r].gross);
          if (!isNaN(g)) sum += g;
        }
      }
      return sum;
    }
    for (s = 0; s < state.modules.length; s++) {
      if (state.modules[s].status === 'active') sum += state.modules[s].records.length;
    }
    return sum;
  }

  /* ------------------------------------------------------------------ store -- */

  function Store() {
    this.state = null;
    this.listeners = [];
    this.runSeq = 4471;
  }

  Store.prototype.load = function () {
    var raw = null;
    try { raw = window.localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1 && parsed.modules && parsed.modules.length) {
          this.state = parsed;
          this.applySeedConfig();
          return this.state;
        }
      } catch (e2) { /* fall through to a fresh seed */ }
    }
    this.state = initialState();
    this.persist();
    return this.state;
  };

  /* Saved browser state predates the inventory features — refresh seed-owned
     dashboard config (panels, metrics) and backfill the IMS inventory fields
     so older sessions gain stock health and the ledger without discarding
     runs, rules or registrations. */
  Store.prototype.applySeedConfig = function () {
    var seeds = seededModules();
    var byId = {};
    var i;
    for (i = 0; i < seeds.length; i++) byId[seeds[i].id] = seeds[i];
    for (i = 0; i < this.state.modules.length; i++) {
      var mod = this.state.modules[i];
      var seed = byId[mod.id];
      if (!seed || !seed.dashboard) continue;
      if (!mod.dashboard) mod.dashboard = {};
      if (seed.dashboard.panels) mod.dashboard.panels = seed.dashboard.panels;
      if (seed.dashboard.metrics) mod.dashboard.metrics = seed.dashboard.metrics;
    }
    /* V2 one-time pass: hide the four extra modules so the workspace starts
       with IMS and Sales only. Runs once — a module re-activated later from
       the registry keeps its status across reloads. Records are untouched. */
    if (!this.state.hideExtras) {
      var extras = ['billing-api', 'support-desk', 'payroll-export', 'crm-mirror'];
      for (i = 0; i < this.state.modules.length; i++) {
        if (extras.indexOf(this.state.modules[i].id) !== -1) this.state.modules[i].status = 'inactive';
      }
      this.state.hideExtras = true;
      this.persist();
    }
    this.migrateIms();
  };

  /* Additive IMS inventory migration: schema field, validation rule, per-record
     reorder points and the movement ledger — never removes existing data. */
  Store.prototype.migrateIms = function () {
    var mod = moduleById(this.state, 'ims');
    if (!mod) return;
    var f;
    var hasField = false;
    for (f = 0; f < mod.schema.length; f++) if (mod.schema[f].key === 'reorderPoint') { hasField = true; break; }
    if (!hasField) {
      var insertAt = mod.schema.length;
      for (f = 0; f < mod.schema.length; f++) if (mod.schema[f].key === 'qty') { insertAt = f + 1; break; }
      mod.schema.splice(insertAt, 0, { key: 'reorderPoint', label: 'Reorder point', type: 'number', required: true });
    }
    var hasRule = false;
    for (f = 0; f < mod.rules.length; f++) if (mod.rules[f].id === 'ims-r8') { hasRule = true; break; }
    if (!hasRule) {
      mod.rules.push({ id: 'ims-r8', field: 'reorderPoint', type: 'numeric', label: 'Reorder point must be a number of at least 0', enabled: true, params: { min: 0 } });
    }
    for (f = 0; f < mod.records.length; f++) {
      var rec = mod.records[f];
      if (rec.reorderPoint === undefined || rec.reorderPoint === null || rec.reorderPoint === '') {
        rec.reorderPoint = 12 + (f % 24);
      }
    }
    if (!this.state.movements) this.state.movements = seedMovements(mod);
  };

  Store.prototype.persist = function () {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch (e) { /* sample data stays in memory */ }
  };

  Store.prototype.subscribe = function (fn) {
    this.listeners.push(fn);
    var self = this;
    return function () {
      var idx = self.listeners.indexOf(fn);
      if (idx !== -1) self.listeners.splice(idx, 1);
    };
  };

  Store.prototype.emit = function (detail) {
    this.persist();
    for (var i = 0; i < this.listeners.length; i++) this.listeners[i](detail || {});
  };

  Store.prototype.reset = function () {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    this.state = initialState();
    this.emit({ type: 'reset' });
  };

  Store.prototype.module = function (id) { return moduleById(this.state, id); };
  Store.prototype.modules = function () { return this.state.modules; };

  Store.prototype.activeModules = function () {
    var out = [];
    for (var i = 0; i < this.state.modules.length; i++) if (this.state.modules[i].status === 'active') out.push(this.state.modules[i]);
    return out;
  };

  Store.prototype.role = function () { return ROLES[this.state.role] || ROLES.org_admin; };
  Store.prototype.can = function (perm) { return !!this.role().perms[perm]; };

  Store.prototype.setRole = function (roleId) {
    if (!ROLES[roleId]) return;
    this.state.role = roleId;
    this.log('Role switched', ROLES[roleId].person.name + ' signed in as ' + ROLES[roleId].label, 'user');
    this.emit({ type: 'role' });
  };

  Store.prototype.log = function (action, detail, icon) {
    this.state.activity.unshift({ at: isoOf(new Date()), actor: this.role().person.name, action: action, detail: detail, icon: icon || 'module' });
    if (this.state.activity.length > 30) this.state.activity.length = 30;
  };

  /* ---- rules ---- */

  Store.prototype.toggleRule = function (moduleId, ruleId, enabled) {
    var mod = this.module(moduleId);
    if (!mod) return;
    for (var i = 0; i < mod.rules.length; i++) {
      if (mod.rules[i].id === ruleId) {
        mod.rules[i].enabled = enabled;
        this.log('Validation rule ' + (enabled ? 'enabled' : 'disabled'), mod.name + ' — ' + mod.rules[i].label, 'rule');
        this.emit({ type: 'rules' });
        return;
      }
    }
  };

  Store.prototype.addRule = function (moduleId, rule) {
    var mod = this.module(moduleId);
    if (!mod) return null;
    var created = {
      id: 'r-' + mod.id + '-' + (mod.rules.length + 1) + '-' + Math.floor(Math.random() * 900 + 100),
      field: rule.field,
      type: rule.type,
      label: rule.label,
      enabled: true,
      params: rule.params || {}
    };
    mod.rules.push(created);
    this.log('Validation rule added', mod.name + ' — ' + created.label, 'rule');
    this.emit({ type: 'rules' });
    return created;
  };

  Store.prototype.removeRule = function (moduleId, ruleId) {
    var mod = this.module(moduleId);
    if (!mod) return;
    for (var i = 0; i < mod.rules.length; i++) {
      if (mod.rules[i].id === ruleId) {
        var label = mod.rules[i].label;
        mod.rules.splice(i, 1);
        this.log('Validation rule removed', mod.name + ' — ' + label, 'rule');
        this.emit({ type: 'rules' });
        return;
      }
    }
  };

  /* ---- pipeline ---- */

  function nextRejectedId(state) {
    var max = 0;
    for (var i = 0; i < state.rejected.length; i++) {
      var n = parseInt(String(state.rejected[i].id).replace('REJ-', ''), 10);
      if (!isNaN(n) && n > max) max = n;
    }
    return 'REJ-' + (max + 1);
  }

  function buildInbound(mod, source, count) {
    var rows = [];
    var base = Date.now();
    for (var i = 0; i < count; i++) {
      var row = { _source: source };
      for (var f = 0; f < mod.schema.length; f++) {
        var field = mod.schema[f];
        if (field.type === 'number') row[field.key] = intBetween(20, 900);
        else if (field.type === 'enum') row[field.key] = pick(field.options);
        else if (field.type === 'email') row[field.key] = pick(CONTACTS);
        else if (field.type === 'date') row[field.key] = new Date(base - i * 3600 * 1000).toISOString();
        else if (field.key === 'sku') row[field.key] = 'SKU-' + intBetween(1041, 1099);
        else if (field.key === 'orderRef') row[field.key] = 'SO-' + intBetween(91000, 91999);
        else if (field.key === 'invoiceNo') row[field.key] = 'INV-2026-' + intBetween(200, 999);
        else if (field.key === 'ticketId') row[field.key] = 'TKT-' + intBetween(5000, 5999);
        else if (field.key === 'accountId') row[field.key] = 'ACC-' + intBetween(8000, 8999);
        else if (field.key === 'requestNo') row[field.key] = 'REQ-' + intBetween(7000, 7999);
        else if (field.key === 'assetTag') row[field.key] = 'AST-' + intBetween(3000, 3999);
        else if (field.key === 'employeeId') row[field.key] = 'EMP-' + intBetween(113, 199);
        else if (field.key === 'period') row[field.key] = periodOf(new Date());
        else if (field.key === 'itemName') row[field.key] = pick(ITEMS)[1];
        else if (field.key === 'description') row[field.key] = 'Asset captured by registry sync';
        else if (field.key === 'subject') row[field.key] = 'Follow-up from workspace sync';
        else if (field.key === 'customer' || field.key === 'requester' || field.key === 'account') row[field.key] = pick(COMPANIES);
        else if (field.key === 'employee') row[field.key] = 'New hire ' + intBetween(1, 40);
        else row[field.key] = 'Sample value ' + intBetween(100, 999);
      }
      if (maybe(0.14)) {
        var target = pick(mod.schema);
        var defect = intBetween(1, 3);
        if (defect === 1) row[target.key] = '';
        else if (defect === 2) {
          row[target.key] = target.type === 'enum' ? 'Unlisted ' + intBetween(10, 99)
            : target.type === 'number' ? -intBetween(1, 40)
              : 'not-a-value';
        } else if (target.type === 'number') row[target.key] = 'n/a';
      }
      rows.push(row);
    }
    return rows;
  }

  Store.prototype.runPipeline = function (opts) {
    var mod = this.module(opts.moduleId);
    if (!mod) return null;
    if (mod.kind === 'external' && mod.source.state === 'down' && opts.source === 'sync') {
      return {
        blocked: true,
        moduleId: mod.id,
        message: 'Source system unreachable — nothing pulled. The dashboard keeps serving the last synced snapshot.'
      };
    }
    var count = opts.source === 'bulk' ? intBetween(24, 48) : intBetween(10, 26);
    var inbound = buildInbound(mod, opts.source, count);
    var passed = [];
    var failed = [];
    var started = Date.now();
    var firstKey = mod.schema.length ? mod.schema[0].key : 'id';

    for (var i = 0; i < inbound.length; i++) {
      var row = inbound[i];
      var reasons = validateRecord(mod, row);
      if (reasons.length === 0) {
        row._ingestedAt = isoOf(new Date());
        row.id = String(row[firstKey]) + '-' + (mod.records.length + 1);
        passed.push(row);
      } else {
        failed.push({
          id: nextRejectedId(this.state),
          moduleId: mod.id,
          source: opts.source,
          receivedAt: isoOf(new Date()),
          payload: row,
          reasons: reasons
        });
      }
    }
    for (var p = 0; p < passed.length; p++) mod.records.push(passed[p]);
    this.state.rejected = failed.concat(this.state.rejected);

    var durationMs = Math.max(180, Date.now() - started) + intBetween(120, 900);
    this.runSeq += 1;
    var run = {
      id: 'RUN-' + this.runSeq,
      moduleId: mod.id,
      source: opts.source,
      ingested: inbound.length,
      passed: passed.length,
      rejected: failed.length,
      durationMs: durationMs,
      at: isoOf(new Date()),
      actor: opts.source === 'sync' ? 'system' : this.role().person.name
    };
    this.state.runs.unshift(run);
    if (this.state.runs.length > 24) this.state.runs.length = 24;
    if (mod.kind === 'external') mod.source.lastSyncedAt = run.at;
    this.log(
      'Pipeline run completed',
      mod.name + ' — ' + run.ingested + ' ingested, ' + run.passed + ' passed, ' + run.rejected + ' rejected',
      opts.source === 'sync' ? 'sync' : 'pipeline'
    );
    this.emit({ type: 'pipeline', run: run, failed: failed });
    return { blocked: false, run: run, failed: failed, passedCount: passed.length };
  };

  Store.prototype.queueRecord = function (moduleId, payload) {
    this.state.inbound.push({ moduleId: moduleId, payload: payload, queuedAt: isoOf(new Date()) });
    this.emit({ type: 'inbound' });
    var n = 0;
    for (var i = 0; i < this.state.inbound.length; i++) if (this.state.inbound[i].moduleId === moduleId) n++;
    return n;
  };

  Store.prototype.queued = function (moduleId) {
    var out = [];
    for (var i = 0; i < this.state.inbound.length; i++) if (this.state.inbound[i].moduleId === moduleId) out.push(this.state.inbound[i]);
    return out;
  };

  Store.prototype.runQueued = function (moduleId) {
    var queued = this.queued(moduleId);
    if (!queued.length) return null;
    var mod = this.module(moduleId);
    if (!mod) return null;
    var passed = 0;
    var failed = 0;
    var firstKey = mod.schema.length ? mod.schema[0].key : 'id';
    var remaining = [];
    for (var i = 0; i < queued.length; i++) {
      var row = queued[i].payload;
      var reasons = validateRecord(mod, row);
      if (reasons.length === 0) {
        row._source = 'native';
        row._ingestedAt = isoOf(new Date());
        row.id = String(row[firstKey]) + '-' + (mod.records.length + 1);
        mod.records.push(row);
        passed++;
      } else {
        this.state.rejected.push({
          id: nextRejectedId(this.state),
          moduleId: moduleId,
          source: 'native',
          receivedAt: isoOf(new Date()),
          payload: row,
          reasons: reasons
        });
        failed++;
      }
    }
    this.state.inbound = this.state.inbound.filter(function (item) { return item.moduleId !== moduleId; });
    var remainingQueued = 0;
    for (var k = 0; k < this.state.inbound.length; k++) if (this.state.inbound[k].moduleId === moduleId) remainingQueued++;
    this.runSeq += 1;
    var run = {
      id: 'RUN-' + this.runSeq,
      moduleId: moduleId,
      source: 'native',
      ingested: queued.length,
      passed: passed,
      rejected: failed,
      durationMs: 220 + queued.length * 7,
      at: isoOf(new Date()),
      actor: this.role().person.name
    };
    this.state.runs.unshift(run);
    this.log('Pipeline run completed', mod.name + ' — ' + run.ingested + ' queued records validated, ' + passed + ' passed', 'pipeline');
    this.emit({ type: 'pipeline', run: run, failed: [] });
    return { run: run, remaining: remainingQueued };
  };

  Store.prototype.retryRejected = function (rejectedId) {
    for (var i = 0; i < this.state.rejected.length; i++) {
      var row = this.state.rejected[i];
      if (row.id !== rejectedId) continue;
      var mod = this.module(row.moduleId);
      if (!mod) return { ok: false };
      var reasons = validateRecord(mod, row.payload);
      if (reasons.length === 0) {
        row.payload._ingestedAt = isoOf(new Date());
        var firstKey = mod.schema.length ? mod.schema[0].key : 'id';
        row.payload.id = String(row.payload[firstKey]) + '-' + (mod.records.length + 1);
        mod.records.push(row.payload);
        this.state.rejected.splice(i, 1);
        this.log('Rejected record accepted', mod.name + ' — ' + row.id + ' passed on re-validation', 'pipeline');
        this.emit({ type: 'rejected' });
        return { ok: true, accepted: true };
      }
      row.reasons = reasons;
      this.emit({ type: 'rejected' });
      return { ok: true, accepted: false, reasons: reasons };
    }
    return { ok: false };
  };

  Store.prototype.discardRejected = function (rejectedId) {
    for (var i = 0; i < this.state.rejected.length; i++) {
      if (this.state.rejected[i].id === rejectedId) {
        var mod = this.module(this.state.rejected[i].moduleId);
        this.state.rejected.splice(i, 1);
        this.log('Rejected record discarded', (mod ? mod.name : 'Module') + ' — ' + rejectedId, 'alert');
        this.emit({ type: 'rejected' });
        return true;
      }
    }
    return false;
  };

  /* ---- registry ---- */

  Store.prototype.registerModule = function (manifest) {
    var record = {
      id: manifest.key,
      name: manifest.name,
      key: manifest.key,
      kind: manifest.kind,
      owner: manifest.owner,
      version: '1.0.0',
      description: manifest.description,
      status: 'active',
      createdAt: isoOf(new Date()),
      adapter: {
        type: manifest.adapterType,
        syncMode: manifest.syncMode,
        interval: manifest.syncMode === 'realtime' ? 'Real-time where supported' : manifest.interval,
        connection: manifest.connection || {},
        mapping: manifest.mapping || {}
      },
      schema: manifest.schema,
      rules: manifest.rules,
      dashboard: manifest.dashboard,
      sharedMetrics: ['records'],
      permissions: { user: manifest.kind === 'native' ? ['view', 'input'] : ['view'], admin: ['*'] },
      routes: { dashboard: '#/module/' + manifest.key, records: '#/module/' + manifest.key + '/records' },
      events: ['record.rejected', 'module.sync', 'module.registered'],
      source: { state: 'up', lastSyncedAt: isoOf(new Date()) },
      records: []
    };
    this.state.modules.push(record);
    this.log(
      'Module registered and activated',
      record.name + ' — ' + (manifest.kind === 'native' ? 'native module' : ADAPTERS[manifest.adapterType].label + ' adapter') + ', ' + manifest.syncMode,
      'module'
    );
    this.emit({ type: 'registry', moduleId: record.id });
    return record;
  };

  Store.prototype.keyExists = function (key) {
    for (var i = 0; i < this.state.modules.length; i++) if (this.state.modules[i].key === key) return true;
    return false;
  };

  Store.prototype.setModuleStatus = function (moduleId, status) {
    var mod = this.module(moduleId);
    if (!mod) return;
    mod.status = status;
    this.log(
      'Module ' + (status === 'active' ? 'activated' : 'disabled'),
      mod.name + ' — sidebar entry, routing and permissions updated without a deployment',
      'module'
    );
    this.emit({ type: 'registry', moduleId: moduleId });
  };

  Store.prototype.setSourceState = function (moduleId, sourceState) {
    var mod = this.module(moduleId);
    if (!mod) return;
    mod.source.state = sourceState;
    if (sourceState === 'down') {
      this.log('Source unreachable', mod.name + ' — serving the last synced snapshot', 'alert');
    } else {
      mod.source.lastSyncedAt = isoOf(new Date());
      this.log('Source reachable again', mod.name + ' — sync resumed', 'sync');
    }
    this.emit({ type: 'source', moduleId: moduleId });
  };

  /* ---- backups ---- */

  Store.prototype.saveBackupConfig = function (patch) {
    var cfg = this.state.backups.config;
    for (var key in patch) if (Object.prototype.hasOwnProperty.call(patch, key)) cfg[key] = patch[key];
    this.log('Backup schedule updated', cfg.schedule + ' at ' + cfg.time + ', retention ' + cfg.retentionDays + ' days', 'backup');
    this.emit({ type: 'backup' });
    return cfg;
  };

  Store.prototype.nextBackupAt = function () {
    var cfg = this.state.backups.config;
    var now = new Date();
    var parts = String(cfg.time).split(':');
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(parts[0]) || 2, Number(parts[1]) || 0, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
    if (cfg.schedule === 'weekly') {
      var add = (7 - next.getDay()) % 7;
      next.setDate(next.getDate() + (add === 0 ? 7 : add));
    }
    return isoOf(next);
  };

  Store.prototype.runBackupNow = function () {
    var stamp = isoOf(new Date());
    var records = 0;
    for (var i = 0; i < this.state.modules.length; i++) records += this.state.modules[i].records.length;
    var item = {
      id: 'BKP-' + stamp.slice(0, 10).replace(/-/g, '') + '-' + stamp.slice(11, 13) + stamp.slice(14, 16),
      createdAt: stamp,
      trigger: 'manual',
      sizeMb: 400 + Math.round(records / 12),
      durationSec: 90 + Math.round(records / 90),
      records: records,
      status: 'verified'
    };
    this.state.backups.items.unshift(item);
    this.log('Manual backup completed', item.id + ' — ' + item.records + ' records captured', 'backup');
    this.emit({ type: 'backup' });
    return item;
  };

  Store.prototype.restoreBackup = function (backupId) {
    var item = null;
    for (var i = 0; i < this.state.backups.items.length; i++) if (this.state.backups.items[i].id === backupId) item = this.state.backups.items[i];
    if (!item) return null;
    this.log('Database restored', item.id + ' — central database rolled back to this snapshot', 'backup');
    this.emit({ type: 'backup' });
    return item;
  };

  /* ---- selectors for views ---- */

  Store.prototype.metricValue = function (moduleId, metricKey) {
    var mod = this.module(moduleId);
    if (!mod) return 0;
    for (var i = 0; i < mod.dashboard.metrics.length; i++) {
      if (mod.dashboard.metrics[i].key === metricKey) return computeMetric(mod, mod.dashboard.metrics[i]);
    }
    return 0;
  };

  Store.prototype.trend = function (moduleId) {
    var mod = this.module(moduleId);
    return mod ? computeTrend(mod) : [];
  };

  Store.prototype.group = function (moduleId) {
    var mod = this.module(moduleId);
    return mod ? computeGroup(mod) : [];
  };

  Store.prototype.sharedMetrics = function () {
    var self = this;
    var out = [];
    for (var i = 0; i < SHARED_METRICS.length; i++) {
      out.push({
        key: SHARED_METRICS[i].key,
        label: SHARED_METRICS[i].label,
        note: SHARED_METRICS[i].note,
        unit: SHARED_METRICS[i].unit,
        value: computeShared(self.state, SHARED_METRICS[i].key)
      });
    }
    return out;
  };

  Store.prototype.rejectedFor = function (moduleId) {
    var out = [];
    for (var i = 0; i < this.state.rejected.length; i++) {
      if (this.state.rejected[i].moduleId === moduleId) out.push(this.state.rejected[i]);
    }
    return out;
  };

  Store.prototype.passRate = function () {
    var ingested = 0;
    var rejected = 0;
    for (var i = 0; i < this.state.runs.length; i++) {
      ingested += this.state.runs[i].ingested;
      rejected += this.state.runs[i].rejected;
    }
    if (!ingested) return 100;
    return Math.round(((ingested - rejected) / ingested) * 1000) / 10;
  };

  Store.prototype.ruleFailureCounts = function () {
    var map = {};
    for (var i = 0; i < this.state.rejected.length; i++) {
      var reasons = this.state.rejected[i].reasons;
      for (var r = 0; r < reasons.length; r++) map[reasons[r].ruleId] = (map[reasons[r].ruleId] || 0) + 1;
    }
    return map;
  };

  Store.prototype.recordCount = function () {
    var total = 0;
    for (var i = 0; i < this.state.modules.length; i++) total += this.state.modules[i].records.length;
    return total;
  };

  Store.prototype.staleModules = function () {
    var out = [];
    for (var i = 0; i < this.state.modules.length; i++) {
      if (this.state.modules[i].status === 'active' && this.state.modules[i].source.state === 'down') out.push(this.state.modules[i]);
    }
    return out;
  };

  Store.prototype.buildRulesFor = function (schema) {
    var rules = [];
    for (var i = 0; i < schema.length; i++) {
      var field = schema[i];
      if (field.required && field.type !== 'enum') {
        rules.push({ id: 'gen-' + field.key + '-req', field: field.key, type: 'required', label: field.label + ' is required', enabled: true, params: {} });
      }
      if (field.type === 'enum') {
        rules.push({ id: 'gen-' + field.key + '-allow', field: field.key, type: 'allowed', label: field.label + ' must be one of ' + field.options.join(', '), enabled: true, params: { values: field.options.slice() } });
      }
      if (field.type === 'number') {
        rules.push({ id: 'gen-' + field.key + '-num', field: field.key, type: 'numeric', label: field.label + ' must be a number of at least 0', enabled: true, params: { min: 0 } });
      }
      if (field.type === 'date') {
        rules.push({ id: 'gen-' + field.key + '-date', field: field.key, type: 'format', label: field.label + ' must be a valid date', enabled: true, params: { kind: 'date' } });
      }
      if (field.type === 'email') {
        rules.push({ id: 'gen-' + field.key + '-mail', field: field.key, type: 'format', label: field.label + ' must be a valid address', enabled: true, params: { kind: 'email' } });
      }
    }
    var idField = schema[0];
    if (idField) {
      rules.unshift({
        id: 'gen-dup', field: idField.key, type: 'duplicate',
        label: idField.label + ' must be unique in the central database', enabled: true, params: {}
      });
    }
    return rules;
  };

  /* ---- inventory (IMS stock operations) ---- */

  Store.prototype.stockStatus = function (record) {
    var q = numeric(record.qty);
    if (isNaN(q) || q <= 0) return 'out';
    var rp = numeric(record.reorderPoint);
    if (!isNaN(rp) && q < rp) return 'low';
    return 'ok';
  };

  Store.prototype.stockHealth = function (moduleId) {
    var mod = this.module(moduleId);
    var out = { out: 0, low: 0, ok: 0, total: 0 };
    if (!mod) return out;
    for (var i = 0; i < mod.records.length; i++) {
      out.total++;
      out[this.stockStatus(mod.records[i])]++;
    }
    return out;
  };

  Store.prototype.movementsFor = function (moduleId, limit) {
    var out = [];
    var list = this.state.movements || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].moduleId === moduleId) {
        out.push(list[i]);
        if (limit && out.length >= limit) break;
      }
    }
    return out;
  };

  /* Apply one stock movement to a validated stock line. Returns { ok:false,
     field, message } with a cause-and-remedy message, or { ok:true, movement,
     record, delta }. Never drives on hand below zero. */
  Store.prototype.stockMovement = function (moduleId, opts) {
    opts = opts || {};
    var mod = this.module(moduleId);
    if (!mod) return { ok: false, field: '', message: 'This module is not registered in the central database.' };
    if (!this.can('inputRecords')) {
      return { ok: false, field: '', message: 'Your role cannot change stock. Switch to Organization admin or Department employee from the account menu.' };
    }
    if (!this.state.movements) this.state.movements = [];

    var rec = null;
    var i;
    for (i = 0; i < mod.records.length; i++) if (mod.records[i].id === opts.recordId) { rec = mod.records[i]; break; }
    if (!rec) return { ok: false, field: 'recordId', message: 'Pick the stock line this movement applies to.' };

    var type = opts.type;
    var onHand = numeric(rec.qty);
    if (isNaN(onHand)) onHand = 0;
    var qty = numeric(opts.qty);
    var delta = 0;
    var toWarehouse = '';

    if (type === 'receive') {
      if (isNaN(qty) || Math.floor(qty) !== qty || qty < 1) {
        return { ok: false, field: 'qty', message: 'Quantity received must be a whole number of at least 1. Enter how many units arrived.' };
      }
      rec.qty = onHand + qty;
      delta = qty;
    } else if (type === 'issue') {
      if (isNaN(qty) || Math.floor(qty) !== qty || qty < 1) {
        return { ok: false, field: 'qty', message: 'Quantity issued must be a whole number of at least 1. Enter how many units left the warehouse.' };
      }
      if (qty > onHand) {
        if (onHand <= 0) {
          return { ok: false, field: 'qty', message: rec.sku + ' in ' + rec.warehouse + ' is out of stock. Receive stock before issuing from this line.' };
        }
        return { ok: false, field: 'qty', message: 'Only ' + onHand + ' units are on hand in ' + rec.warehouse + '. Reduce the quantity to ' + onHand + ' or less, or receive stock first.' };
      }
      rec.qty = onHand - qty;
      delta = -qty;
    } else if (type === 'adjust') {
      if (isNaN(qty) || Math.floor(qty) !== qty || qty < 0) {
        return { ok: false, field: 'qty', message: 'Counted quantity must be a whole number of 0 or more. Enter what the physical count found.' };
      }
      if (NS.util.isBlank(opts.note)) {
        return { ok: false, field: 'note', message: 'Add the reason for this adjustment — cycle count, damage or correction — so the ledger explains the change.' };
      }
      rec.qty = qty;
      delta = qty - onHand;
    } else if (type === 'transfer') {
      if (isNaN(qty) || Math.floor(qty) !== qty || qty < 1) {
        return { ok: false, field: 'qty', message: 'Quantity to transfer must be a whole number of at least 1.' };
      }
      if (qty > onHand) {
        return { ok: false, field: 'qty', message: 'Only ' + onHand + ' units are on hand in ' + rec.warehouse + '. Reduce the quantity to ' + onHand + ' or less.' };
      }
      toWarehouse = String(opts.toWarehouse || '');
      if (!toWarehouse) return { ok: false, field: 'toWarehouse', message: 'Pick the warehouse that should receive the stock.' };
      if (toWarehouse === rec.warehouse) {
        return { ok: false, field: 'toWarehouse', message: 'The target warehouse must differ from ' + rec.warehouse + '. Pick another location.' };
      }
      rec.qty = onHand - qty;
      delta = -qty;
    } else {
      return { ok: false, field: '', message: 'Unknown stock movement type.' };
    }

    if (type === 'transfer') {
      var target = null;
      for (i = 0; i < mod.records.length; i++) {
        if (mod.records[i].sku === rec.sku && mod.records[i].warehouse === toWarehouse) { target = mod.records[i]; break; }
      }
      if (target) {
        var targetQty = numeric(target.qty);
        if (isNaN(targetQty)) targetQty = 0;
        target.qty = targetQty + qty;
        target.updatedAt = isoOf(new Date());
      } else {
        var suffix = mod.records.length + 1;
        var newId = 'IMS-' + rec.sku + '-T' + suffix;
        var clash = true;
        while (clash) {
          clash = false;
          for (i = 0; i < mod.records.length; i++) {
            if (mod.records[i].id === newId) { clash = true; break; }
          }
          if (clash) { suffix++; newId = 'IMS-' + rec.sku + '-T' + suffix; }
        }
        var newRp = numeric(rec.reorderPoint);
        if (isNaN(newRp)) newRp = 12;
        mod.records.push({
          id: newId,
          sku: rec.sku,
          itemName: rec.itemName,
          qty: qty,
          reorderPoint: newRp,
          warehouse: toWarehouse,
          unitCost: rec.unitCost,
          updatedAt: isoOf(new Date()),
          _source: 'native',
          _ingestedAt: isoOf(new Date())
        });
      }
    }

    rec.updatedAt = isoOf(new Date());

    var maxN = 0;
    for (i = 0; i < this.state.movements.length; i++) {
      var n = parseInt(String(this.state.movements[i].id).replace('MOV-', ''), 10);
      if (!isNaN(n) && n > maxN) maxN = n;
    }
    var movement = {
      id: 'MOV-' + ('0000' + (maxN + 1)).slice(-4),
      moduleId: mod.id,
      type: type,
      sku: rec.sku,
      itemName: rec.itemName,
      warehouse: rec.warehouse,
      toWarehouse: toWarehouse,
      qty: Math.abs(delta),
      delta: delta,
      ref: String(opts.ref || ''),
      note: String(opts.note || ''),
      actor: this.role().person.name,
      at: isoOf(new Date())
    };
    this.state.movements.unshift(movement);
    if (this.state.movements.length > 300) this.state.movements.length = 300;

    var verb = type === 'receive' ? 'Stock received'
      : type === 'issue' ? 'Stock issued'
        : type === 'adjust' ? 'Stock adjusted'
          : 'Stock transferred';
    var sign = delta > 0 ? '+' : '';
    this.log(
      verb,
      'IMS — ' + movement.sku + ' ' + movement.warehouse +
      (movement.toWarehouse ? ' → ' + movement.toWarehouse : '') + ' ' + sign + delta +
      (movement.ref ? ' · ' + movement.ref : ''),
      type === 'receive' ? 'download' : type === 'issue' ? 'upload' : type === 'adjust' ? 'edit' : 'arrowRight'
    );
    this.emit({ type: 'inventory', movement: movement });
    return { ok: true, movement: movement, record: rec, delta: delta };
  };

  NS.Store = new Store();
  NS.ROLES = ROLES;
  NS.ADAPTERS = ADAPTERS;
  NS.SCHEMA_PRESETS = SCHEMA_PRESETS;
  NS.SHARED_METRICS = SHARED_METRICS;
  NS.util = {
    numeric: numeric,
    isBlank: isBlank,
    validateRecord: validateRecord,
    isoOf: isoOf,
    months: MONTHS
  };
})(window.IFIXZ);