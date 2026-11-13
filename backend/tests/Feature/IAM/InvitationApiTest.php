<?php

namespace Tests\Feature\IAM;

use App\Mail\InvitationMail;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class InvitationApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);
        Mail::fake();
    }

    private function actor(string $roleName, ?Department $department = null): User
    {
        return User::factory()->create([
            'role_id' => Role::where('role_name', $roleName)->value('role_id'),
            'department_id' => $department?->department_id,
            'status' => 'active',
        ]);
    }

    private function roleId(string $roleName): int
    {
        return (int) Role::where('role_name', $roleName)->value('role_id');
    }

    private function captureToken(string $email): string
    {
        $token = null;

        Mail::assertSent(InvitationMail::class, function (InvitationMail $mail) use ($email, &$token) {
            if ($mail->invitation->email !== $email) {
                return false;
            }

            $token = $mail->plainToken;

            return true;
        });

        $this->assertNotNull($token, "No invitation email was sent to {$email}.");

        return $token;
    }

    public function test_super_admin_can_invite_a_user(): void
    {
        $admin = $this->actor('super_admin');
        $department = Department::factory()->create();

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/users/invite', [
                'email' => 'invitee@example.com',
                'role_id' => $this->roleId('employee'),
                'department_id' => $department->department_id,
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Invitation sent.');

        $this->assertDatabaseHas('users', [
            'email' => 'invitee@example.com',
            'status' => 'invited',
        ]);

        $this->captureToken('invitee@example.com');
    }

    public function test_employee_cannot_invite_anyone(): void
    {
        $employee = $this->actor('employee');

        $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/users/invite', [
                'email' => 'invitee@example.com',
                'role_id' => $this->roleId('employee'),
            ])
            ->assertForbidden();
    }

    public function test_department_head_cannot_invite_a_department_head(): void
    {
        $department = Department::factory()->create();
        $head = $this->actor('dept_head', $department);

        $this->actingAs($head, 'sanctum')
            ->postJson('/api/v1/users/invite', [
                'email' => 'invitee@example.com',
                'role_id' => $this->roleId('dept_head'),
                'department_id' => $department->department_id,
            ])
            ->assertForbidden();
    }

    public function test_invitation_can_be_looked_up_by_token(): void
    {
        $admin = $this->actor('super_admin');
        $department = Department::factory()->create();

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/users/invite', [
            'email' => 'invitee@example.com',
            'role_id' => $this->roleId('employee'),
            'department_id' => $department->department_id,
        ])->assertCreated();

        $token = $this->captureToken('invitee@example.com');

        $this->getJson("/api/v1/invitations/{$token}")
            ->assertOk()
            ->assertJsonPath('email', 'invitee@example.com')
            ->assertJsonPath('role', 'employee')
            ->assertJsonPath('accepted', false);
    }

    public function test_invitee_accepts_the_invitation_and_can_sign_in(): void
    {
        $admin = $this->actor('super_admin');
        $department = Department::factory()->create();

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/users/invite', [
            'email' => 'invitee@example.com',
            'role_id' => $this->roleId('employee'),
            'department_id' => $department->department_id,
        ])->assertCreated();

        $token = $this->captureToken('invitee@example.com');

        $this->postJson('/api/v1/invitations/accept', [
            'token' => $token,
            'name' => 'Real Name',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertOk();

        $user = User::where('email', 'invitee@example.com')->first();
        $this->assertSame('active', $user->status);
        $this->assertTrue(Hash::check('new-password-123', $user->password));

        $this->postJson('/api/v1/auth/login', [
            'email' => 'invitee@example.com',
            'password' => 'new-password-123',
        ])->assertOk();
    }

    public function test_an_invitation_cannot_be_accepted_twice(): void
    {
        $admin = $this->actor('super_admin');
        $department = Department::factory()->create();

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/users/invite', [
            'email' => 'invitee@example.com',
            'role_id' => $this->roleId('employee'),
            'department_id' => $department->department_id,
        ])->assertCreated();

        $token = $this->captureToken('invitee@example.com');

        $payload = [
            'token' => $token,
            'name' => 'Real Name',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ];

        $this->postJson('/api/v1/invitations/accept', $payload)->assertOk();
        $this->postJson('/api/v1/invitations/accept', $payload)->assertForbidden();
    }

    public function test_accepting_with_an_unknown_token_is_rejected(): void
    {
        $this->postJson('/api/v1/invitations/accept', [
            'token' => str_repeat('a', 64),
            'name' => 'Real Name',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertForbidden();
    }

    public function test_invitation_can_be_resent_after_it_expires(): void
    {
        $admin = $this->actor('super_admin');
        $department = Department::factory()->create();

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/users/invite', [
            'email' => 'invitee@example.com',
            'role_id' => $this->roleId('employee'),
            'department_id' => $department->department_id,
        ])->assertCreated();

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/users/invite/resend', [
            'email' => 'invitee@example.com',
            'role_id' => $this->roleId('employee'),
            'department_id' => $department->department_id,
        ])->assertForbidden();   // still pending

        \App\Models\Invitation::where('email', 'invitee@example.com')
            ->update(['expires_at' => now()->subMinute()]);

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/users/invite/resend', [
            'email' => 'invitee@example.com',
            'role_id' => $this->roleId('employee'),
            'department_id' => $department->department_id,
        ])->assertOk();
    }
}
