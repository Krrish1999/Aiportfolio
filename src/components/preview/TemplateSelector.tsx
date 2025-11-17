'use client';

import React from 'react';
import { Template } from '../../types';

interface TemplateSelectorProps {
  templates: Template[];
  selectedTemplate: Template;
  onTemplateChange: (template: Template) => void;
}

export function TemplateSelector({ templates, selectedTemplate, onTemplateChange }: TemplateSelectorProps) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Template</h3>
      <div className="grid grid-cols-3 gap-3">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onTemplateChange(template)}
            className={`p-3 rounded-lg border-2 transition-all ${
              selectedTemplate.id === template.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="text-left">
              <p className={`font-medium text-sm ${
                selectedTemplate.id === template.id ? 'text-blue-900' : 'text-gray-900'
              }`}>
                {template.name}
              </p>
              <p className="text-xs text-gray-500 mt-1">{template.category}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
