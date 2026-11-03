<?php

namespace Database\Factories;

use App\Models\Department;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Department>
 */
class DepartmentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = Department::class;

    public function definition(): array
    {
        return [
            'department_name' => $this->faker->word(),
            'department_description' => $this->faker->sentence(),
            'department_head' => $this->faker->name(),
            'department_status' => 'active',
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'department_status' => 'inactive',
        ]);
    }
}
