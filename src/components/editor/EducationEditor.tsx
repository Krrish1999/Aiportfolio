'use client';

import React from 'react';
import { FormField } from '../forms/FormField';
import { ParsedResumeData, ValidationError } from '../../types';

interface EducationEditorProps {
  education: ParsedResumeData['education'];
  onChange: (education: ParsedResumeData['education']) => void;
  errors?: ValidationError[];
}

export function EducationEditor({ education, onChange, errors = [] }: EducationEditorProps) {
  const getError = (index: number, field: string) => 
    errors.find(e => e.field === `education.${index}.${field}`)?.message;

  const handleChange = (index: number, field: keyof ParsedResumeData['education'][0], value: any) => {
    const updated = [...education];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addEducation = () => {
    onChange([...education, {
      degree: '',
      institution: '',
      startDate: new Date(),
      confidence: 1.0
    }]);
  };

  const removeEducation = (index: number) => {
    onChange(education.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Education</h2>
        <button
          onClick={addEducation}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          + Add Education
        </button>
      </div>

      {education.map((edu, index) => (
        <div key={index} className="p-6 border border-gray-200 rounded-lg space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Education {index + 1}</h3>
            <button
              onClick={() => removeEducation(index)}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              Remove
            </button>
          </div>

          <FormField 
            label="Degree" 
            required 
            confidence={edu.confidence}
            error={getError(index, 'degree')}
          >
            <input
              type="text"
              value={edu.degree}
              onChange={(e) => handleChange(index, 'degree', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Bachelor of Science in Computer Science"
            />
          </FormField>

          <FormField 
            label="Institution" 
            required 
            confidence={edu.confidence}
            error={getError(index, 'institution')}
          >
            <input
              type="text"
              value={edu.institution}
              onChange={(e) => handleChange(index, 'institution', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="University Name"
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Start Date" required error={getError(index, 'startDate')}>
              <input
                type="date"
                value={edu.startDate instanceof Date ? edu.startDate.toISOString().split('T')[0] : ''}
                onChange={(e) => handleChange(index, 'startDate', new Date(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </FormField>

            <FormField label="End Date" error={getError(index, 'endDate')}>
              <input
                type="date"
                value={edu.endDate instanceof Date ? edu.endDate.toISOString().split('T')[0] : ''}
                onChange={(e) => handleChange(index, 'endDate', e.target.value ? new Date(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </FormField>
          </div>

          <FormField label="GPA" error={getError(index, 'gpa')}>
            <input
              type="text"
              value={edu.gpa || ''}
              onChange={(e) => handleChange(index, 'gpa', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="3.8 / 4.0"
            />
          </FormField>
        </div>
      ))}
    </div>
  );
}
