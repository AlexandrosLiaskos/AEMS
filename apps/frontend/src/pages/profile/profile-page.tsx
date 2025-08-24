import React from 'react';
import { useAuth } from '@/providers/auth-provider';

/**
 * @component ProfilePage
 * @purpose User profile management page
 */
export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="text-muted-foreground">
          Manage your account information and preferences.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center space-x-6">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
            {user?.picture ? (
              <img 
                src={user.picture} 
                alt={user.name} 
                className="w-20 h-20 rounded-full"
              />
            ) : (
              <span className="text-2xl font-medium text-muted-foreground">
                {user?.name?.charAt(0) || 'U'}
              </span>
            )}
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {user?.name || 'User'}
            </h2>
            <p className="text-muted-foreground">
              {user?.email || 'user@example.com'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Role: {user?.role || 'user'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <svg className="w-12 h-12 text-muted-foreground mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <h3 className="text-lg font-medium text-foreground mb-2">
          Profile Management Coming Soon
        </h3>
        <p className="text-muted-foreground">
          This page will include profile editing, password changes, and account preferences.
        </p>
      </div>
    </div>
  );
}