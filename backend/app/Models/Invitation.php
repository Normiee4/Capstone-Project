<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invitation extends Model
{
    protected $fillable = [
        'email', 'role_id', 'department_id', 'invited_by',
        'token_hash', 'expires_at', 'last_sent_at', 'accepted_at',
    ];

    protected $casts = [
        'expires_at'    => 'datetime',
        'accepted_at'   => 'datetime',
        'last_sent_at'  => 'datetime',
    ];

    protected $hidden = ['token_hash'];   // never expose in JSON

    // 1-1 relationship to Role Id
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id', 'role_id');
    }

    // 1-1 relationship to Dept id
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id', 'department_id');
    }

    // 1-1 relationship to User
    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    // invite is accepted false, not nullable
    public function isAccepted(): bool
    {
        return $this->accepted_at !== null;
    }

    // invites still valid if not exired and not accepted yet
    public function isValid(): bool
    {
        return ! $this->isExpired() && ! $this->isAccepted();
    }
}