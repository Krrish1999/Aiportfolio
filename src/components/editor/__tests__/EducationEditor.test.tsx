import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EducationEditor } from '../EducationEditor';
import { ParsedResumeData } from '../../../types';

describe('EducationEditor', () => {
  const mockEducation: ParsedResumeData['education'] = [
    {
      degree: 'Bachelor of Science in Computer Science',
      institution: 'Stanford University',
      startDate: new Date('2016-09-01'),
      endDate: new Date('2020-05-01'),
      gpa: '3.8',
      confidence: 0.9
    }
  ];

  it('renders education entries', () => {
    const onChange = vi.fn();
    render(<EducationEditor education={mockEducation} onChange={onChange} />);

    expect(screen.getByDisplayValue('Bachelor of Science in Computer Science')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Stanford University')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3.8')).toBeInTheDocument();
  });

  it('adds new education entry', () => {
    const onChange = vi.fn();
    render(<EducationEditor education={mockEducation} onChange={onChange} />);

    const addButton = screen.getByText('+ Add Education');
    fireEvent.click(addButton);

    expect(onChange).toHaveBeenCalledWith([
      ...mockEducation,
      expect.objectContaining({
        degree: '',
        institution: '',
        confidence: 1.0
      })
    ]);
  });

  it('removes education entry', () => {
    const onChange = vi.fn();
    render(<EducationEditor education={mockEducation} onChange={onChange} />);

    const removeButton = screen.getByText('Remove');
    fireEvent.click(removeButton);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('updates degree', () => {
    const onChange = vi.fn();
    render(<EducationEditor education={mockEducation} onChange={onChange} />);

    const degreeInput = screen.getByDisplayValue('Bachelor of Science in Computer Science');
    fireEvent.change(degreeInput, { target: { value: 'Master of Science' } });

    expect(onChange).toHaveBeenCalledWith([
      {
        ...mockEducation[0],
        degree: 'Master of Science'
      }
    ]);
  });

  it('updates institution', () => {
    const onChange = vi.fn();
    render(<EducationEditor education={mockEducation} onChange={onChange} />);

    const institutionInput = screen.getByDisplayValue('Stanford University');
    fireEvent.change(institutionInput, { target: { value: 'MIT' } });

    expect(onChange).toHaveBeenCalledWith([
      {
        ...mockEducation[0],
        institution: 'MIT'
      }
    ]);
  });

  it('displays confidence score indicator', () => {
    const onChange = vi.fn();
    render(<EducationEditor education={mockEducation} onChange={onChange} />);

    expect(screen.getAllByText('High Confidence').length).toBeGreaterThan(0);
  });

  it('handles empty education array', () => {
    const onChange = vi.fn();
    render(<EducationEditor education={[]} onChange={onChange} />);

    expect(screen.getByText('Education')).toBeInTheDocument();
    expect(screen.getByText('+ Add Education')).toBeInTheDocument();
  });
});
