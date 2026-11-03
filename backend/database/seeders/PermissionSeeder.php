<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $roles = Role::pluck('role_id', 'role_name');

        $grants = [
            // ── Super Admin: read everything ──────────────────────
            ['role' => 'super_admin', 'module' => '*', 'action' => 'read', 'scope' => 'all'],

            // ── Department Head ───────────────────────────────────
            ['role' => 'dept_head', 'module' => '*', 'action' => 'read',              'scope' => 'all'],
            ['role' => 'dept_head', 'module' => '*', 'action' => 'register',          'scope' => 'all'],
            ['role' => 'dept_head', 'module' => '*', 'action' => 'activate',          'scope' => 'all'],
            ['role' => 'dept_head', 'module' => '*', 'action' => 'deactivate',        'scope' => 'all'],
            ['role' => 'dept_head', 'module' => '*', 'action' => 'delete',            'scope' => 'all'],
            ['role' => 'dept_head', 'module' => '*', 'action' => 'run_pipeline',      'scope' => 'all'],
            ['role' => 'dept_head', 'module' => '*', 'action' => 'configure_adapter', 'scope' => 'all'],
            ['role' => 'dept_head', 'module' => '*', 'action' => 'create',            'scope' => 'department'],
            ['role' => 'dept_head', 'module' => '*', 'action' => 'update',            'scope' => 'department'],
            ['role' => 'dept_head', 'module' => '*', 'action' => 'archive',           'scope' => 'department'],

            // ── Department Employee ───────────────────────────────
            ['role' => 'employee', 'module' => 'ims',   'action' => 'create',  'scope' => 'own'],
            ['role' => 'employee', 'module' => 'ims',   'action' => 'update',  'scope' => 'own'],
            ['role' => 'employee', 'module' => 'ims',   'action' => 'archive', 'scope' => 'own'],
            ['role' => 'employee', 'module' => 'sales', 'action' => 'create',  'scope' => 'own'],
            ['role' => 'employee', 'module' => 'sales', 'action' => 'update',  'scope' => 'own'],
            ['role' => 'employee', 'module' => 'sales', 'action' => 'archive', 'scope' => 'own'],
            ['role' => 'employee', 'module' => '*',     'action' => 'read',    'scope' => 'department'],
        ];

        foreach ($grants as $g) {
            Permission::firstOrCreate([
                'role_id' => $roles[$g['role']],
                'module_id' => $g['module'],
                'action' => $g['action'],
                'scope' => $g['scope'],
            ]);
        }
    }
}
