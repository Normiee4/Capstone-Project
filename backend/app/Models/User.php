<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
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
        return $this->password;
    }

    public function getAuthPasswordName()
    {
        return 'password';
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id', 'role_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id', 'department_id');
    }

    /**
     * Check whether the user's active role holds an action grant and, when a
     * target record is supplied and the grant is department-scoped, whether
     * that record belongs to the user's own department.
     */
    public function hasAction(string $action, ?Model $target = null): bool
    {
        $role = $this->role;
        if ($role === null) {
            return false;
        }

        $grant = $role->permissions->firstWhere('action', $action);
        if ($grant === null) {
            return false;
        }

        if ($grant->scope === 'all' || $target === null) {
            return true;
        }

        // scope = 'department' only
        return $this->department_id !== null
            && $this->department_id === $target->department_id;
    }
}
