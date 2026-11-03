<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\AuditLogController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('/auth/login', [AuthController::class, 'login']);

    Route::middleware(['auth:sanctum', 'user.active'])->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);
    });

    // User Management
    //    verb, URI,    action                  ,middleware
    Route::post('/users', [UserController::class, 'store'])->middleware('can:iam.users.create');           
    Route::get('/users', [UserController::class, 'show'])->middleware('can:iam.users.view');           
    Route::put('/users', [UserController::class, 'update'])->middleware('can:iam.users.update');           
    Route::delete('/users', [UserController::class, 'destroy'])->middleware('can:iam.users.delete');           


});
