'use client';

import React from 'react';
import { ParsedResumeData, Template } from '../../types';

interface TemplatePreviewProps {
  data: ParsedResumeData;
  template: Template;
  customizations: CustomizationState;
}

export interface CustomizationState {
  theme: 'light' | 'dark';
  primaryColor: string;
  fontFamily: string;
  fontSize: 'small' | 'medium' | 'large';
  sectionOrder: string[];
  hiddenSections?: string[];
}

export function TemplatePreview({ data, template, customizations }: TemplatePreviewProps) {
  const { theme, primaryColor, fontFamily, fontSize } = customizations;

  // Font size mapping
  const fontSizeMap = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  };

  // Theme classes
  const themeClasses = theme === 'dark'
    ? 'bg-gray-900 text-gray-100'
    : 'bg-white text-gray-900';

  const headingColor = theme === 'dark' ? 'text-gray-100' : 'text-gray-900';
  const subheadingColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';

  // Format date
  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Present';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Render sections based on order
  const renderSection = (sectionType: string) => {
    switch (sectionType) {
      case 'profile':
        return renderProfile();
      case 'summary':
        return renderSummary();
      case 'skills':
        return renderSkills();
      case 'experience':
        return renderExperience();
      case 'projects':
        return renderProjects();
      case 'education':
        return renderEducation();
      case 'certifications':
        return renderCertifications();
      default:
        return null;
    }
  };

  const renderProfile = () => (
    <div className="text-center mb-8">
      <h1 className={`text-4xl font-bold ${headingColor} mb-2`} style={{ color: primaryColor }}>
        {data.profile.name}
      </h1>
      <p className={`text-xl ${subheadingColor} mb-4`}>{data.profile.title}</p>
      {data.profile.location && (
        <p className={`${subheadingColor} mb-2`}>{data.profile.location}</p>
      )}
      <div className="flex justify-center space-x-4 text-sm">
        <a href={`mailto:${data.profile.email}`} className="hover:underline" style={{ color: primaryColor }}>
          {data.profile.email}
        </a>
        {data.profile.phone && (
          <span className={subheadingColor}>{data.profile.phone}</span>
        )}
      </div>
      <div className="flex justify-center space-x-4 mt-2">
        {data.profile.links.github && (
          <a href={data.profile.links.github} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: primaryColor }}>
            GitHub
          </a>
        )}
        {data.profile.links.linkedin && (
          <a href={data.profile.links.linkedin} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: primaryColor }}>
            LinkedIn
          </a>
        )}
        {data.profile.links.website && (
          <a href={data.profile.links.website} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: primaryColor }}>
            Website
          </a>
        )}
        {data.profile.links.portfolio && (
          <a href={data.profile.links.portfolio} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: primaryColor }}>
            Portfolio
          </a>
        )}
      </div>
    </div>
  );

  const renderSummary = () => (
    data.summary && (
      <div className="mb-8">
        <h2 className={`text-2xl font-bold ${headingColor} mb-4 pb-2 border-b ${borderColor}`} style={{ color: primaryColor }}>
          Summary
        </h2>
        <p className={`${subheadingColor} leading-relaxed`}>{data.summary}</p>
      </div>
    )
  );

  const renderSkills = () => (
    data.skills.length > 0 && (
      <div className="mb-8">
        <h2 className={`text-2xl font-bold ${headingColor} mb-4 pb-2 border-b ${borderColor}`} style={{ color: primaryColor }}>
          Skills
        </h2>
        <div className="space-y-3">
          {data.skills.map((skillGroup, index) => (
            <div key={index}>
              <h3 className={`font-semibold ${headingColor} mb-2`}>{skillGroup.category}</h3>
              <div className="flex flex-wrap gap-2">
                {skillGroup.items.map((skill, skillIndex) => (
                  <span
                    key={skillIndex}
                    className={`px-3 py-1 rounded-full text-sm ${
                      theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  );

  const renderExperience = () => (
    data.experience.length > 0 && (
      <div className="mb-8">
        <h2 className={`text-2xl font-bold ${headingColor} mb-4 pb-2 border-b ${borderColor}`} style={{ color: primaryColor }}>
          Experience
        </h2>
        <div className="space-y-6">
          {data.experience.map((exp, index) => (
            <div key={index}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className={`text-xl font-semibold ${headingColor}`}>{exp.role}</h3>
                  <p className={`${subheadingColor}`}>{exp.company}</p>
                </div>
                <span className={`text-sm ${subheadingColor}`}>
                  {formatDate(exp.startDate)} - {formatDate(exp.endDate)}
                </span>
              </div>
              <ul className={`list-disc list-inside space-y-1 ${subheadingColor} ml-4`}>
                {exp.bullets.map((bullet, bulletIndex) => (
                  <li key={bulletIndex}>{bullet}</li>
                ))}
              </ul>
              {exp.techStack.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {exp.techStack.map((tech, techIndex) => (
                    <span
                      key={techIndex}
                      className={`px-2 py-1 text-xs rounded ${
                        theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  );

  const renderProjects = () => (
    data.projects.length > 0 && (
      <div className="mb-8">
        <h2 className={`text-2xl font-bold ${headingColor} mb-4 pb-2 border-b ${borderColor}`} style={{ color: primaryColor }}>
          Projects
        </h2>
        <div className="space-y-6">
          {data.projects.map((project, index) => (
            <div key={index}>
              <div className="flex justify-between items-start mb-2">
                <h3 className={`text-xl font-semibold ${headingColor}`}>{project.name}</h3>
                <div className="flex space-x-2">
                  {project.links.repo && (
                    <a href={project.links.repo} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline" style={{ color: primaryColor }}>
                      Code
                    </a>
                  )}
                  {project.links.demo && (
                    <a href={project.links.demo} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline" style={{ color: primaryColor }}>
                      Demo
                    </a>
                  )}
                </div>
              </div>
              {project.role && (
                <p className={`text-sm ${subheadingColor} mb-2`}>{project.role}</p>
              )}
              <p className={`${subheadingColor} mb-2`}>{project.description}</p>
              {project.techStack.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {project.techStack.map((tech, techIndex) => (
                    <span
                      key={techIndex}
                      className={`px-2 py-1 text-xs rounded ${
                        theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  );

  const renderEducation = () => (
    data.education.length > 0 && (
      <div className="mb-8">
        <h2 className={`text-2xl font-bold ${headingColor} mb-4 pb-2 border-b ${borderColor}`} style={{ color: primaryColor }}>
          Education
        </h2>
        <div className="space-y-4">
          {data.education.map((edu, index) => (
            <div key={index}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className={`text-lg font-semibold ${headingColor}`}>{edu.degree}</h3>
                  <p className={`${subheadingColor}`}>{edu.institution}</p>
                  {edu.gpa && (
                    <p className={`text-sm ${subheadingColor}`}>GPA: {edu.gpa}</p>
                  )}
                </div>
                <span className={`text-sm ${subheadingColor}`}>
                  {formatDate(edu.startDate)} - {formatDate(edu.endDate)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  );

  const renderCertifications = () => (
    data.certifications && data.certifications.length > 0 && (
      <div className="mb-8">
        <h2 className={`text-2xl font-bold ${headingColor} mb-4 pb-2 border-b ${borderColor}`} style={{ color: primaryColor }}>
          Certifications
        </h2>
        <div className="space-y-3">
          {data.certifications.map((cert, index) => (
            <div key={index}>
              <h3 className={`font-semibold ${headingColor}`}>{cert.name}</h3>
              <p className={`text-sm ${subheadingColor}`}>
                {cert.issuer} • {formatDate(cert.date)}
              </p>
              {cert.url && (
                <a href={cert.url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline" style={{ color: primaryColor }}>
                  View Certificate
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  );

  // Check if section is visible
  const isSectionVisible = (section: string) => {
    const hiddenSections = customizations.hiddenSections || [];
    return !hiddenSections.includes(section);
  };

  return (
    <div
      className={`${themeClasses} ${fontSizeMap[fontSize]} p-8 min-h-screen`}
      style={{ fontFamily }}
    >
      <div className="max-w-4xl mx-auto">
        {customizations.sectionOrder
          .filter(isSectionVisible)
          .map((sectionType) => (
            <div key={sectionType}>
              {renderSection(sectionType)}
            </div>
          ))}
      </div>
    </div>
  );
}
