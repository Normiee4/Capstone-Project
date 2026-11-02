<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Permission extends Model
{
    /** @use HasFactory<\Database\Factories\PermissionsFactory> */
    use HasFactory;

    protected $primaryKey = 'permission_id';
    protected $keyType = 'int';
    public $incrementing = true;


    protected $fillable = 
    [   
        'permission_name', 
        'permission_description', 
        'permission_status',
        'role_id',
        'module_id',
        'action',
        'scope'
    ];
    public $timestamps = true;  


    // typecasts or attribute casting for the permission_status field into string data type
    protected $casts = 
    [
        'permission_status' => 'string',
        'action' => 'string',
        'scope' => 'string',
    ];

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id', 'role_id');
    }
}
