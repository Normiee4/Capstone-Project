<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'status' => $this->status,
            'role' => $this->role?->role_name,
            'department' => $this->department?->department_name,
            'actions' => $this->role?->permissions->pluck('action')->values()->all() ?? [],
            'last_login_at' => $this->last_login_at?->toIso8601String(),
        ];
    }
}
