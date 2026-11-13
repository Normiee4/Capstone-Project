<?php

namespace App\Http\Controllers;

use App\Http\Requests\AcceptInvitationRequest;
use App\Http\Requests\InvitationRequest;
use App\Http\Resources\UserResource;
use App\Models\Invitation;
use App\Models\Role;
use App\Modules\IAM\Services\UserService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvitationController extends Controller
{
    public function __construct(private UserService $users) {}

    /**
     * Invite a user to the workspace.
     */
    public function store(InvitationRequest $request): JsonResponse
    {
        $invitation = $this->users->createInvite(
            $request->user(),
            $request->validated('email'),
            $this->roleName((int) $request->validated('role_id')),
            $request->validated('department_id'),
            $request->ip(),
            $request->userAgent(),
        );

        return response()->json([
            'message' => 'Invitation sent.',
            'invitation_id' => $invitation->id,
            'expires_at' => $invitation->expires_at?->toIso8601String(),
        ], 201);
    }

    /**
     * Re-send an invitation that was never used or has expired.
     */
    public function resend(InvitationRequest $request): JsonResponse
    {
        $invitation = $this->users->resendInvite(
            $request->user(),
            $request->validated('email'),
            $this->roleName((int) $request->validated('role_id')),
            $request->validated('department_id'),
            $request->ip(),
            $request->userAgent(),
        );

        return response()->json([
            'message' => 'Invitation re-sent.',
            'invitation_id' => $invitation->id,
            'expires_at' => $invitation->expires_at?->toIso8601String(),
        ]);
    }

    /**
     * Look up an invitation by its token, so the accept form can show what is
     * being accepted. The token is the only credential here.
     */
    public function show(string $token): JsonResponse
    {
        $invitation = Invitation::where('token_hash', hash('sha256', $token))->first();

        if (! $invitation) {
            throw new AuthorizationException('This invitation is invalid or has expired.');
        }

        return response()->json([
            'email' => $invitation->email,
            'role' => $invitation->role?->role_name,
            'expires_at' => $invitation->expires_at?->toIso8601String(),
            'expired' => $invitation->isExpired(),
            'accepted' => $invitation->isAccepted(),
        ]);
    }

    /**
     * Accept an invitation: set the name and password, activate the account.
     */
    public function accept(AcceptInvitationRequest $request): JsonResponse
    {
        $user = $this->users->acceptInvite($request->validated('token'), [
            'name' => $request->validated('name'),
            'password' => $request->validated('password'),
        ]);

        return response()->json([
            'message' => 'Invitation accepted. You can now sign in.',
            'user' => new UserResource($user),
        ]);
    }

    private function roleName(int $roleId): string
    {
        return (string) Role::where('role_id', $roleId)->value('role_name');
    }
}
