<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The permissions.action enum needs the 'invite', 'manage_users' and
     * 'reset_password' verbs for the user management / invitation feature.
     * SQLite (used by the test suite) stores the action as a plain string, so
     * only MySQL needs the column altered.
     */
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE `permissions` MODIFY COLUMN `action` ENUM('register','activate','deactivate','delete','run_pipeline','configure_adapter','create','read','update','archive','invite','manage_users','reset_password') NOT NULL");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE `permissions` MODIFY COLUMN `action` ENUM('register','activate','deactivate','delete','run_pipeline','configure_adapter','create','read','update','archive') NOT NULL");
    }
};
