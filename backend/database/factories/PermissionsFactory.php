<?php

namespace Database\Factories;

use App\Models\Permission;
use App\Support\Action;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Permission>
 */
class PermissionsFactory extends Factory
{
    protected $model = Permission::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'role_id' => $this->faker->numberBetween(1, 10),
            'action' => $this->faker->randomElement(Action::all()),
            'scope' => $this->faker->randomElement(['all', 'department']),
        ];
    }
}
