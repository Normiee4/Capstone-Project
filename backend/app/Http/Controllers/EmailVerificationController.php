<?php

namespace App\Http\Controllers;

use App\Modules\IAM\Services\EmailVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmailVerificationController extends Controller
{
    public function __construct(private EmailVerificationService $verification) {}

    /**
     * Mail a signed verification link to the signed-in user.
     */
    public function send(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $this->verification->send($user, $request->ip(), $request->userAgent());

        return response()->json(['message' => 'Verification link sent.']);
    }

    /**
     * Consume a signed verification link.
     */
    public function verify(Request $request): JsonResponse
    {
        $user = $this->verification->verify(
            $request->integer('id'),
            (string) $request->query('hash'),
        );

        return response()->json([
            'message' => 'Email verified.',
            'email' => $user->email,
        ]);
    }
}
