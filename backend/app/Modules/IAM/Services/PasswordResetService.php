<?php

namespace App\Modules\IAM\Services;

use App\Models\User;
use App\Notifications\PasswordResetRequested;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;

class PasswordResetService
{
    public function __construct(private AuditService $audit) {}

    public function request(string $email): void
    {
        $user = User::where('email', $email)->first();

        if ($user === null) {
            return;
        }

        $admins = User::query()
            ->whereHas('role', fn ($query) => $query->where('role_name', 'super_admin'))
            ->get();

        Notification::send($admins, new PasswordResetRequested($user));

        $this->audit->log('password.reset.requested', $user);
    }

    public function sendLink(User $user): string
    {
        $status = Password::sendResetLink(['email' => $user->email]);

        $this->audit->log('password.reset.link_sent', $user);

        return $status;
    }

    public function reset(array $credentials): string
    {
        return Password::reset($credentials, function (User $user, string $password): void {
            $user->forceFill(['password' => $password])->save();
            $user->tokens()->delete();

            $this->audit->log('password.reset.completed', $user);
        });
    }
}
