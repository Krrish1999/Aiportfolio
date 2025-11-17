'use client';

import React from 'react';
import { CustomizationState } from './TemplatePreview';

interface CustomizationPanelProps {
  customizations: CustomizationState;
  onCustomizationChange: (customizations: CustomizationState) => void;
  availableSections: string[];
}

const SECTION_LABELS: Record<string, string> = {
  profile: 'Profile',
  summary: 'Summary',
  skills: 'Skills',
  experience: 'Experience',
  projects: 'Projects',
  education: 'Education',
  certifications: 'Certifications',
};

const COLOR_OPTIONS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Orange', value: '#F59E0B' },
  { name: 'Pink', value: '#EC4899' },
];

const FONT_OPTIONS = [
  { name: 'Inter', value: 'Inter, sans-serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Open Sans', value: '"Open Sans", sans-serif' },
  { name: 'Lato', value: 'Lato, sans-serif' },
  { name: 'Montserrat', value: 'Montserrat, sans-serif' },
  { name: 'Poppins', value: 'Poppins, sans-serif' },
];

const FONT_SIZE_OPTIONS: Array<{ name: string; value: 'small' | 'medium' | 'large' }> = [
  { name: 'Small', value: 'small' },
  { name: 'Medium', value: 'medium' },
  { name: 'Large', value: 'large' },
];

export function CustomizationPanel({ customizations, onCustomizationChange, availableSections }: CustomizationPanelProps) {
  const updateCustomization = <K extends keyof CustomizationState>(
    key: K,
    value: CustomizationState[K]
  ) => {
    onCustomizationChange({ ...customizations, [key]: value });
  };

  const moveSectionUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...customizations.sectionOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    updateCustomization('sectionOrder', newOrder);
  };

  const moveSectionDown = (index: number) => {
    if (index === customizations.sectionOrder.length - 1) return;
    const newOrder = [...customizations.sectionOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    updateCustomization('sectionOrder', newOrder);
  };

  const toggleSectionVisibility = (section: string) => {
    const hiddenSections = customizations.hiddenSections || [];
    const isHidden = hiddenSections.includes(section);
    
    if (isHidden) {
      updateCustomization('hiddenSections', hiddenSections.filter(s => s !== section));
    } else {
      updateCustomization('hiddenSections', [...hiddenSections, section]);
    }
  };

  const isSectionVisible = (section: string) => {
    const hiddenSections = customizations.hiddenSections || [];
    return !hiddenSections.includes(section);
  };

  return (
    <div className="space-y-6">
      {/* Theme Toggle */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Theme</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => updateCustomization('theme', 'light')}
            className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
              customizations.theme === 'light'
                ? 'border-blue-600 bg-blue-50 text-blue-900'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
            }`}
          >
            Light
          </button>
          <button
            onClick={() => updateCustomization('theme', 'dark')}
            className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
              customizations.theme === 'dark'
                ? 'border-blue-600 bg-blue-50 text-blue-900'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
            }`}
          >
            Dark
          </button>
        </div>
      </div>

      {/* Primary Color */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Primary Color</h3>
        <div className="grid grid-cols-3 gap-2">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color.value}
              onClick={() => updateCustomization('primaryColor', color.value)}
              className={`p-3 rounded-lg border-2 transition-all ${
                customizations.primaryColor === color.value
                  ? 'border-gray-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <div
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: color.value }}
                />
                <span className="text-sm text-gray-700">{color.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Font Family */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Font</h3>
        <select
          value={customizations.fontFamily}
          onChange={(e) => updateCustomization('fontFamily', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font.value} value={font.value}>
              {font.name}
            </option>
          ))}
        </select>
      </div>

      {/* Font Size */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Font Size</h3>
        <div className="flex space-x-2">
          {FONT_SIZE_OPTIONS.map((size) => (
            <button
              key={size.value}
              onClick={() => updateCustomization('fontSize', size.value)}
              className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                customizations.fontSize === size.value
                  ? 'border-blue-600 bg-blue-50 text-blue-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {size.name}
            </button>
          ))}
        </div>
      </div>

      {/* Section Order and Visibility */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Section Order & Visibility</h3>
        <div className="space-y-2">
          {customizations.sectionOrder.map((section, index) => {
            const isVisible = isSectionVisible(section);
            const isRequired = section === 'profile';
            
            return (
              <div
                key={section}
                className={`flex items-center justify-between p-3 border rounded-lg transition-all ${
                  isVisible
                    ? 'bg-white border-gray-200'
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => toggleSectionVisibility(section)}
                    disabled={isRequired}
                    className={`flex-shrink-0 ${
                      isRequired ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    }`}
                    aria-label={`Toggle ${section} visibility`}
                  >
                    {isVisible ? (
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                  <span className={`text-sm font-medium ${isVisible ? 'text-gray-900' : 'text-gray-500'}`}>
                    {SECTION_LABELS[section] || section}
                  </span>
                  {isRequired && (
                    <span className="text-xs text-gray-500 italic">(required)</span>
                  )}
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => moveSectionUp(index)}
                    disabled={index === 0}
                    className={`p-1 rounded ${
                      index === 0
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    aria-label="Move up"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveSectionDown(index)}
                    disabled={index === customizations.sectionOrder.length - 1}
                    className={`p-1 rounded ${
                      index === customizations.sectionOrder.length - 1
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    aria-label="Move down"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
