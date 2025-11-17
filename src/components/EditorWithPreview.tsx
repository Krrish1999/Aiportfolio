'use client';

import React, { useState } from 'react';
import { ParsedResumeData, ValidationError } from '../types';
import { ContentEditor } from './editor/ContentEditor';
import { PreviewPanel } from './preview/PreviewPanel';

interface EditorWithPreviewProps {
  initialData: ParsedResumeData;
  onPublish?: (data: ParsedResumeData) => void;
}

export function EditorWithPreview({ initialData, onPublish }: EditorWithPreviewProps) {
  const [data, setData] = useState<ParsedResumeData>(initialData);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [viewMode, setViewMode] = useState<'split' | 'editor' | 'preview'>('split');

  const handleDataChange = (newData: ParsedResumeData) => {
    setData(newData);
  };

  const handlePublish = () => {
    if (validationErrors.some(e => e.severity === 'error')) {
      alert('Please fix all errors before publishing');
      return;
    }
    onPublish?.(data);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Portfolio Editor</h1>
            <p className="text-sm text-gray-500 mt-1">
              Edit your content and preview in real-time
            </p>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('editor')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'editor'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Editor
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'split'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Split
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Preview
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Panel */}
        {(viewMode === 'editor' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} border-r border-gray-200 overflow-hidden`}>
            <ContentEditor
              data={data}
              onChange={handleDataChange}
              onValidationChange={setValidationErrors}
            />
          </div>
        )}

        {/* Preview Panel */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} overflow-hidden`}>
            <PreviewPanel
              data={data}
              onPublish={handlePublish}
            />
          </div>
        )}
      </div>
    </div>
  );
}
