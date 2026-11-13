<?php

namespace App\Support;

/**
 * Fixed catalog of actionable permissions.
 *
 * Constants map to your DB enum values (verbs), not to dotted strings.
 * Semantic names (USERS_VIEW) alias the underlying verb (read) so call
 * sites read meaningfully while the DB stays compact.
 */
final class Action
{
    public const READ              = 'read';
    public const CREATE            = 'create';
    public const UPDATE            = 'update';
    public const ARCHIVE           = 'archive';
    public const DELETE            = 'delete';
    public const REGISTER          = 'register';
    public const INVITE            = 'invite';
    public const MANAGE_USERS      = 'manage_users';
    public const RESET_PASSWORD    = 'reset_password';
    public const ACTIVATE          = 'activate';
    public const DEACTIVATE        = 'deactivate';
    public const RUN_PIPELINE      = 'run_pipeline';
    public const CONFIGURE_ADAPTER = 'configure_adapter';

    public static function all(): array
    {
        return [
            self::READ, self::CREATE, self::UPDATE, self::ARCHIVE,
            self::DELETE, self::REGISTER, self::INVITE, self::ACTIVATE,
            self::DEACTIVATE, self::RUN_PIPELINE, self::CONFIGURE_ADAPTER,
            self::MANAGE_USERS, self::RESET_PASSWORD,
        ];
    }
}
