'use client';

import React from 'react';
import { confidenceUtils } from '../../utils/confidence';

interface FormFieldProps {
  label: string;
  error?: string;
  confidence?: number;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ 
  label, 
  error, 
  confidence, 
  required = false, 
  children, 
  className = '' 
}: FormFieldProps) {
  const showConfidence = confidence !== undefined;
  const needsAttention = confidence !== undefined && confidenceUtils.requiresAttention(confidence);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {showConfidence && (
          <div className="flex items-center space-x-2">
            <span className={`text-xs font-medium ${confidenceUtils.getConfidenceColor(confidence!)}`}>
              {confidenceUtils.getConfidenceLabel(confidence!)} Confidence
            </span>
            {needsAttention && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Review Needed
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className={needsAttention ? 'ring-2 ring-yellow-300 rounded-md' : ''}>
        {children}
      </div>
      
      {error && (
        <p className="text-sm text-red-600 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}