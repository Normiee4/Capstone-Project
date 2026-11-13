<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmailVerificationController;
use App\Http\Controllers\InvitationController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('/auth/refresh', [AuthController::class, 'refresh'])->middleware('throttle:login');
    Route::post('/auth/password-reset-request', [PasswordResetController::class, 'request'])->middleware('throttle:login');
    Route::post('/auth/reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:login');

    // Public: the token in the link is the credential.
    Route::get('/invitations/{token}', [InvitationController::class, 'show'])->middleware('throttle:invitation');
    Route::post('/invitations/accept', [InvitationController::class, 'accept'])->middleware('throttle:invitation');
    Route::get('/auth/email-verification/verify', [EmailVerificationController::class, 'verify'])
        ->name('verification.verify')
        ->middleware(['signed', 'throttle:invitation']);

    Route::middleware(['auth:sanctum', 'user.active'])->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/email-verification/send', [EmailVerificationController::class, 'send'])->middleware('throttle:login');

        Route::get('/users', [UserController::class, 'index'])->middleware('can:manage_users');
        Route::post('/users', [UserController::class, 'store'])->middleware('can:manage_users');
        Route::get('/users/{user}', [UserController::class, 'show'])->middleware('can:manage_users,user');
        Route::put('/users/{user}', [UserController::class, 'update'])->middleware('can:manage_users,user');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->middleware('can:manage_users,user');
        Route::post('/users/{user}/password-reset', [UserController::class, 'sendPasswordReset'])->middleware('can:reset_password,user');

        Route::post('/users/invite', [InvitationController::class, 'store'])->middleware('can:invite');
        Route::post('/users/invite/resend', [InvitationController::class, 'resend'])->middleware('can:invite');
    });
});
