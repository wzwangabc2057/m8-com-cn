'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// Dynamic import to avoid SSR issues with Swagger UI
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { 
  ssr: false,
  loading: () => <div className="p-10 text-center">Loading API Docs...</div>
});

export default function OpenApiPage() {
  return (
    <div className="container mx-auto p-6 bg-white min-h-screen">
      <div className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold">API Documentation</h1>
        <p className="text-gray-500">
          Use your CMS API Key (Bearer Token) to authenticate. 
          You can find it in your project credentials.
        </p>
      </div>
      <SwaggerUI url="/api/openapi.json" />
    </div>
  );
}
