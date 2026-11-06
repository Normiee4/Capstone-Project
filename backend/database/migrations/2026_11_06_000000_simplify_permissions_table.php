<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Replace the (role, module, action, scope) grant model with a minimal
     * (role, action, scope) capability model.
     *
     * Non-destructive to users/departments/roles: only the derived
     * permissions grants are rebuilt, so re-run PermissionSeeder afterwards.
     */
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->unique('role_name');
        });

        Schema::dropIfExists('permissions');

        Schema::create('permissions', function (Blueprint $table) {
            $table->id('permission_id');

            $table->foreignId('role_id')
                ->constrained('roles', 'role_id')
                ->cascadeOnDelete();

            $table->string('action', 100);
            $table->enum('scope', ['all', 'department'])->default('department');

            $table->timestamps();

            $table->unique(['role_id', 'action'], 'permissions_role_action_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('permissions');

        Schema::create('permissions', function (Blueprint $table) {
            $table->id('permission_id');
            $table->string('permission_name')->nullable();
            $table->string('permission_description')->nullable();
            $table->string('permission_status')->default('active');

            $table->foreignId('role_id')
                ->constrained('roles', 'role_id')
                ->cascadeOnDelete();

            $table->string('module_id')->default('*');

            $table->enum('action', [
                'register', 'activate', 'deactivate', 'delete',
                'run_pipeline', 'configure_adapter',
                'create', 'read', 'update', 'archive',
            ]);

            $table->enum('scope', ['own', 'department', 'all'])->default('own');

            $table->timestamps();

            $table->unique(['role_id', 'module_id', 'action'], 'permissions_role_module_action_unique');
        });

        Schema::table('roles', function (Blueprint $table) {
            $table->dropUnique(['role_name']);
        });
    }
};
