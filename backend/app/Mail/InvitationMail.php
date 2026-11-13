<?php

namespace App\Mail;


use App\Models\Invitation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * Create a new message instance.
     */
    public function __construct(public Invitation $invitation, public string $plainToken,) {}

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Invitation Mail',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        $url = url("/accept-invitation?token={$this->plainToken}");
        $roleName = $this->invitation->role->role_name;
        $expiry = $this->invitation->expires_at->format('Y-m-d H:i');  
        
        $html = '<!DOCTYPE html>'
            . '<html><body style="font-family:sans-serif;max-width:600px;margin:40px auto;color:#333;">'
            . '<h1>You have been invited</h1>'
            . '<p>You have been invited to join the iFixz Workspace as <strong>' . e($roleName) . '</strong>.</p>'
            . '<p>Click the button below to accept your invitation and set your password:</p>'
            . '<p style="margin:30px 0;">'
            . '<a href="' . e($url) . '" style="background:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">'
            . 'Accept Invitation'
            . '</a>'
            . '</p>'
            . '<p>Or paste this link in your browser:<br>'
            . '<a href="' . e($url) . '">' . e($url) . '</a>'
            . '</p>'
            . '<p style="color:#666;font-size:13px;">'
            . 'This invitation expires at ' . e($expiry) . '. '
            . 'If you did not expect this email, you can safely ignore it.'
            . '</p>'
            . '</body></html>';

        return new Content(html: $html);
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
