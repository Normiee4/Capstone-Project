<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    /** @use HasFactory<\Database\Factories\DepartmentFactory> */
    use HasFactory;

    protected $primaryKey = 'department_id';
    protected $keyType = 'int';
    public $incrementing = true;

    protected $fillable = 
    [
        'department_name', 
        'department_description', 
        'department_head', 
        'department_status'
        ];
    public $timestamps = true;  

    protected $casts = [
        'department_id' => 'integer',
        'department_name' => 'string',
        'department_description' => 'string',
        'department_head' => 'string',
        'department_status' => 'string',
    ];


    public function users()
    {
        return $this->hasMany(User::class, 'department_id', 'department_id');
    }
    
    // public function modules(): HasMany
    // {
    //     return $this->hasMany(Module::class, 'department_id');
    // }
}

