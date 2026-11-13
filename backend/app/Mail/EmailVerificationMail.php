<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class EmailVerificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public User $user, public string $url) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Verify your email address',
        );
    }

    public function content(): Content
    {
        $html = '<!DOCTYPE html>'
            . '<html><body style="font-family:sans-serif;max-width:600px;margin:40px auto;color:#333;">'
            . '<h1>Verify your email address</h1>'
            . '<p>Confirm that this is your email address to finish setting up your account.</p>'
            . '<p style="margin:30px 0;">'
            . '<a href="' . e($this->url) . '" style="background:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">'
            . 'Verify Email'
            . '</a>'
            . '</p>'
            . '<p>Or paste this link in your browser:<br>'
            . '<a href="' . e($this->url) . '">' . e($this->url) . '</a>'
            . '</p>'
            . '<p style="color:#666;font-size:13px;">'
            . 'This link expires in 60 minutes. If you did not expect this email, you can safely ignore it.'
            . '</p>'
            . '</body></html>';

        return new Content(html: $html);
    }

    public function attachments(): array
    {
        return [];
    }
}
