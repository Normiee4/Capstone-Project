<?php

namespace App\Http\Controllers;

use App\Http\Requests\RequestPasswordResetRequest;
use App\Http\Requests\ResetPasswordRequest;
use App\Modules\IAM\Services\PasswordResetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class PasswordResetController extends Controller
{
    public function __construct(private PasswordResetService $passwordReset) {}

    public function request(RequestPasswordResetRequest $request): JsonResponse
    {
        $this->passwordReset->request($request->validated('email'));

        return response()->json([
            'message' => 'If the account exists, the administrator has been notified.',
        ]);
    }

    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        $status = $this->passwordReset->reset($request->validated());

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => [__($status)]]);
        }

        return response()->json(['message' => 'Password has been reset.']);
    }
}
