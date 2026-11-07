<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // route-level ability + controller guardrails
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name'          => ['required', 'string', 'max:255'],
            'email'         => [
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($this->route('user')),
            ],
            'password'      => ['sometimes', 'string', 'min:8'],
            'role_id'       => ['sometimes', 'nullable', 'integer', 'exists:roles,role_id'],
            'department_id' => ['sometimes', 'nullable', 'integer', 'exists:departments,department_id'],
            'status'        => ['sometimes', 'nullable', 'in:invited,active,suspended'],
        ];
    }
}
