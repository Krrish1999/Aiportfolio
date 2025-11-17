'use client';

import React, { useState, useEffect } from 'react';
import { ParsedResumeData, ValidationError } from '../../types';
import { validateEmail, validatePhone, validateURL } from '../../utils/validation';
import { ProfileEditor } from './ProfileEditor';
import { ExperienceEditor } from './ExperienceEditor';
import { ProjectsEditor } from './ProjectsEditor';
import { SkillsEditor } from './SkillsEditor';
import { EducationEditor } from './EducationEditor';

interface ContentEditorProps {
  data: ParsedResumeData;
  onChange: (data: ParsedResumeData) => void;
  onValidationChange?: (errors: ValidationError[]) => void;
}

type EditorSection = 'profile' | 'experience' | 'projects' | 'skills' | 'education';

export function ContentEditor({ data, onChange, onValidationChange }: ContentEditorProps) {
  const [activeSection, setActiveSection] = useState<EditorSection>('profile');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Real-time validation
  useEffect(() => {
    const errors: ValidationError[] = [];

    // Validate profile
    if (!data.profile.name.trim()) {
      errors.push({ field: 'profile.name', message: 'Name is required', severity: 'error' });
    }
    if (!data.profile.title.trim()) {
      errors.push({ field: 'profile.title', message: 'Title is required', severity: 'error' });
    }
    if (!validateEmail(data.profile.email).isValid) {
      errors.push({ field: 'profile.email', message: 'Invalid email format', severity: 'error' });
    }
    if (data.profile.phone && !validatePhone(data.profile.phone).isValid) {
      errors.push({ field: 'profile.phone', message: 'Invalid phone format', severity: 'warning' });
    }

    // Validate profile links
    const links = data.profile.links;
    if (links.github && !validateURL(links.github).isValid) {
      errors.push({ field: 'profile.links.github', message: 'Invalid URL format', severity: 'warning' });
    }
    if (links.linkedin && !validateURL(links.linkedin).isValid) {
      errors.push({ field: 'profile.links.linkedin', message: 'Invalid URL format', severity: 'warning' });
    }
    if (links.website && !validateURL(links.website).isValid) {
      errors.push({ field: 'profile.links.website', message: 'Invalid URL format', severity: 'warning' });
    }
    if (links.portfolio && !validateURL(links.portfolio).isValid) {
      errors.push({ field: 'profile.links.portfolio', message: 'Invalid URL format', severity: 'warning' });
    }

    // Validate experience
    data.experience.forEach((exp, index) => {
      if (!exp.company.trim()) {
        errors.push({ field: `experience.${index}.company`, message: 'Company is required', severity: 'error' });
      }
      if (!exp.role.trim()) {
        errors.push({ field: `experience.${index}.role`, message: 'Role is required', severity: 'error' });
      }
      if (exp.bullets.length === 0 || exp.bullets.every(b => !b.trim())) {
        errors.push({ field: `experience.${index}.bullets`, message: 'At least one bullet point is required', severity: 'warning' });
      }
    });

    // Validate projects
    data.projects.forEach((project, index) => {
      if (!project.name.trim()) {
        errors.push({ field: `projects.${index}.name`, message: 'Project name is required', severity: 'error' });
      }
      if (!project.description.trim()) {
        errors.push({ field: `projects.${index}.description`, message: 'Description is required', severity: 'error' });
      }
      if (project.links.repo && !validateURL(project.links.repo).isValid) {
        errors.push({ field: `projects.${index}.links.repo`, message: 'Invalid URL format', severity: 'warning' });
      }
      if (project.links.demo && !validateURL(project.links.demo).isValid) {
        errors.push({ field: `projects.${index}.links.demo`, message: 'Invalid URL format', severity: 'warning' });
      }
    });

    // Validate skills
    data.skills.forEach((skillGroup, index) => {
      if (!skillGroup.category.trim()) {
        errors.push({ field: `skills.${index}.category`, message: 'Category name is required', severity: 'error' });
      }
      if (skillGroup.items.length === 0) {
        errors.push({ field: `skills.${index}.items`, message: 'At least one skill is required', severity: 'error' });
      }
    });

    setValidationErrors(errors);
    onValidationChange?.(errors);
  }, [data, onValidationChange]);

  const sections: { id: EditorSection; label: string; count?: number }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'experience', label: 'Experience', count: data.experience.length },
    { id: 'projects', label: 'Projects', count: data.projects.length },
    { id: 'skills', label: 'Skills', count: data.skills.length },
    { id: 'education', label: 'Education', count: data.education.length },
  ];

  const getSectionErrors = (section: EditorSection) => {
    return validationErrors.filter(e => e.field.startsWith(section));
  };

  return (
    <div className="flex h-full">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Content</h2>
        <nav className="space-y-1">
          {sections.map((section) => {
            const sectionErrors = getSectionErrors(section.id);
            const hasErrors = sectionErrors.some(e => e.severity === 'error');
            const hasWarnings = sectionErrors.some(e => e.severity === 'warning');

            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-4 py-2 rounded-md transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{section.label}</span>
                  <div className="flex items-center space-x-2">
                    {section.count !== undefined && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        activeSection === section.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {section.count}
                      </span>
                    )}
                    {hasErrors && (
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    )}
                    {!hasErrors && hasWarnings && (
                      <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Validation Summary */}
        {validationErrors.length > 0 && (
          <div className="mt-6 p-4 bg-white border border-gray-200 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Validation Status</h3>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Errors:</span>
                <span className="font-medium text-red-600">
                  {validationErrors.filter(e => e.severity === 'error').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Warnings:</span>
                <span className="font-medium text-yellow-600">
                  {validationErrors.filter(e => e.severity === 'warning').length}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 bg-white">
        {activeSection === 'profile' && (
          <ProfileEditor
            profile={data.profile}
            onChange={(profile) => onChange({ ...data, profile })}
            errors={getSectionErrors('profile')}
          />
        )}

        {activeSection === 'experience' && (
          <ExperienceEditor
            experience={data.experience}
            onChange={(experience) => onChange({ ...data, experience })}
            errors={getSectionErrors('experience')}
          />
        )}

        {activeSection === 'projects' && (
          <ProjectsEditor
            projects={data.projects}
            onChange={(projects) => onChange({ ...data, projects })}
            errors={getSectionErrors('projects')}
          />
        )}

        {activeSection === 'skills' && (
          <SkillsEditor
            skills={data.skills}
            onChange={(skills) => onChange({ ...data, skills })}
            errors={getSectionErrors('skills')}
          />
        )}

        {activeSection === 'education' && (
          <EducationEditor
            education={data.education}
            onChange={(education) => onChange({ ...data, education })}
            errors={getSectionErrors('education')}
          />
        )}
      </div>
    </div>
  );
}
