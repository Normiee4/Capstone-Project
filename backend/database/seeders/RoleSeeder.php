<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
       
    // 1. I defined an array of roles with their respective description and status
        $roles = [
            [
                'role_name' => 'super_admin',
                'role_description' => 'Administrator role with full access',
                'role_status' => 'active',
            ],
            [
                'role_name' => 'dept_head',
                'role_description' => 'Department head role with management access to employee level and platform access',
                'role_status' => 'active',
            ],
            [
                'role_name' => 'employee',
                'role_description' => 'Employee role with consolidated access to the platform',
                'role_status' => 'active',
            ]
        ];


    // A loop that will run per each role in the array and create a new role in the database if it does not already exist. 
    // The firstOrCreate method is used to check if a role with the same name already exists in the database, and if not, it will create a new role with the specified description and status.
        foreach ($roles as $role) {
            Role::firstOrCreate(
                
            ['role_name' => $role['role_name']],
            ['role_description' => $role['role_description']],
            ['role_status' => $role['role_status']]
            );
        }
    }
}
