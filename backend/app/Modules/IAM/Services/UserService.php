<?php

namespace App\Modules\IAM\Services;

use App\Models\User;
use App\Models\Role;
use App\Models\Invitation;
use App\Mail\InvitationMail;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class UserService
{
    /**
     * How long an invitation link stays usable.
     */
    private const INVITE_TTL_HOURS = 72;

    /**
     * Create a new class instance.
     */
    public function __construct(private AuditService $audit)
    {

    }

    // business logics on how audit logging of user actions works
    public function create(array $data) : User
    {
        $user = User::create($data);
        $this->audit->log('user.created', $user);
        return $user;
    }

    public function update(User $user, array $data): User
    {
        $user->update($data);
        $this->audit->log('user.updated', $user);
        return $user;
    }

    public function delete(User $user): void
    {
        $user->delete();
        $this->audit->log('user.deleted', $user);
    }

    /**
     * Invite a user. The users row is reserved up front (status `invited`, an
     * unusable password) so the email is claimed and the account cannot log in
     * until the invitation is accepted.
     */
    public function createInvite(
    User $actor,
    string $email,
    string $roleName,
    ?int $departmentId = null,
    ?string $ip = null,
    ?string $ua = null,
    ): Invitation
    {
        $this->authorizeInvite($actor, $roleName, $departmentId);

        $role = Role::where('role_name', $roleName)->firstOrFail();

        if (User::where('email', $email)->exists()) {
            throw new AuthorizationException('That email already belongs to a user.');
        }

        return DB::transaction(function () use ($actor, $email, $role, $roleName, $departmentId, $ip, $ua) {
            $user = $this->reserveInvitedUser($email, $role, $departmentId);

            [$invitation, $plainToken] = $this->issueInvitation($user, $role, $departmentId, $actor);

            Mail::to($email)->send(new InvitationMail($invitation, $plainToken));

            $this->audit->log('invitation.sent', $invitation, [
                'email' => $email,
                'role'  => $roleName,
                'ip'    => $ip,
                'ua'    => $ua,
            ]);

            return $invitation;
        });
    }

    /**
     * Re-send an invitation. Refuses while a live invitation is still pending,
     * but revives an expired one (or reserves the user row if it was purged).
     */
    public function resendInvite(
    User $actor,
    string $email,
    string $roleName,
    ?int $departmentId = null,
    ?string $ip = null,
    ?string $ua = null,
    ): Invitation {
        $this->authorizeInvite($actor, $roleName, $departmentId);

        $role = Role::where('role_name', $roleName)->firstOrFail();

        return DB::transaction(function () use ($actor, $email, $role, $roleName, $departmentId, $ip, $ua) {
            $user = User::where('email', $email)->lockForUpdate()->first();

            if ($user && $user->status === 'active') {
                throw new AuthorizationException('That email already has an active account.');
            }

            if ($user) {
                $latest = Invitation::where('email', $email)->latest('id')->first();

                if ($latest && $latest->isValid()) {
                    throw new AuthorizationException('User already has an active, unexpired invitation.');
                }

                // expired invite: reuse the reserved row
                $user->forceFill([
                    'role_id'       => $role->role_id,
                    'department_id' => $departmentId,
                    'status'        => 'invited',
                    'invited_at'    => now(),
                ])->save();
            } else {
                $user = $this->reserveInvitedUser($email, $role, $departmentId);
            }

            [$invitation, $plainToken] = $this->issueInvitation($user, $role, $departmentId, $actor);

            Mail::to($email)->send(new InvitationMail($invitation, $plainToken));

            $this->audit->log('invitation.sent', $invitation, [
                'email' => $email,
                'role'  => $roleName,
                'ip'    => $ip,
                'ua'    => $ua,
            ]);

            return $invitation;
        });
    }

    /**
     * Accept an invitation: activate the reserved user and burn the token.
     *
     * The email and role always come from the invitation row, never from the
     * request, so a valid token cannot be replayed against another address.
     *
     * @param  array{name: string, password: string}  $data
     */
    public function acceptInvite(string $plainToken, array $data): User
    {
        $tokenHash = hash('sha256', $plainToken);

        return DB::transaction(function () use ($tokenHash, $data) {
            $invitation = Invitation::where('token_hash', $tokenHash)->lockForUpdate()->first();

            if (! $invitation || ! $invitation->isValid()) {
                throw new AuthorizationException('This invitation is invalid or has expired.');
            }

            $user = User::where('email', $invitation->email)->lockForUpdate()->first();

            if (! $user) {
                throw new AuthorizationException('This invitation is invalid or has expired.');
            }

            if ($user->status === 'active') {
                throw new AuthorizationException('This invitation has already been accepted.');
            }

            // burn the token before touching the user, so a concurrent replay loses
            $invitation->update(['accepted_at' => now()]);

            $user->forceFill([
                'name'              => $data['name'],
                'password'          => $data['password'],
                'status'            => 'active',
                'email_verified_at' => now(),
            ])->save();

            $this->audit->log('invitation.accept', $user, [
                'email' => $user->email,
                'ip'    => request()->ip(),
                'ua'    => request()->userAgent(),
            ]);

            return $user->fresh();
        });
    }

    /**
     * Super Admin may invite anyone. A Department Head may only invite
     * employees into their own department.
     */
    private function authorizeInvite(User $actor, string $roleName, ?int $departmentId): void
    {
        $actorRole = $actor->role?->role_name;

        if ($actorRole === 'super_admin') {
            // any role; a department is required for everyone except super_admin
        } elseif ($actorRole === 'dept_head') {
            if ($roleName !== 'employee') {
                throw new AuthorizationException('Dept Heads can only invite employees.');
            }
            if ($departmentId !== $actor->department_id) {
                throw new AuthorizationException('You can only invite into your own department.');
            }
        } else {
            throw new AuthorizationException('Not allowed to invite.');
        }

        if ($roleName !== 'super_admin' && $departmentId === null) {
            throw new AuthorizationException('A department is required for this role.');
        }
    }

    /**
     * Reserve the users row for an invitee. The password is random and
     * unusable; it is replaced when the invitation is accepted.
     */
    private function reserveInvitedUser(string $email, Role $role, ?int $departmentId): User
    {
        return User::create([
            'name'          => Str::before($email, '@'),
            'email'         => $email,
            'password'      => Str::password(32),
            'role_id'       => $role->role_id,
            'department_id' => $departmentId,
            'status'        => 'invited',
            'invited_at'    => now(),
        ]);
    }

    /**
     * Store a hashed token and hand back the plain token for the email link.
     *
     * @return array{0: Invitation, 1: string}
     */
    private function issueInvitation(
    User $invitee,
    Role $role,
    ?int $departmentId,
    User $actor,
    ): array {
        $plainToken = Str::random(64);

        $invitation = Invitation::create([
            'email'         => $invitee->email,
            'role_id'       => $role->role_id,
            'department_id' => $departmentId,
            'invited_by'    => $actor->id,
            'token_hash'    => hash('sha256', $plainToken),
            'expires_at'    => now()->addHours(self::INVITE_TTL_HOURS),
            'last_sent_at'  => now(),
        ]);

        return [$invitation, $plainToken];
    }
}

