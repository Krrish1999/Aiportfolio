'use client';

import React from 'react';
import { FormField } from '../forms/FormField';
import { ParsedResumeData, ValidationError } from '../../types';

interface ExperienceEditorProps {
  experience: ParsedResumeData['experience'];
  onChange: (experience: ParsedResumeData['experience']) => void;
  errors?: ValidationError[];
}

export function ExperienceEditor({ experience, onChange, errors = [] }: ExperienceEditorProps) {
  const getError = (index: number, field: string) => 
    errors.find(e => e.field === `experience.${index}.${field}`)?.message;

  const handleChange = (index: number, field: keyof ParsedResumeData['experience'][0], value: any) => {
    const updated = [...experience];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleBulletChange = (expIndex: number, bulletIndex: number, value: string) => {
    const updated = [...experience];
    const bullets = [...updated[expIndex].bullets];
    bullets[bulletIndex] = value;
    updated[expIndex] = { ...updated[expIndex], bullets };
    onChange(updated);
  };

  const addBullet = (index: number) => {
    const updated = [...experience];
    updated[index] = { ...updated[index], bullets: [...updated[index].bullets, ''] };
    onChange(updated);
  };

  const removeBullet = (expIndex: number, bulletIndex: number) => {
    const updated = [...experience];
    const bullets = updated[expIndex].bullets.filter((_, i) => i !== bulletIndex);
    updated[expIndex] = { ...updated[expIndex], bullets };
    onChange(updated);
  };

  const addExperience = () => {
    onChange([...experience, {
      company: '',
      role: '',
      startDate: new Date(),
      bullets: [''],
      techStack: [],
      confidence: 1.0
    }]);
  };

  const removeExperience = (index: number) => {
    onChange(experience.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Work Experience</h2>
        <button
          onClick={addExperience}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          + Add Experience
        </button>
      </div>

      {experience.map((exp, index) => (
        <div key={index} className="p-6 border border-gray-200 rounded-lg space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Experience {index + 1}</h3>
            <button
              onClick={() => removeExperience(index)}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              Remove
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField 
              label="Company" 
              required 
              confidence={exp.confidence}
              error={getError(index, 'company')}
            >
              <input
                type="text"
                value={exp.company}
                onChange={(e) => handleChange(index, 'company', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Company Name"
              />
            </FormField>

            <FormField 
              label="Role" 
              required 
              confidence={exp.confidence}
              error={getError(index, 'role')}
            >
              <input
                type="text"
                value={exp.role}
                onChange={(e) => handleChange(index, 'role', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Software Engineer"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Start Date" required error={getError(index, 'startDate')}>
              <input
                type="date"
                value={exp.startDate instanceof Date ? exp.startDate.toISOString().split('T')[0] : ''}
                onChange={(e) => handleChange(index, 'startDate', new Date(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </FormField>

            <FormField label="End Date" error={getError(index, 'endDate')}>
              <input
                type="date"
                value={exp.endDate instanceof Date ? exp.endDate.toISOString().split('T')[0] : ''}
                onChange={(e) => handleChange(index, 'endDate', e.target.value ? new Date(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </FormField>
          </div>

          <FormField label="Tech Stack" error={getError(index, 'techStack')}>
            <input
              type="text"
              value={exp.techStack.join(', ')}
              onChange={(e) => handleChange(index, 'techStack', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="React, Node.js, PostgreSQL"
            />
          </FormField>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Responsibilities & Achievements</label>
              <button
                onClick={() => addBullet(index)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                + Add Bullet
              </button>
            </div>
            
            {exp.bullets.map((bullet, bulletIndex) => (
              <div key={bulletIndex} className="flex items-start space-x-2">
                <textarea
                  value={bullet}
                  onChange={(e) => handleBulletChange(index, bulletIndex, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Describe your achievement or responsibility..."
                />
                <button
                  onClick={() => removeBullet(index, bulletIndex)}
                  className="mt-2 text-red-600 hover:text-red-800"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
