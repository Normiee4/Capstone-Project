<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Sanctum\HasApiTokens; // 1. Import the Sanctum trait

class User extends Authenticatable
{
    // 2. Add the HasApiTokens trait
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The primary key is a string, not an auto-incrementing integer.
     */
    protected $primaryKey = 'id';
    public $incrementing = false;      // Disable auto-incrementing
    protected $keyType = 'string';     // Declare the key type as string

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password_hash',   // Your custom column name
        'role_id',
        'department_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password_hash', // Hide this from JSON responses
        'remember_token',
    ];

    /**
     * Get the password for the user.
     * This tells Laravel's authentication system to look at 'password_hash'.
     */
    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    /**
     * Get the name of the password attribute for the user.
     * This is used by `Auth::attempt()`.
     */
    public function getAuthPasswordName()
    {
        return 'password_hash';
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password_hash' => 'hashed', // Automatically hash passwords when set
            'email_verified_at' => 'datetime',
        ];
    }

    // --- Relationships ---


    public function role()
    {
        // Define the relationship to the Role model which is a belongsTo relationship since each user has one role.
        // belongsTo methods works like foreign key relationship where the foreign key is in the users table and references the primary key in the roles table.
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function department()
    {   
        return $this->belongsTo(Department::class, 'department_id');
    }   

    // public function registeredModules(): HasMany
    // {
    //     return $this->hasMany(Module::class, 'registered_by');
    // }

    // public function eventLogs(): HasMany
    // {
    //     return $this->hasMany(EventLog::class, 'user_id');
    // }
}