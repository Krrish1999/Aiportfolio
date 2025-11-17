import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TemplatePreview, CustomizationState } from '../TemplatePreview';
import { ParsedResumeData, Template } from '../../../types';

const mockTemplate: Template = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Clean design',
  category: 'minimal',
  sections: [],
  customizations: [],
};

const mockCustomizations: CustomizationState = {
  theme: 'light',
  primaryColor: '#3B82F6',
  fontFamily: 'Inter, sans-serif',
  fontSize: 'medium',
  sectionOrder: ['profile', 'summary', 'skills', 'experience', 'projects', 'education'],
  hiddenSections: [],
};

const mockData: ParsedResumeData = {
  profile: {
    name: 'John Doe',
    title: 'Software Engineer',
    location: 'San Francisco, CA',
    email: 'john@example.com',
    phone: '+1-555-0123',
    links: {
      github: 'https://github.com/johndoe',
      linkedin: 'https://linkedin.com/in/johndoe',
    },
  },
  summary: 'Experienced software engineer with 5 years of experience',
  skills: [
    {
      category: 'Languages',
      items: ['JavaScript', 'TypeScript', 'Python'],
      confidence: 0.95,
    },
  ],
  experience: [
    {
      company: 'Tech Corp',
      role: 'Senior Developer',
      startDate: new Date('2020-01-01'),
      bullets: ['Built scalable features', 'Led team of 5'],
      techStack: ['React', 'Node.js'],
      confidence: 0.9,
    },
  ],
  projects: [
    {
      name: 'Project Alpha',
      description: 'A revolutionary app',
      links: {
        repo: 'https://github.com/johndoe/alpha',
        demo: 'https://alpha.example.com',
      },
      techStack: ['React', 'TypeScript'],
      confidence: 0.85,
    },
  ],
  education: [
    {
      degree: 'BS Computer Science',
      institution: 'Stanford University',
      startDate: new Date('2016-09-01'),
      endDate: new Date('2020-05-01'),
      gpa: '3.8',
      confidence: 0.95,
    },
  ],
};

describe('TemplatePreview', () => {
  it('renders profile information', () => {
    render(
      <TemplatePreview
        data={mockData}
        template={mockTemplate}
        customizations={mockCustomizations}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText('San Francisco, CA')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('renders summary section', () => {
    render(
      <TemplatePreview
        data={mockData}
        template={mockTemplate}
        customizations={mockCustomizations}
      />
    );

    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Experienced software engineer with 5 years of experience')).toBeInTheDocument();
  });

  it('renders skills section', () => {
    render(
      <TemplatePreview
        data={mockData}
        template={mockTemplate}
        customizations={mockCustomizations}
      />
    );

    expect(screen.getByText('Skills')).toBeInTheDocument();
    expect(screen.getByText('Languages')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getAllByText('TypeScript').length).toBeGreaterThan(0);
  });

  it('renders experience section', () => {
    render(
      <TemplatePreview
        data={mockData}
        template={mockTemplate}
        customizations={mockCustomizations}
      />
    );

    expect(screen.getByText('Experience')).toBeInTheDocument();
    expect(screen.getByText('Senior Developer')).toBeInTheDocument();
    expect(screen.getByText('Tech Corp')).toBeInTheDocument();
    expect(screen.getByText('Built scalable features')).toBeInTheDocument();
  });

  it('renders projects section', () => {
    render(
      <TemplatePreview
        data={mockData}
        template={mockTemplate}
        customizations={mockCustomizations}
      />
    );

    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('A revolutionary app')).toBeInTheDocument();
  });

  it('renders education section', () => {
    render(
      <TemplatePreview
        data={mockData}
        template={mockTemplate}
        customizations={mockCustomizations}
      />
    );

    expect(screen.getByText('Education')).toBeInTheDocument();
    expect(screen.getByText('BS Computer Science')).toBeInTheDocument();
    expect(screen.getByText('Stanford University')).toBeInTheDocument();
  });

  it('applies dark theme correctly', () => {
    const darkCustomizations = {
      ...mockCustomizations,
      theme: 'dark' as const,
    };

    const { container } = render(
      <TemplatePreview
        data={mockData}
        template={mockTemplate}
        customizations={darkCustomizations}
      />
    );

    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('bg-gray-900');
    expect(mainDiv.className).toContain('text-gray-100');
  });

  it('respects section order', () => {
    const customOrder: CustomizationState = {
      ...mockCustomizations,
      sectionOrder: ['profile', 'projects', 'experience', 'skills', 'education', 'summary'],
    };

    render(
      <TemplatePreview
        data={mockData}
        template={mockTemplate}
        customizations={customOrder}
      />
    );

    const sections = screen.getAllByRole('heading', { level: 2 });
    const sectionTexts = sections.map(s => s.textContent);
    
    expect(sectionTexts).toEqual(['Projects', 'Experience', 'Skills', 'Education', 'Summary']);
  });

  it('hides sections marked as hidden', () => {
    const customizationsWithHidden: CustomizationState = {
      ...mockCustomizations,
      hiddenSections: ['skills', 'projects'],
    };

    render(
      <TemplatePreview
        data={mockData}
        template={mockTemplate}
        customizations={customizationsWithHidden}
      />
    );

    expect(screen.queryByText('Skills')).not.toBeInTheDocument();
    expect(screen.queryByText('Projects')).not.toBeInTheDocument();
    expect(screen.getByText('Experience')).toBeInTheDocument();
    expect(screen.getByText('Education')).toBeInTheDocument();
  });

  it('applies custom primary color to headings', () => {
    const customColor = '#FF5733';
    const customColorCustomizations: CustomizationState = {
      ...mockCustomizations,
      primaryColor: customColor,
    };

    render(
      <TemplatePreview
        data={mockData}
        template={mockTemplate}
        customizations={customColorCustomizations}
      />
    );

    const nameHeading = screen.getByText('John Doe');
    expect(nameHeading).toHaveStyle({ color: customColor });
  });

  it('applies custom font family', () => {
    const customFont = 'Roboto, sans-serif';
    const customFontCustomizations: CustomizationState = {
      ...mockCustomizations,
      fontFamily: customFont,
    };

    const { container } = render(
      <TemplatePreview
        data={mockData}
        template={mockTemplate}
        customizations={customFontCustomizations}
      />
    );

    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveStyle({ fontFamily: customFont });
  });

  it('applies different font sizes', () => {
    const largeFontCustomizations: CustomizationState = {
      ...mockCustomizations,
      fontSize: 'large',
    };

    const { container } = render(
      <TemplatePreview
        data={mockData}
        template={mockTemplate}
        customizations={largeFontCustomizations}
      />
    );

    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain('text-lg');
  });

  it('updates preview when customizations change', () => {
    const { rerender } = render(
      <TemplatePreview
        data={mockData}
        template={mockTemplate}
        customizations={mockCustomizations}
      />
    );

    expect(screen.getByText('Skills')).toBeInTheDocument();

    const updatedCustomizations: CustomizationState = {
      ...mockCustomizations,
      hiddenSections: ['skills'],
    };

    rerender(
      <TemplatePreview
        data={mockData}
        template={mockTemplate}
        customizations={updatedCustomizations}
      />
    );

    expect(screen.queryByText('Skills')).not.toBeInTheDocument();
  });
});
