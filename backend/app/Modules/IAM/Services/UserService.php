<?php

namespace App\Modules\IAM\Services;

use App\Models\User;

class UserService
{
    /**
     * Create a new class instance.
     */
    public function __construct(private AuditService $audit)
    {

    }


    // business logics on how audit logging of user actions works
    public function create(array $data) : User
    {
        $user = User::create($data); 
        $this->audit->log('user.created', $user);
        return $user;
    }

    public function update(User $user, array $data): User
    {
        $user->update($data);
        $this->audit->log('user.updated', $user);
        return $user;
    }

    public function delete(User $user): void
    {
        $user->delete();
        $this->audit->log('user.deleted', $user);
    }

    public function invite(string $email, int $roleId, ?int $departmentId): User
    {
        throw new \LogicException('IAM-06: invite flow not implemented.');
    }
}
