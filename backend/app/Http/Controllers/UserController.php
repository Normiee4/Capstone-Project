<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Modules\IAM\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(private UserService $userService)
    {
    }

    public function index(Request $request)
    {
        $query = User::query();

        if ($request->user()->role?->role_name === 'dept_head') {
            $query->where('department_id', $request->user()->department_id)
                  ->whereHas('role', fn ($q) => $q->where('role_name', 'employee'));
        }

        return UserResource::collection($query->get());
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = $this->userService->create($request->validated());   

        return (new UserResource($user))
            ->response()
            ->setStatusCode(201);
    }

    public function show(User $user)
    {
        return new UserResource($user);
    }

    public function update(UpdateUserRequest $request, User $user)
    {
        $user = $this->userService->update($user, $request->validated());  

        return new UserResource($user);
    }

    public function destroy(User $user): JsonResponse
    {
        $this->userService->delete($user);  

        return response()->json(['message' => 'User deleted successfully']);
    }
}