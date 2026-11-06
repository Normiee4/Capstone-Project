<?php

namespace App\Modules\IAM\Services;

use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthService
{
    public function __construct(private AuditService $audit) {}

    public function login(
        string $email,
        string $password,
        ?string $ip = null,
        ?string $ua = null
    ): array {
        $user = User::where('email', $email)->first();
        $storedPassword = $user?->getAuthPassword();
        $hasUsableHash = is_string($storedPassword)
            && $storedPassword !== ''
            && Hash::isHashed($storedPassword);

        if (! $user || ! $hasUsableHash || ! Hash::check($password, $storedPassword)) {
            $this->audit->log('login.failure', null, [
                'email' => $email,
                'ip' => $ip,
                'ua' => $ua,
                'reason' => $user && ! $hasUsableHash ? 'missing_or_unhashed_password' : 'invalid_credentials',
            ]);

            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        if ($user->status !== 'active') {
            $this->audit->log('login.blocked', $user, ['reason' => $user->status]);

            throw new AuthorizationException('Account is not active.');
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        $user->forceFill(['last_login_at' => now()])->save();
        $user->loadMissing('role.permissions');

        $this->audit->log('login.success', $user);

        return ['user' => $user, 'token' => $token];
    }

    public function logout(User $user): void
    {
        $token = $user->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }
        $this->audit->log('logout', $user);
    }
}
