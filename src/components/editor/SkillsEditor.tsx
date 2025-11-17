'use client';

import React from 'react';
import { FormField } from '../forms/FormField';
import { ParsedResumeData, ValidationError } from '../../types';

interface SkillsEditorProps {
  skills: ParsedResumeData['skills'];
  onChange: (skills: ParsedResumeData['skills']) => void;
  errors?: ValidationError[];
}

export function SkillsEditor({ skills, onChange, errors = [] }: SkillsEditorProps) {
  const getError = (index: number, field: string) => 
    errors.find(e => e.field === `skills.${index}.${field}`)?.message;

  const handleChange = (index: number, field: keyof ParsedResumeData['skills'][0], value: any) => {
    const updated = [...skills];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addSkillCategory = () => {
    onChange([...skills, {
      category: '',
      items: [],
      confidence: 1.0
    }]);
  };

  const removeSkillCategory = (index: number) => {
    onChange(skills.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Skills</h2>
        <button
          onClick={addSkillCategory}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          + Add Category
        </button>
      </div>

      {skills.map((skillGroup, index) => (
        <div key={index} className="p-6 border border-gray-200 rounded-lg space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Category {index + 1}</h3>
            <button
              onClick={() => removeSkillCategory(index)}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              Remove
            </button>
          </div>

          <FormField 
            label="Category Name" 
            required 
            confidence={skillGroup.confidence}
            error={getError(index, 'category')}
          >
            <input
              type="text"
              value={skillGroup.category}
              onChange={(e) => handleChange(index, 'category', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Programming Languages, Frameworks, Tools"
            />
          </FormField>

          <FormField 
            label="Skills" 
            required 
            confidence={skillGroup.confidence}
            error={getError(index, 'items')}
          >
            <textarea
              value={skillGroup.items.join(', ')}
              onChange={(e) => handleChange(index, 'items', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="JavaScript, TypeScript, React, Node.js"
            />
            <p className="mt-1 text-sm text-gray-500">Separate skills with commas</p>
          </FormField>
        </div>
      ))}
    </div>
  );
}
