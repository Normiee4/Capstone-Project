<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class RefreshTokenTest extends TestCase
{
    use RefreshDatabase;

    private function login(string $email = 'test@example.com'): array
    {
        User::factory()->create([
            'email' => $email,
            'password' => 'password123',
        ]);

        return $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'password123',
        ])->assertOk()->json();
    }

    public function test_valid_refresh_token_rotates_the_pair(): void
    {
        $tokens = $this->login();

        $response = $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $tokens['refresh_token'],
        ]);

        $response
            ->assertOk()
            ->assertJsonStructure(['user', 'access_token', 'refresh_token', 'expires_in'])
            ->assertJsonPath('user.email', 'test@example.com');

        $this->assertNotSame($tokens['access_token'], $response->json('access_token'));
        $this->assertNotSame($tokens['refresh_token'], $response->json('refresh_token'));
        $this->assertNull(PersonalAccessToken::findToken($tokens['refresh_token']));
    }

    public function test_used_refresh_token_cannot_be_replayed(): void
    {
        $tokens = $this->login();

        $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $tokens['refresh_token'],
        ])->assertOk();

        $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $tokens['refresh_token'],
        ])->assertStatus(401);
    }

    public function test_access_token_cannot_be_used_as_a_refresh_token(): void
    {
        $tokens = $this->login();

        $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $tokens['access_token'],
        ])->assertStatus(401);
    }

    public function test_expired_refresh_token_is_rejected(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('refresh-token', ['issue-access-token'], now()->subMinute())->plainTextToken;

        $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $token,
        ])->assertStatus(401);
    }

    public function test_suspended_user_cannot_refresh(): void
    {
        $tokens = $this->login();

        User::where('email', 'test@example.com')->update(['status' => 'suspended']);

        $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $tokens['refresh_token'],
        ])->assertStatus(401);
    }

    public function test_refresh_requires_a_token(): void
    {
        $this->postJson('/api/v1/auth/refresh', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('refresh_token');
    }
}
