<?php

namespace App\Modules\IAM\Services;

use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthService
{
    private const ACCESS_TTL_MINUTES = 15;

    private const REFRESH_TTL_DAYS = 30;

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

        $user->forceFill(['last_login_at' => now()])->save();

        $this->audit->log('login.success', $user);

        return ['user' => $user] + $this->issueTokens($user);
    }

    public function refresh(string $refreshToken): array
    {
        $token = PersonalAccessToken::findToken($refreshToken);

        // An access token carries ['*'], which Sanctum's can() matches against any
        // ability, so the name is checked too to keep the two token kinds apart.
        if (
            ! $token
            || $token->name !== 'refresh-token'
            || ! $token->can('issue-access-token')
            || ! $token->expires_at
            || $token->expires_at->isPast()
            || ! ($token->tokenable instanceof User)
            || $token->tokenable->status !== 'active'
        ) {
            $token?->delete();

            throw new AuthenticationException('Invalid or expired refresh token.');
        }

        $user = $token->tokenable;

        $token->delete();

        $user->loadMissing('role.permissions');

        $this->audit->log('token.refreshed', $user);

        return ['user' => $user] + $this->issueTokens($user);
    }

    public function logout(User $user, ?string $refreshToken = null): void
    {
        $current = $user->currentAccessToken();

        if ($current instanceof PersonalAccessToken) {
            $current->delete();
        }

        if ($refreshToken !== null) {
            $token = PersonalAccessToken::findToken($refreshToken);

            if ($token && $token->tokenable_id === $user->getKey()) {
                $token->delete();
            }
        } else {
            // shortcut: logout without the refresh token revokes every session, upgrade if per-device logout is needed
            $user->tokens()->where('name', 'refresh-token')->delete();
        }

        $this->audit->log('logout', $user);
    }

    private function issueTokens(User $user): array
    {
        $access = $user->createToken(
            'access-token',
            ['*'],
            now()->addMinutes(self::ACCESS_TTL_MINUTES),
        )->plainTextToken;

        $refresh = $user->createToken(
            'refresh-token',
            ['issue-access-token'],
            now()->addDays(self::REFRESH_TTL_DAYS),
        )->plainTextToken;

        return [
            'access_token' => $access,
            'refresh_token' => $refresh,
            'expires_in' => self::ACCESS_TTL_MINUTES * 60,
        ];
    }
}
