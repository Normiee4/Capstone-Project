<?php

namespace App\Models;

use Database\Factories\PermissionsFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Permission extends Model
{
    /** @use HasFactory<PermissionsFactory> */
    use HasFactory;

    protected $primaryKey = 'permission_id';

    protected $keyType = 'int';

    public $incrementing = true;

    protected $fillable = [
        'role_id',
        'action',
        'scope',
    ];

    protected $casts = [
        'scope' => 'string',
    ];

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id', 'role_id');
    }
}
