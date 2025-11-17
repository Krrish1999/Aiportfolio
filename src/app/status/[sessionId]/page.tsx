'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface StatusData {
  status: ProcessingStatus;
  progress?: number;
  message?: string;
  error?: string;
  parsedData?: any;
}

export default function StatusPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  
  const [status, setStatus] = useState<StatusData>({ status: 'pending' });
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!sessionId || !polling) return;

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/status/${sessionId}`);
        if (!response.ok) throw new Error('Failed to fetch status');
        
        const data = await response.json() as StatusData;
        setStatus(data);

        if (data.status === 'completed') {
          setPolling(false);
          // Redirect to editor after a short delay
          setTimeout(() => {
            router.push(`/editor/${sessionId}`);
          }, 2000);
        } else if (data.status === 'failed') {
          setPolling(false);
        }
      } catch (error) {
        console.error('Error checking status:', error);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 2000);

    return () => clearInterval(interval);
  }, [sessionId, polling, router]);

  const getStatusMessage = () => {
    switch (status.status) {
      case 'pending':
        return 'Waiting to process your resume...';
      case 'processing':
        return status.message || 'Processing your resume...';
      case 'completed':
        return 'Resume processed successfully! Redirecting to editor...';
      case 'failed':
        return status.error || 'Failed to process resume';
      default:
        return 'Unknown status';
    }
  };

  const getProgressColor = () => {
    switch (status.status) {
      case 'completed':
        return 'bg-green-600';
      case 'failed':
        return 'bg-red-600';
      default:
        return 'bg-blue-600';
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Processing Your Resume
          </h1>
          <p className="text-gray-600">
            Session ID: {sessionId}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          {/* Status Icon */}
          <div className="flex justify-center">
            {status.status === 'completed' ? (
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : status.status === 'failed' ? (
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            ) : (
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
          </div>

          {/* Status Message */}
          <div className="text-center">
            <p className="text-lg font-medium text-gray-900">
              {getStatusMessage()}
            </p>
          </div>

          {/* Progress Bar */}
          {status.progress !== undefined && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
                style={{ width: `${status.progress}%` }}
              />
            </div>
          )}

          {/* Action Buttons */}
          {status.status === 'failed' && (
            <div className="space-y-3">
              <button
                onClick={() => router.push('/')}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
