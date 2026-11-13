<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('permissions', function (Blueprint $table) {
            $table->id('permission_id');    // or $table->id(), depending on your PK
            $table->foreignId('role_id')
                ->constrained('roles', 'role_id')
                ->cascadeOnDelete();

            $table->string('module_id')->default('*');   // ← MUST be here
            $table->enum('action', [
                'register', 'activate', 'deactivate', 'delete',
                'run_pipeline', 'configure_adapter',
                'create', 'read', 'update', 'archive',
                'invite', 'manage_users', 'reset_password',
            ]);
            $table->enum('scope', ['own', 'department', 'all'])->default('own');
            $table->timestamps();
            $table->unique(['role_id', 'module_id', 'action'], 'permissions_role_module_action_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('permissions');
    }
};
