<?php

namespace App\Modules\IAM\Services;

use App\Mail\EmailVerificationMail;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;

class EmailVerificationService
{
    /**
     * How long a verification link stays valid.
     */
    private const LINK_TTL_MINUTES = 60;

    public function __construct(private AuditService $audit) {}

    /**
     * Mail a signed verification link to the user.
     */
    public function send(User $user, ?string $ip = null, ?string $ua = null): void
    {
        if ($user->email_verified_at !== null) {
            throw new AuthorizationException('This email is already verified.');
        }

        $url = URL::temporarySignedRoute('verification.verify', now()->addMinutes(self::LINK_TTL_MINUTES), [
            'id' => $user->getKey(),
            'hash' => sha1($user->email),
        ]);

        Mail::to($user->email)->send(new EmailVerificationMail($user, $url));

        $this->audit->log('email.verification.sent', $user, [
            'ip' => $ip,
            'ua' => $ua,
        ]);
    }

    /**
     * Consume a signed verification link.
     *
     * The signature proves the link was issued by us; the hash proves it was
     * issued for this user's current email address.
     */
    public function verify(int $id, string $hash): User
    {
        $user = User::find($id);

        if (! $user || ! hash_equals(sha1($user->email), $hash)) {
            throw new AuthorizationException('Invalid verification link.');
        }

        if ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();

            $this->audit->log('email.verification.completed', $user);
        }

        return $user;
    }
}
