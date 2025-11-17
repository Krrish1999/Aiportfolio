'use client';

import React, { useState } from 'react';
import { ParsedResumeData, Template } from '../../types';
import { TemplatePreview, CustomizationState } from './TemplatePreview';
import { TemplateSelector } from './TemplateSelector';
import { CustomizationPanel } from './CustomizationPanel';

interface PreviewPanelProps {
  data: ParsedResumeData;
  onPublish?: () => void;
}

// Default templates
const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean and simple design',
    category: 'minimal',
    sections: [],
    customizations: [],
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Contemporary professional look',
    category: 'modern',
    sections: [],
    customizations: [],
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Bold and expressive design',
    category: 'creative',
    sections: [],
    customizations: [],
  },
];

const DEFAULT_CUSTOMIZATIONS: CustomizationState = {
  theme: 'light',
  primaryColor: '#3B82F6',
  fontFamily: 'Inter, sans-serif',
  fontSize: 'medium',
  sectionOrder: ['profile', 'summary', 'skills', 'experience', 'projects', 'education', 'certifications'],
  hiddenSections: [],
};

export function PreviewPanel({ data, onPublish }: PreviewPanelProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(DEFAULT_TEMPLATES[0]);
  const [customizations, setCustomizations] = useState<CustomizationState>(DEFAULT_CUSTOMIZATIONS);
  const [showCustomization, setShowCustomization] = useState(false);

  return (
    <div className="flex h-full">
      {/* Preview Area */}
      <div className="flex-1 overflow-y-auto bg-gray-100">
        <div className="p-4">
          {/* Preview Header */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
              <p className="text-sm text-gray-500">See how your portfolio looks</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowCustomization(!showCustomization)}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  showCustomization
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Customize
              </button>
              {onPublish && (
                <button
                  onClick={onPublish}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Publish
                </button>
              )}
            </div>
          </div>

          {/* Preview Content */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <TemplatePreview
              data={data}
              template={selectedTemplate}
              customizations={customizations}
            />
          </div>
        </div>
      </div>

      {/* Customization Sidebar */}
      {showCustomization && (
        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Customize</h2>
              <button
                onClick={() => setShowCustomization(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close customization panel"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <TemplateSelector
              templates={DEFAULT_TEMPLATES}
              selectedTemplate={selectedTemplate}
              onTemplateChange={setSelectedTemplate}
            />

            <div className="border-t border-gray-200 pt-6">
              <CustomizationPanel
                customizations={customizations}
                onCustomizationChange={setCustomizations}
                availableSections={DEFAULT_CUSTOMIZATIONS.sectionOrder}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
