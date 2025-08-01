// app/terms-of-service/page.tsx

'use client';

import React from 'react';
import TermsOfServiceClient from './TermsOfServiceClient';

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Terms of Service</h1>
      <TermsOfServiceClient />
    </div>
  );
}
