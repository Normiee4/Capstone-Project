<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('/auth/refresh', [AuthController::class, 'refresh'])->middleware('throttle:login');
    Route::post('/auth/password-reset-request', [PasswordResetController::class, 'request'])->middleware('throttle:login');
    Route::post('/auth/reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:login');

    Route::middleware(['auth:sanctum', 'user.active'])->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);

        Route::get('/users', [UserController::class, 'index'])->middleware('can:users.view');
        Route::post('/users', [UserController::class, 'store'])->middleware('can:users.create');
        Route::get('/users/{user}', [UserController::class, 'show'])->middleware('can:users.view,user');
        Route::put('/users/{user}', [UserController::class, 'update'])->middleware('can:users.update,user');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->middleware('can:users.delete,user');
        Route::post('/users/{user}/password-reset', [UserController::class, 'sendPasswordReset'])->middleware('can:users.reset_password,user');
    });
});
