<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Modules\IAM\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function __construct(private AuthService $authService) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->only('email', 'password');
        $ip = $request->ip();
        $ua = $request->userAgent();

        $result = $this->authService->login($credentials['email'], $credentials['password'], $ip, $ua);

        return response()->json([
            'user' => new UserResource($result['user']),
            'token' => $result['token'],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        /** @var User */
        $user = Auth::user();

        if ($user) {
            $this->authService->logout($user);
        }

        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User */
        $user = Auth::user();

        return response()->json(new UserResource($user));
    }
}
