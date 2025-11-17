'use client';

import React from 'react';
import { FormField } from '../forms/FormField';
import { ParsedResumeData, ValidationError } from '../../types';

interface ProjectsEditorProps {
  projects: ParsedResumeData['projects'];
  onChange: (projects: ParsedResumeData['projects']) => void;
  errors?: ValidationError[];
}

export function ProjectsEditor({ projects, onChange, errors = [] }: ProjectsEditorProps) {
  const getError = (index: number, field: string) => 
    errors.find(e => e.field === `projects.${index}.${field}`)?.message;

  const handleChange = (index: number, field: keyof ParsedResumeData['projects'][0], value: any) => {
    const updated = [...projects];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleLinkChange = (index: number, linkType: 'repo' | 'demo', value: string) => {
    const updated = [...projects];
    updated[index] = {
      ...updated[index],
      links: { ...updated[index].links, [linkType]: value }
    };
    onChange(updated);
  };

  const addProject = () => {
    onChange([...projects, {
      name: '',
      description: '',
      links: {},
      techStack: [],
      confidence: 1.0
    }]);
  };

  const removeProject = (index: number) => {
    onChange(projects.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
        <button
          onClick={addProject}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          + Add Project
        </button>
      </div>

      {projects.map((project, index) => (
        <div key={index} className="p-6 border border-gray-200 rounded-lg space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Project {index + 1}</h3>
            <button
              onClick={() => removeProject(index)}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              Remove
            </button>
          </div>

          <FormField 
            label="Project Name" 
            required 
            confidence={project.confidence}
            error={getError(index, 'name')}
          >
            <input
              type="text"
              value={project.name}
              onChange={(e) => handleChange(index, 'name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="My Awesome Project"
            />
          </FormField>

          <FormField 
            label="Description" 
            required 
            confidence={project.confidence}
            error={getError(index, 'description')}
          >
            <textarea
              value={project.description}
              onChange={(e) => handleChange(index, 'description', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Describe your project, the problem it solves, and the impact..."
            />
          </FormField>

          <FormField label="Your Role" error={getError(index, 'role')}>
            <input
              type="text"
              value={project.role || ''}
              onChange={(e) => handleChange(index, 'role', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Lead Developer, Contributor, etc."
            />
          </FormField>

          <FormField label="Tech Stack" error={getError(index, 'techStack')}>
            <input
              type="text"
              value={project.techStack.join(', ')}
              onChange={(e) => handleChange(index, 'techStack', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="React, TypeScript, Node.js"
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Repository URL" error={getError(index, 'links.repo')}>
              <input
                type="url"
                value={project.links.repo || ''}
                onChange={(e) => handleLinkChange(index, 'repo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://github.com/user/repo"
              />
            </FormField>

            <FormField label="Demo URL" error={getError(index, 'links.demo')}>
              <input
                type="url"
                value={project.links.demo || ''}
                onChange={(e) => handleLinkChange(index, 'demo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://demo.example.com"
              />
            </FormField>
          </div>
        </div>
      ))}
    </div>
  );
}
