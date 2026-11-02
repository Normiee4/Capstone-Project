<?php

namespace Database\Factories;

use App\Models\Permissions;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Permissions>
 */
class PermissionsFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'permission_name' => $this->faker->word(),
            'permission_description' => $this->faker->sentence(),
            'permission_status' => $this->faker->randomElement(['active', 'inactive']),
            'role_id' => $this->faker->numberBetween(1, 10),
            'action' => $this->faker->randomElement(['create', 'read', 'update', 'delete']),
            'scope' => $this->faker->randomElement(['global', 'local']),
        ];
    }
}
