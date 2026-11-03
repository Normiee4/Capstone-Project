<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        Gate::define('iam.users.view',   fn ($u) => $u->hasPermission('read',   'iam', 'all'));
        Gate::define('iam.users.create', fn ($u) => $u->hasPermission('create', 'iam', 'all'));
        Gate::define('iam.users.update', fn ($u) => $u->hasPermission('update', 'iam', 'all'));
        Gate::define('iam.users.delete', fn ($u) => $u->hasPermission('delete', 'iam', 'all'));
    }
}
