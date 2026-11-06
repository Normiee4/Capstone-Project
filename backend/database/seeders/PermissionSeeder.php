<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Support\Action;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $roles = Role::pluck('role_id', 'role_name');

        $matrix = [
            'super_admin' => [
                Action::USERS_VIEW => 'all',
                Action::USERS_INVITE => 'all',
                Action::USERS_CREATE => 'all',
                Action::USERS_UPDATE => 'all',
                Action::USERS_DISABLE => 'all',
                Action::USERS_ARCHIVE => 'all',
                Action::USERS_DELETE => 'all',
                Action::ROLES_ASSIGN => 'all',
                Action::PERMISSIONS_MANAGE => 'all',
                Action::AUDIT_VIEW => 'all',
            ],
            'dept_head' => [
                Action::USERS_VIEW => 'department',
                Action::USERS_INVITE => 'department',
                Action::USERS_UPDATE => 'department',
                Action::USERS_DISABLE => 'department',
                Action::MODULES_MANAGE => 'all',
                Action::PIPELINE_RUN => 'all',
                Action::BACKUPS_MANAGE => 'all',
                Action::MONITORING_VIEW => 'all',
            ],
            'employee' => [
                Action::MONITORING_VIEW => 'department',
                Action::RECORDS_VIEW => 'department',
                Action::RECORDS_CREATE => 'department',
                Action::RECORDS_UPDATE => 'department',
                Action::RECORDS_ARCHIVE => 'department',
                Action::RECORDS_APPROVE => 'department',
            ],
        ];

        foreach ($matrix as $roleName => $actions) {
            $roleId = $roles[$roleName] ?? null;

            if ($roleId === null) {
                continue;
            }

            Permission::where('role_id', $roleId)
                ->whereNotIn('action', array_keys($actions))
                ->delete();

            foreach ($actions as $action => $scope) {
                Permission::updateOrCreate(
                    ['role_id' => $roleId, 'action' => $action],
                    ['scope' => $scope],
                );
            }
        }
    }
}
