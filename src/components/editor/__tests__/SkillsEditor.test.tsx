import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SkillsEditor } from '../SkillsEditor';
import { ParsedResumeData } from '../../../types';

describe('SkillsEditor', () => {
  const mockSkills: ParsedResumeData['skills'] = [
    {
      category: 'Programming Languages',
      items: ['JavaScript', 'TypeScript', 'Python'],
      confidence: 0.9
    },
    {
      category: 'Frameworks',
      items: ['React', 'Node.js'],
      confidence: 0.85
    }
  ];

  it('renders skill categories', () => {
    const onChange = vi.fn();
    render(<SkillsEditor skills={mockSkills} onChange={onChange} />);

    expect(screen.getByDisplayValue('Programming Languages')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Frameworks')).toBeInTheDocument();
    expect(screen.getByDisplayValue('JavaScript, TypeScript, Python')).toBeInTheDocument();
  });

  it('adds new skill category', () => {
    const onChange = vi.fn();
    render(<SkillsEditor skills={mockSkills} onChange={onChange} />);

    const addButton = screen.getByText('+ Add Category');
    fireEvent.click(addButton);

    expect(onChange).toHaveBeenCalledWith([
      ...mockSkills,
      {
        category: '',
        items: [],
        confidence: 1.0
      }
    ]);
  });

  it('removes skill category', () => {
    const onChange = vi.fn();
    render(<SkillsEditor skills={mockSkills} onChange={onChange} />);

    const removeButtons = screen.getAllByText('Remove');
    fireEvent.click(removeButtons[0]);

    expect(onChange).toHaveBeenCalledWith([mockSkills[1]]);
  });

  it('updates category name', () => {
    const onChange = vi.fn();
    render(<SkillsEditor skills={mockSkills} onChange={onChange} />);

    const categoryInput = screen.getByDisplayValue('Programming Languages');
    fireEvent.change(categoryInput, { target: { value: 'Languages' } });

    expect(onChange).toHaveBeenCalledWith([
      {
        ...mockSkills[0],
        category: 'Languages'
      },
      mockSkills[1]
    ]);
  });

  it('updates skill items', () => {
    const onChange = vi.fn();
    render(<SkillsEditor skills={mockSkills} onChange={onChange} />);

    const skillsInput = screen.getByDisplayValue('JavaScript, TypeScript, Python');
    fireEvent.change(skillsInput, { target: { value: 'JavaScript, TypeScript, Python, Go' } });

    expect(onChange).toHaveBeenCalledWith([
      {
        ...mockSkills[0],
        items: ['JavaScript', 'TypeScript', 'Python', 'Go']
      },
      mockSkills[1]
    ]);
  });

  it('displays confidence score indicator', () => {
    const onChange = vi.fn();
    render(<SkillsEditor skills={mockSkills} onChange={onChange} />);

    expect(screen.getAllByText('High Confidence').length).toBeGreaterThan(0); // Multiple fields show confidence
  });

  it('displays validation errors', () => {
    const onChange = vi.fn();
    const errors = [
      { field: 'skills.0.category', message: 'Category name is required', severity: 'error' as const }
    ];

    render(<SkillsEditor skills={mockSkills} onChange={onChange} errors={errors} />);

    expect(screen.getByText('Category name is required')).toBeInTheDocument();
  });

  it('handles empty skills array', () => {
    const onChange = vi.fn();
    render(<SkillsEditor skills={[]} onChange={onChange} />);

    expect(screen.getByText('Skills')).toBeInTheDocument();
    expect(screen.getByText('+ Add Category')).toBeInTheDocument();
  });
});
