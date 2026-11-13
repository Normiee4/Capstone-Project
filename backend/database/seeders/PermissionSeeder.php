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

        // [action, scope]
        $matrix = [
            'super_admin' => [
                ['read',            'all'],
                ['create',          'all'],
                ['update',          'all'],
                ['delete',          'all'],
                ['invite',          'all'],
                ['manage_users',    'all'],
                ['reset_password',  'all'],
            ],
            'dept_head' => [
                ['read',              'all'],
                ['create',            'department'],
                ['update',            'department'],
                ['archive',           'department'],
                ['register',          'all'],
                ['invite',            'department'],
                ['manage_users',      'department'],
                ['activate',          'all'],
                ['deactivate',        'all'],
                ['run_pipeline',      'all'],
                ['configure_adapter', 'all'],
            ],
            'employee' => [
                ['read',    'department'],
                ['create',  'department'],
                ['update',  'department'],
                ['archive', 'department'],
            ],
        ];

        foreach ($matrix as $roleName => $grants) {
            $roleId = $roles[$roleName] ?? null;
            if ($roleId === null) {
                continue;
            }

            Permission::where('role_id', $roleId)->delete();

            foreach ($grants as [$action, $scope]) {
                Permission::create([
                    'role_id' => $roleId,
                    'action'  => $action,
                    'scope'   => $scope,
                ]);
            }
        }
    }
}