<?php

namespace Tests\Feature\Auth;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthRoutesTest extends TestCase
{
    use RefreshDatabase;

    public function test_me_returns_unauthorized_without_a_token(): void
    {
        $this->getJson('/api/v1/auth/me')
            ->assertStatus(401)
            ->assertJson(['message' => 'Unauthenticated.']);
    }

    public function test_me_without_json_accept_header_does_not_redirect_to_login_route(): void
    {
        $this->get('/api/v1/auth/me')
            ->assertStatus(401);
    }

    public function test_me_returns_the_authenticated_user(): void
    {
        $user = User::factory()->create(['email' => 'me@example.com']);
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('email', 'me@example.com');
    }

    public function test_me_returns_role_and_actions(): void
    {
        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);

        $user = User::factory()->create([
            'role_id' => Role::where('role_name', 'employee')->value('role_id'),
            'status' => 'active',
        ]);
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withToken($token)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('role', 'employee');

        $this->assertContains('read', $response->json('actions'));
    }

    public function test_logout_returns_unauthorized_without_a_token(): void
    {
        $this->postJson('/api/v1/auth/logout')
            ->assertStatus(401)
            ->assertJson(['message' => 'Unauthenticated.']);
    }

    public function test_expired_access_token_is_rejected(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('access-token', ['*'], now()->subMinute())->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);
    }

    public function test_logout_revokes_the_refresh_token(): void
    {
        $user = User::factory()->create();
        $access = $user->createToken('access-token', ['*'], now()->addMinutes(15))->plainTextToken;
        $refresh = $user->createToken('refresh-token', ['issue-access-token'], now()->addDays(30))->plainTextToken;

        $this->withToken($access)
            ->postJson('/api/v1/auth/logout', ['refresh_token' => $refresh])
            ->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_logout_revokes_the_current_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/v1/auth/logout')
            ->assertOk()
            ->assertJson(['message' => 'Logged out successfully.']);

        $this->assertDatabaseCount('personal_access_tokens', 0);

        $this->app['auth']->forgetGuards();

        $this->withToken($token)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);
    }
}
