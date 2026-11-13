<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class InvitationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;   // route middleware handles auth and the invite permission
    }

    public function rules(): array
    {
        return [
            'email'         => ['required', 'string', 'email', 'max:255'],
            'role_id'       => ['required', 'integer', 'exists:roles,role_id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,department_id'],
        ];
    }
}
