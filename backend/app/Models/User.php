<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $primaryKey = 'id';

    public $incrementing = true;

    protected $keyType = 'int';

    protected $fillable = [
        'name',
        'email',
        'password',
        'role_id',
        'department_id',
        'status',
        'invited_at',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'email_verified_at' => 'datetime',
            'invited_at' => 'datetime',
            'last_login_at' => 'datetime',
        ];
    }

    public function getAuthPassword()
    {
        return $this->password;                // ← was $this->password_hash
    }

    public function getAuthPasswordName()
    {
        return 'password';
    }

    // ── Relationships ──────────────────────────────

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id', 'role_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id', 'department_id');
    }

    // ── Authorization helper ───────────────────────

    public function hasPermission(string $action, string $moduleId, string $requiredScope = 'own'): bool
    {
        $acceptableScopes = match ($requiredScope) {
            'own' => ['own', 'department', 'all'],
            'department' => ['department', 'all'],
            'all' => ['all'],
            default => [],
        };

        return Permission::where('role_id', $this->role_id)
            ->where('action', $action)
            ->whereIn('module_id', [$moduleId, '*'])
            ->whereIn('scope', $acceptableScopes)
            ->exists();
    }
}
