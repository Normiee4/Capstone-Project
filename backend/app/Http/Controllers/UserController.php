<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Modules\IAM\Services\PasswordResetService;
use App\Modules\IAM\Services\UserService;
use App\Support\Action;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    // constructor for using UserService Business Logic
    public function __construct(
        private UserService $userService,
        private PasswordResetService $passwordReset,
    ) {}


    // display records with Eager Loading and Pagination
    public function index(Request $request)
    {
        $actor = $request->user(); 

        $query = User::query()->with(['role.permissions', 'department']);

        // if actor is not super admin, find dept id and its role (dept head or dept employee)
        if ($actor->role?->role_name !== 'super_admin') {
            $query->where('department_id', $actor->department_id)
                ->whereHas('role', fn ($q) => $q->where('role_name', 'employee'));
        }

        return UserResource::collection($query->paginate(15));
    }

    // CREATE USER 
    public function store(StoreUserRequest $request): JsonResponse
    {
        $data = $request->validated();

        $this->guardProvisioning($request->user(), $data);

        $user = $this->userService->create($data);

        return (new UserResource($user))
            ->response()
            ->setStatusCode(201);
    }

    public function show(User $user)
    {
        return new UserResource($user->loadMissing(['role.permissions', 'department']));
    }

    public function update(UpdateUserRequest $request, User $user)
    {
        $data = $request->validated();

        $this->guardUpdate($request->user(), $user, $data);

        $user = $this->userService->update($user, $data);

        return new UserResource($user->loadMissing(['role.permissions', 'department']));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->guardDelete($request->user(), $user);

        $this->userService->delete($user);

        return response()->json(['message' => 'User deleted successfully']);
    }

    public function sendPasswordReset(User $user): JsonResponse
    {
        $this->passwordReset->sendLink($user);

        return response()->json(['message' => 'Password reset link sent.']);
    }

    /**
     * Super Admin may provision any account. A Department Head may only
     * invite employees into their own department.
     *
     * @param  array<string, mixed>  $data
     */
    private function guardProvisioning(User $actor, array $data): void
    {
        // scope 'all' is the super admin; a department-scoped grant may only
        // create employees inside the actor's own department.
        if ($this->grant($actor, Action::MANAGE_USERS)?->scope === 'all') {
            return;
        }

        $employeeRoleId = Role::where('role_name', 'employee')->value('role_id');

        abort_unless(
            (int) ($data['role_id'] ?? 0) === (int) $employeeRoleId
            && (int) ($data['department_id'] ?? 0) === (int) $actor->department_id,
            403,
            'Department heads may only invite employees into their own department.',
        );
    }

    /**
     * A Department Head may update employees in their own department only,
     * and may not reassign roles/departments or force invitation states.
     *
     * @param  array<string, mixed>  $data
     */
    private function guardUpdate(User $actor, User $target, array $data): void
    {
        if ($this->grant($actor, Action::MANAGE_USERS)?->scope === 'all') {
            return;
        }

        abort_unless($target->role?->role_name === 'employee', 403);

        if (array_key_exists('role_id', $data)
            && $data['role_id'] !== null
            && (int) $data['role_id'] !== (int) $target->role_id) {
            abort(403, 'You may not change the role of this user.');
        }

        if (array_key_exists('department_id', $data)
            && $data['department_id'] !== null
            && (int) $data['department_id'] !== (int) $target->department_id) {
            abort(403, 'You may not move this user to another department.');
        }

        if (array_key_exists('status', $data)
            && $data['status'] !== null
            && ! in_array($data['status'], ['active', 'suspended'], true)) {
            abort(403, 'You may only enable or disable this user.');
        }
    }

private function guardDelete(User $actor, User $target): void
    {
        abort_if($actor->id === $target->id, 403, 'You cannot delete your own account.');

        // only a super admin may delete accounts
        abort_unless(
            $this->grant($actor, Action::MANAGE_USERS)?->scope === 'all',
            403,
            'You may not delete accounts.',
        );

        $superAdminRoleId = Role::where('role_name', 'super_admin')->value('role_id');

        if ((int) $target->role_id === (int) $superAdminRoleId) {
            $otherSuperAdmins = User::where('role_id', $superAdminRoleId)
                ->whereKeyNot($target->getKey())
                ->count();

            abort_if($otherSuperAdmins === 0, 403, 'You may not delete the last super admin.');
        }
    }

    /**
     * The actor's grant for an action, if the actor's role has one.
     */
    private function grant(User $actor, string $action): ?Permission
    {
        return $actor->role?->permissions->firstWhere('action', $action);
    }
}
