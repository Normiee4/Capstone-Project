<?php

namespace Tests\Feature\Auth;

use App\Mail\EmailVerificationMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class EmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    private function captureUrl(): string
    {
        $url = null;

        Mail::assertSent(EmailVerificationMail::class, function (EmailVerificationMail $mail) use (&$url) {
            $url = $mail->url;

            return true;
        });

        $this->assertNotNull($url, 'No verification email was sent.');

        return $url;
    }

    public function test_unverified_user_receives_a_signed_link(): void
    {
        Mail::fake();

        $user = User::factory()->unverified()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/email-verification/send')
            ->assertOk()
            ->assertJsonPath('message', 'Verification link sent.');

        $this->assertStringContainsString('signature=', $this->captureUrl());
    }

    public function test_clicking_the_signed_link_verifies_the_email(): void
    {
        Mail::fake();

        $user = User::factory()->unverified()->create();

        $this->actingAs($user, 'sanctum')->postJson('/api/v1/auth/email-verification/send')->assertOk();

        $this->getJson($this->captureUrl())
            ->assertOk()
            ->assertJsonPath('email', $user->email);

        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_a_tampered_link_is_rejected(): void
    {
        Mail::fake();

        $user = User::factory()->unverified()->create();

        $this->actingAs($user, 'sanctum')->postJson('/api/v1/auth/email-verification/send')->assertOk();

        $tampered = str_replace('hash=', 'hash=x', $this->captureUrl());

        $this->getJson($tampered)->assertForbidden();

        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_a_link_for_another_email_is_rejected(): void
    {
        Mail::fake();

        $user = User::factory()->unverified()->create();
        $other = User::factory()->unverified()->create();

        $this->actingAs($user, 'sanctum')->postJson('/api/v1/auth/email-verification/send')->assertOk();

        $url = str_replace(
            'hash=' . sha1($user->email),
            'hash=' . sha1($other->email),
            $this->captureUrl(),
        );

        $this->getJson($url)->assertForbidden();
    }

    public function test_verified_user_cannot_request_another_link(): void
    {
        Mail::fake();

        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/email-verification/send')
            ->assertForbidden();

        Mail::assertNothingSent();
    }
}
