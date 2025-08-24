import React from 'react';

/**
 * @component EmailsPage
 * @purpose Email list and management page
 */
export default function EmailsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Emails</h1>
        <p className="text-muted-foreground">
          Manage and process your emails with AI-powered classification.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <svg className="w-12 h-12 text-muted-foreground mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <h3 className="text-lg font-medium text-foreground mb-2">
          Email Management Coming Soon
        </h3>
        <p className="text-muted-foreground">
          This page will show your email list with AI classification and processing features.
        </p>
      </div>
    </div>
  );
}