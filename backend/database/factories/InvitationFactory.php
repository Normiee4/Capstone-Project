<?php

namespace Database\Factories;

use App\Models\Department;
use App\Models\Invitation;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Invitation>
 */
class InvitationFactory extends Factory
{
    protected $model = Invitation::class;

    public function definition(): array
    {
        // Role: default to employee. Override with ->forRole().
        $role = Role::where('role_name', 'employee')->first()
            ?? Role::factory()->create(['role_name' => 'employee']);

        return [
            'email'         => $this->faker->unique()->safeEmail(),
            'role_id'       => $role->role_id,
            'department_id' => null,
            'invited_by'    => User::factory(),           // auto-creates a user
            'token_hash'    => hash('sha256', Str::random(64)),
            'expires_at'    => now()->addHours(72),
            'last_sent_at'  => now(),
            'accepted_at'   => null,
        ];
    }

    public function expired(): static
    {
        return $this->state(fn () => [
            'expires_at' => now()->subHour(),
        ]);
    }

    public function accepted(): static
    {
        return $this->state(fn () => [
            'accepted_at' => now(),
        ]);
    }

    public function forRole(string $roleName): static
    {
        return $this->state(function () use ($roleName) {
            $role = Role::where('role_name', $roleName)->firstOrFail();
            return ['role_id' => $role->role_id];
        });
    }

    public function forDepartment(int $departmentId): static
    {
        return $this->state(fn () => ['department_id' => $departmentId]);
    }

    public function byUser(User $user): static
    {
        return $this->state(fn () => ['invited_by' => $user->id]);
    }
}