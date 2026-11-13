<?php

namespace App\Providers;

use App\Models\User;
use App\Support\Action;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
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

        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(5)->by($request->input('email').'|'.$request->ip());
        });

        RateLimiter::for('invitation', function (Request $request) {
            return Limit::perMinute(10)->by($request->ip());
        });

       foreach (Action::all() as $action) {
            Gate::define($action, function (User $user, ?Model $target = null) use ($action) {
                
                // Pass the action name and the optional target model to your RBAC system
                return $user->hasAction($action, $target);
                
            });
        }   
    }
}
