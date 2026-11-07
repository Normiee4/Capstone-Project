<?php

namespace Tests\Feature\IAM;

use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use App\Support\Action;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    protected Department $deptA;

    protected Department $deptB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);

        $this->deptA = Department::factory()->create();
        $this->deptB = Department::factory()->create();
    }

    private function actor(string $roleName, ?Department $department = null): User
    {
        return User::factory()->create([
            'role_id' => Role::where('role_name', $roleName)->value('role_id'),
            'department_id' => $department?->department_id,
            'status' => 'active',
        ]);
    }

    private function employee(Department $department): User
    {
        return User::factory()->create([
            'role_id' => Role::where('role_name', 'employee')->value('role_id'),
            'department_id' => $department->department_id,
            'status' => 'active',
        ]);
    }

    public function test_action_matrix_is_seeded(): void
    {
        $this->assertTrue($this->actor('super_admin')->hasAction(Action::USERS_CREATE));
        $this->assertTrue($this->actor('dept_head', $this->deptA)->hasAction(Action::USERS_INVITE));
        $this->assertFalse($this->actor('dept_head', $this->deptA)->hasAction(Action::USERS_DELETE));
        $this->assertTrue($this->actor('employee', $this->deptA)->hasAction(Action::RECORDS_APPROVE));
        $this->assertFalse($this->actor('employee', $this->deptA)->hasAction(Action::USERS_VIEW));
    }

    public function test_employee_own_scope_only_matches_the_actor(): void
    {
        $employee = $this->employee($this->deptA);
        $teammate = $this->employee($this->deptA);

        $this->assertTrue($employee->hasAction(Action::RECORDS_UPDATE, $employee));
        $this->assertFalse($employee->hasAction(Action::RECORDS_UPDATE, $teammate));
    }

    public function test_super_admin_can_list_all_users(): void
    {
        $this->employee($this->deptA);
        $this->employee($this->deptB);

        $this->actingAs($this->actor('super_admin'), 'sanctum')
            ->getJson('/api/v1/users')
            ->assertOk()
            ->assertJsonCount(3, 'data'); // actor + 2 employees
    }

    public function test_department_head_only_lists_employees_in_own_department(): void
    {
        $head = $this->actor('dept_head', $this->deptA);
        $this->employee($this->deptA);
        $this->employee($this->deptB);

        $response = $this->actingAs($head, 'sanctum')->getJson('/api/v1/users');

        $response->assertOk()->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.department', $this->deptA->department_name);
    }

    public function test_employee_cannot_list_users(): void
    {
        $this->actingAs($this->actor('employee', $this->deptA), 'sanctum')
            ->getJson('/api/v1/users')
            ->assertForbidden();
    }

    public function test_department_head_can_update_employee_in_own_department_without_password(): void
    {
        $head = $this->actor('dept_head', $this->deptA);
        $employee = $this->employee($this->deptA);

        $this->actingAs($head, 'sanctum')
            ->putJson("/api/v1/users/{$employee->id}", [
                'name' => 'Renamed Employee',
                'email' => $employee->email,
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Renamed Employee');
    }

    public function test_department_head_cannot_update_employee_in_another_department(): void
    {
        $head = $this->actor('dept_head', $this->deptA);
        $outsider = $this->employee($this->deptB);

        $this->actingAs($head, 'sanctum')
            ->putJson("/api/v1/users/{$outsider->id}", [
                'name' => 'Hijacked',
                'email' => $outsider->email,
            ])
            ->assertForbidden();
    }

    public function test_department_head_cannot_escalate_role(): void
    {
        $head = $this->actor('dept_head', $this->deptA);
        $employee = $this->employee($this->deptA);

        $this->actingAs($head, 'sanctum')
            ->putJson("/api/v1/users/{$employee->id}", [
                'name' => $employee->name,
                'email' => $employee->email,
                'role_id' => Role::where('role_name', 'dept_head')->value('role_id'),
            ])
            ->assertForbidden();
    }

    public function test_update_rejects_duplicate_email(): void
    {
        $head = $this->actor('dept_head', $this->deptA);
        $employee = $this->employee($this->deptA);
        $other = $this->employee($this->deptA);

        $this->actingAs($head, 'sanctum')
            ->putJson("/api/v1/users/{$employee->id}", [
                'name' => $employee->name,
                'email' => $other->email,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_super_admin_cannot_delete_self(): void
    {
        $admin = $this->actor('super_admin');

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/v1/users/{$admin->id}")
            ->assertForbidden();
    }
}
