<?php

namespace Tests\Feature\IAM;

use App\Mail\InvitationMail;
use App\Models\Department;
use App\Models\Invitation;
use App\Models\Role;
use App\Models\User;
use App\Modules\IAM\Services\UserService;
use Database\Seeders\RoleSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class InvitationServiceTest extends TestCase
{
    use RefreshDatabase;

    private UserService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        Mail::fake();
        $this->service = app(UserService::class);
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

    public function test_super_admin_invite_reserves_the_user_and_emails_a_link(): void
    {
        $admin = $this->actor('super_admin');
        $department = Department::factory()->create();

        $invitation = $this->service->createInvite(
            $admin,
            'invitee@example.com',
            'employee',
            $department->department_id,
        );

        $this->assertDatabaseHas('invitations', [
            'id' => $invitation->id,
            'email' => 'invitee@example.com',
            'role_id' => $this->roleId('employee'),
        ]);

        $this->assertDatabaseHas('users', [
            'email' => 'invitee@example.com',
            'status' => 'invited',
            'role_id' => $this->roleId('employee'),
        ]);

        $this->captureToken('invitee@example.com');
    }

    public function test_department_head_can_only_invite_employees_into_their_own_department(): void
    {
        $department = Department::factory()->create();
        $other = Department::factory()->create();
        $head = $this->actor('dept_head', $department);

        $this->expectException(AuthorizationException::class);
        $this->service->createInvite($head, 'x@example.com', 'dept_head', $department->department_id);
    }

    public function test_department_head_cannot_invite_into_another_department(): void
    {
        $department = Department::factory()->create();
        $other = Department::factory()->create();
        $head = $this->actor('dept_head', $department);

        $this->expectException(AuthorizationException::class);
        $this->service->createInvite($head, 'x@example.com', 'employee', $other->department_id);
    }

    public function test_employee_cannot_invite_anyone(): void
    {
        $employee = $this->actor('employee');

        $this->expectException(AuthorizationException::class);
        $this->service->createInvite($employee, 'x@example.com', 'employee', $employee->department_id);
    }

    public function test_accepting_an_invitation_activates_the_reserved_user(): void
    {
        $admin = $this->actor('super_admin');
        $department = Department::factory()->create();

        $this->service->createInvite($admin, 'invitee@example.com', 'employee', $department->department_id);
        $token = $this->captureToken('invitee@example.com');

        $user = $this->service->acceptInvite($token, [
            'name' => 'Real Name',
            'password' => 'new-password-123',
        ]);

        $this->assertSame('invitee@example.com', $user->email);
        $this->assertSame('Real Name', $user->name);
        $this->assertSame('active', $user->status);
        $this->assertTrue(Hash::check('new-password-123', $user->password));

        $this->assertNotNull($invitation = Invitation::where('email', 'invitee@example.com')->first()->accepted_at);
    }

    public function test_an_invitation_cannot_be_accepted_twice(): void
    {
        $admin = $this->actor('super_admin');
        $department = Department::factory()->create();

        $this->service->createInvite($admin, 'invitee@example.com', 'employee', $department->department_id);
        $token = $this->captureToken('invitee@example.com');

        $this->service->acceptInvite($token, ['name' => 'Real Name', 'password' => 'new-password-123']);

        $this->expectException(AuthorizationException::class);
        $this->service->acceptInvite($token, ['name' => 'Real Name', 'password' => 'new-password-123']);
    }

    public function test_an_expired_invitation_cannot_be_accepted(): void
    {
        $admin = $this->actor('super_admin');
        $department = Department::factory()->create();

        $this->service->createInvite($admin, 'invitee@example.com', 'employee', $department->department_id);
        $token = $this->captureToken('invitee@example.com');

        Invitation::where('email', 'invitee@example.com')->update(['expires_at' => now()->subMinute()]);

        $this->expectException(AuthorizationException::class);
        $this->service->acceptInvite($token, ['name' => 'Real Name', 'password' => 'new-password-123']);
    }

    public function test_an_unknown_token_cannot_be_accepted(): void
    {
        $this->expectException(AuthorizationException::class);
        $this->service->acceptInvite('not-a-real-token', ['name' => 'Real Name', 'password' => 'new-password-123']);
    }

    public function test_resend_is_blocked_while_an_invitation_is_still_valid(): void
    {
        $admin = $this->actor('super_admin');
        $department = Department::factory()->create();

        $this->service->createInvite($admin, 'invitee@example.com', 'employee', $department->department_id);

        $this->expectException(AuthorizationException::class);
        $this->service->resendInvite($admin, 'invitee@example.com', 'employee', $department->department_id);
    }

    public function test_resend_after_expiry_issues_a_new_link(): void
    {
        $admin = $this->actor('super_admin');
        $department = Department::factory()->create();

        $this->service->createInvite($admin, 'invitee@example.com', 'employee', $department->department_id);
        $firstToken = $this->captureToken('invitee@example.com');

        Invitation::where('email', 'invitee@example.com')->update(['expires_at' => now()->subMinute()]);

        $this->service->resendInvite($admin, 'invitee@example.com', 'employee', $department->department_id);

        $secondToken = $this->captureToken('invitee@example.com');
        $this->assertNotSame($firstToken, $secondToken);

        $this->assertDatabaseCount('users', 2); // the actor plus the single reserved invitee
    }
}
