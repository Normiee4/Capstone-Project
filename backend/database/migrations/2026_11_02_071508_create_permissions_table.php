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
            // PK matching your model's $primaryKey = 'permission_id'
            $table->id('permission_id');

            // Descriptive columns (from your model)
            $table->string('permission_name')->nullable();
            $table->string('permission_description')->nullable();
            $table->string('permission_status')->default('active');

            // The actual grant definition
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

            // The tuple that actually enforces uniqueness
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
