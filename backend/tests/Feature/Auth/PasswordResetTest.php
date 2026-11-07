<?php

namespace Tests\Feature\Auth;

use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use App\Notifications\PasswordResetRequested;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);
    }

    private function userWithRole(string $roleName, ?Department $department = null): User
    {
        return User::factory()->create([
            'role_id' => Role::where('role_name', $roleName)->value('role_id'),
            'department_id' => $department?->department_id,
            'status' => 'active',
        ]);
    }

    public function test_request_notifies_super_admins(): void
    {
        Notification::fake();

        $admin = $this->userWithRole('super_admin');
        $requester = User::factory()->create(['email' => 'requester@example.com']);

        $this->postJson('/api/v1/auth/password-reset-request', [
            'email' => $requester->email,
        ])->assertOk();

        Notification::assertSentTo($admin, PasswordResetRequested::class);
    }

    public function test_request_for_unknown_email_stays_generic_and_notifies_nobody(): void
    {
        Notification::fake();

        $this->postJson('/api/v1/auth/password-reset-request', [
            'email' => 'nobody@example.com',
        ])->assertOk();

        Notification::assertNothingSent();
    }

    public function test_super_admin_can_send_a_reset_link(): void
    {
        Notification::fake();

        $admin = $this->userWithRole('super_admin');
        $target = User::factory()->create(['email' => 'target@example.com']);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/users/{$target->id}/password-reset")
            ->assertOk();

        $this->assertDatabaseHas('password_reset_tokens', [
            'email' => 'target@example.com',
        ]);
    }

    public function test_department_head_cannot_send_a_reset_link(): void
    {
        $department = Department::factory()->create();
        $head = $this->userWithRole('dept_head', $department);
        $employee = User::factory()->create([
            'role_id' => Role::where('role_name', 'employee')->value('role_id'),
            'department_id' => $department->department_id,
            'status' => 'active',
        ]);

        $this->actingAs($head, 'sanctum')
            ->postJson("/api/v1/users/{$employee->id}/password-reset")
            ->assertForbidden();
    }

    public function test_user_can_reset_with_a_valid_token_and_tokens_are_revoked(): void
    {
        $user = User::factory()->create([
            'email' => 'reset@example.com',
            'password' => 'old-password-123',
        ]);
        $user->createToken('access-token');

        $token = Password::broker()->createToken($user);

        $this->postJson('/api/v1/auth/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertOk();

        $this->assertTrue(Hash::check('new-password-123', $user->fresh()->password));
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_reset_with_an_invalid_token_fails(): void
    {
        $user = User::factory()->create(['email' => 'reset@example.com']);

        $this->postJson('/api/v1/auth/reset-password', [
            'email' => $user->email,
            'token' => 'not-a-real-token',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertStatus(422)->assertJsonValidationErrors('email');
    }
}
