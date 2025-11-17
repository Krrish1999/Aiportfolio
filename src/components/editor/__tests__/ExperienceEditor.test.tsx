import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExperienceEditor } from '../ExperienceEditor';
import { ParsedResumeData } from '../../../types';

describe('ExperienceEditor', () => {
  const mockExperience: ParsedResumeData['experience'] = [
    {
      company: 'Tech Corp',
      role: 'Senior Engineer',
      startDate: new Date('2020-01-01'),
      endDate: new Date('2023-01-01'),
      bullets: ['Led team of 5 developers', 'Improved performance by 50%'],
      techStack: ['React', 'Node.js'],
      confidence: 0.95
    }
  ];

  it('renders experience entries', () => {
    const onChange = vi.fn();
    render(<ExperienceEditor experience={mockExperience} onChange={onChange} />);

    expect(screen.getByDisplayValue('Tech Corp')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Senior Engineer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Led team of 5 developers')).toBeInTheDocument();
  });

  it('adds new experience entry', () => {
    const onChange = vi.fn();
    render(<ExperienceEditor experience={mockExperience} onChange={onChange} />);

    const addButton = screen.getByText('+ Add Experience');
    fireEvent.click(addButton);

    expect(onChange).toHaveBeenCalledWith([
      ...mockExperience,
      expect.objectContaining({
        company: '',
        role: '',
        bullets: [''],
        techStack: [],
        confidence: 1.0
      })
    ]);
  });

  it('removes experience entry', () => {
    const onChange = vi.fn();
    render(<ExperienceEditor experience={mockExperience} onChange={onChange} />);

    const removeButton = screen.getByText('Remove');
    fireEvent.click(removeButton);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('updates company name', () => {
    const onChange = vi.fn();
    render(<ExperienceEditor experience={mockExperience} onChange={onChange} />);

    const companyInput = screen.getByDisplayValue('Tech Corp');
    fireEvent.change(companyInput, { target: { value: 'New Company' } });

    expect(onChange).toHaveBeenCalledWith([
      {
        ...mockExperience[0],
        company: 'New Company'
      }
    ]);
  });

  it('adds new bullet point', () => {
    const onChange = vi.fn();
    render(<ExperienceEditor experience={mockExperience} onChange={onChange} />);

    const addBulletButton = screen.getByText('+ Add Bullet');
    fireEvent.click(addBulletButton);

    expect(onChange).toHaveBeenCalledWith([
      {
        ...mockExperience[0],
        bullets: [...mockExperience[0].bullets, '']
      }
    ]);
  });

  it('displays confidence score indicator', () => {
    const onChange = vi.fn();
    render(<ExperienceEditor experience={mockExperience} onChange={onChange} />);

    expect(screen.getAllByText('High Confidence')).toHaveLength(2); // Company and Role fields
  });
});
