import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContentEditor } from '../ContentEditor';
import { ParsedResumeData } from '../../../types';

describe('ContentEditor', () => {
  const mockData: ParsedResumeData = {
    profile: {
      name: 'John Doe',
      title: 'Software Engineer',
      email: 'john@example.com',
      phone: '+1 (555) 123-4567',
      location: 'San Francisco, CA',
      links: {
        github: 'https://github.com/johndoe'
      }
    },
    summary: 'Experienced software engineer',
    skills: [
      {
        category: 'Languages',
        items: ['JavaScript', 'TypeScript'],
        confidence: 0.9
      }
    ],
    experience: [
      {
        company: 'Tech Corp',
        role: 'Engineer',
        startDate: new Date('2020-01-01'),
        bullets: ['Built features'],
        techStack: ['React'],
        confidence: 0.95
      }
    ],
    projects: [
      {
        name: 'Project A',
        description: 'A cool project',
        links: {},
        techStack: ['Node.js'],
        confidence: 0.85
      }
    ],
    education: [],
    certifications: []
  };

  it('renders section navigation', () => {
    const onChange = vi.fn();
    render(<ContentEditor data={mockData} onChange={onChange} />);

    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Experience')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
  });

  it('switches between sections', () => {
    const onChange = vi.fn();
    render(<ContentEditor data={mockData} onChange={onChange} />);

    // Initially shows profile
    expect(screen.getByText('Profile Information')).toBeInTheDocument();

    // Switch to experience
    const experienceButton = screen.getByText('Experience');
    fireEvent.click(experienceButton);

    expect(screen.getByText('Work Experience')).toBeInTheDocument();
  });

  it('performs real-time validation', async () => {
    const onChange = vi.fn();
    const onValidationChange = vi.fn();

    render(
      <ContentEditor 
        data={mockData} 
        onChange={onChange} 
        onValidationChange={onValidationChange}
      />
    );

    await waitFor(() => {
      expect(onValidationChange).toHaveBeenCalled();
    });
  });

  it('shows validation errors in sidebar', async () => {
    const invalidData = {
      ...mockData,
      profile: {
        ...mockData.profile,
        email: 'invalid-email'
      }
    };

    const onChange = vi.fn();
    render(<ContentEditor data={invalidData} onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByText('Errors:')).toBeInTheDocument();
    });
  });

  it('displays section counts', () => {
    const onChange = vi.fn();
    render(<ContentEditor data={mockData} onChange={onChange} />);

    expect(screen.getAllByText('1')).toHaveLength(3); // Experience, Projects, Skills counts
  });

  it('propagates changes from child editors', () => {
    const onChange = vi.fn();
    render(<ContentEditor data={mockData} onChange={onChange} />);

    const nameInput = screen.getByDisplayValue('John Doe');
    fireEvent.change(nameInput, { target: { value: 'Jane Smith' } });

    expect(onChange).toHaveBeenCalledWith({
      ...mockData,
      profile: {
        ...mockData.profile,
        name: 'Jane Smith'
      }
    });
  });
});
