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
        Schema::create('invitations', function (Blueprint $table) {
            $table->id();

            // Who was invited
            $table->string('email')->index();
            $table->foreignId('role_id')
                ->constrained('roles', 'role_id')
                ->cascadeOnDelete();
            $table->foreignId('department_id')
                ->nullable()
                ->constrained('departments', 'department_id')
                ->nullOnDelete();

            // Who invited them
            $table->foreignId('invited_by')
                ->constrained('users')
                ->cascadeOnDelete();

            // The token (hashed, never stored plaintext)
            $table->string('token_hash', 64)->unique();

            // Lifecycle
            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('last_sent_at');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invitations');
    }
};
