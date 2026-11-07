<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;   // gate checks happen elsewhere
    }

    public function rules(): array
    {
        return [
            'name'          => ['required', 'string', 'max:255'],
            'email'         => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password'      => ['required', 'string', 'min:8'],
            'role_id'       => ['nullable', 'integer', 'exists:roles,role_id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,department_id'],
            'status'        => ['nullable', 'in:invited,active,suspended'],
        ];
    }
}