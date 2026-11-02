<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    /** @use HasFactory<\Database\Factories\RoleFactory> */
    use HasFactory;

    protected $primaryKey = 'role_id';
    protected $keyType = 'int';
    public $incrementing = true;

    protected $fillable = 
    [
        'role_name', 
        'role_description', 
        'role_status',
    ];

    public $timestamps = true;

    protected $casts = [
        'role_status' => 'string',
    ];

    public function permissions(): HasMany
    {
        return $this->hasMany(Permission::class, 'role_id', 'role_id');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'role_id', 'role_id');
    }
}
