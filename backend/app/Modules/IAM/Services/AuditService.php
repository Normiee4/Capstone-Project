<?php

namespace App\Modules\IAM\Services;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

class AuditService
{
    public function log(string $event, ?Model $subject = null, array $metadata = []): void
    {
        Log::info('audit: '.$event, [
            'user_id' => auth('sanctum')->id(),            
            'subject_id' => $subject?->getKey(),
            'subject_type' => $subject ? get_class($subject) : null,
            'metadata' => $metadata,
            'ip' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'at' => now()->toIso8601String(),
        ]);
    }
}
