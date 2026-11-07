<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PasswordResetRequested extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public User $requester) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Password reset requested')
            ->line("{$this->requester->name} ({$this->requester->email}) requested a password reset.")
            ->line('Send them a reset link from the user management screen to continue.');
    }
}
