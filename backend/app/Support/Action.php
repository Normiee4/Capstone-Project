<?php

namespace App\Support;

/**
 * Fixed catalog of actionable permissions.
 *
 * An action describes WHAT can be done. The scope (all|department) stored
 * alongside it in the permissions table describes HOW WIDE the actor may
 * act, and is enforced against the target record by User::hasAction().
 */
final class Action
{
    // User and access governance
    public const USERS_VIEW = 'users.view';

    public const USERS_INVITE = 'users.invite';

    public const USERS_CREATE = 'users.create';

    public const USERS_UPDATE = 'users.update';

    public const USERS_RESET_PASSWORD = 'users.reset_password';

    public const USERS_DISABLE = 'users.disable';

    public const USERS_ARCHIVE = 'users.archive';

    public const USERS_DELETE = 'users.delete';

    public const ROLES_ASSIGN = 'roles.assign';

    public const PERMISSIONS_MANAGE = 'permissions.manage';

    public const AUDIT_VIEW = 'audit.view';

    // Workspace operations
    public const MODULES_MANAGE = 'modules.manage';

    public const PIPELINE_RUN = 'pipeline.run';

    public const BACKUPS_MANAGE = 'backups.manage';

    public const MONITORING_VIEW = 'monitoring.view';

    // Business records
    public const RECORDS_VIEW = 'records.view';

    public const RECORDS_CREATE = 'records.create';

    public const RECORDS_UPDATE = 'records.update';

    public const RECORDS_ARCHIVE = 'records.archive';

    public const RECORDS_APPROVE = 'records.approve';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::USERS_VIEW,
            self::USERS_INVITE,
            self::USERS_CREATE,
            self::USERS_UPDATE,
            self::USERS_RESET_PASSWORD,
            self::USERS_DISABLE,
            self::USERS_ARCHIVE,
            self::USERS_DELETE,
            self::ROLES_ASSIGN,
            self::PERMISSIONS_MANAGE,
            self::AUDIT_VIEW,
            self::MODULES_MANAGE,
            self::PIPELINE_RUN,
            self::BACKUPS_MANAGE,
            self::MONITORING_VIEW,
            self::RECORDS_VIEW,
            self::RECORDS_CREATE,
            self::RECORDS_UPDATE,
            self::RECORDS_ARCHIVE,
            self::RECORDS_APPROVE,
        ];
    }
}
