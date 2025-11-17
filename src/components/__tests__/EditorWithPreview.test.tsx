import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditorWithPreview } from '../EditorWithPreview';
import { ParsedResumeData } from '../../types';

const mockData: ParsedResumeData = {
  profile: {
    name: 'John Doe',
    title: 'Software Engineer',
    email: 'john@example.com',
    links: {},
  },
  summary: 'Experienced software engineer',
  skills: [
    {
      category: 'Languages',
      items: ['JavaScript', 'TypeScript'],
      confidence: 0.95,
    },
  ],
  experience: [
    {
      company: 'Tech Corp',
      role: 'Senior Developer',
      startDate: new Date('2020-01-01'),
      bullets: ['Built features', 'Led team'],
      techStack: ['React', 'Node.js'],
      confidence: 0.9,
    },
  ],
  projects: [
    {
      name: 'Project Alpha',
      description: 'A cool project',
      links: {},
      techStack: ['React'],
      confidence: 0.85,
    },
  ],
  education: [
    {
      degree: 'BS Computer Science',
      institution: 'University',
      startDate: new Date('2016-09-01'),
      endDate: new Date('2020-05-01'),
      confidence: 0.95,
    },
  ],
};

describe('EditorWithPreview', () => {
  it('renders editor and preview in split view by default', () => {
    render(<EditorWithPreview initialData={mockData} />);
    
    expect(screen.getByText('Portfolio Editor')).toBeInTheDocument();
    expect(screen.getByText('Edit Content')).toBeInTheDocument();
    expect(screen.getByText('See how your portfolio looks')).toBeInTheDocument();
  });

  it('switches between view modes', () => {
    render(<EditorWithPreview initialData={mockData} />);
    
    const editorButton = screen.getByRole('button', { name: 'Editor' });
    const previewButton = screen.getByRole('button', { name: 'Preview' });
    const splitButton = screen.getByRole('button', { name: 'Split' });

    // Switch to editor only
    fireEvent.click(editorButton);
    expect(screen.getByText('Edit Content')).toBeInTheDocument();
    expect(screen.queryByText('See how your portfolio looks')).not.toBeInTheDocument();

    // Switch to preview only
    fireEvent.click(previewButton);
    expect(screen.getByText('See how your portfolio looks')).toBeInTheDocument();
    expect(screen.queryByText('Edit Content')).not.toBeInTheDocument();

    // Switch back to split
    fireEvent.click(splitButton);
    expect(screen.getByText('Edit Content')).toBeInTheDocument();
    expect(screen.getByText('See how your portfolio looks')).toBeInTheDocument();
  });

  it('updates preview when editor data changes', async () => {
    render(<EditorWithPreview initialData={mockData} />);
    
    // Initial preview should show original name
    expect(screen.getByText('John Doe')).toBeInTheDocument();

    // Find and update the name field
    const nameInput = screen.getByDisplayValue('John Doe');
    fireEvent.change(nameInput, { target: { value: 'Jane Smith' } });

    // Preview should update with new name
    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('calls onPublish with updated data', () => {
    const onPublish = vi.fn();
    render(<EditorWithPreview initialData={mockData} onPublish={onPublish} />);
    
    const publishButton = screen.getByRole('button', { name: 'Publish' });
    fireEvent.click(publishButton);

    expect(onPublish).toHaveBeenCalledWith(mockData);
  });

  it('prevents publishing with validation errors', () => {
    const invalidData = {
      ...mockData,
      profile: {
        ...mockData.profile,
        email: 'invalid-email',
      },
    };

    const onPublish = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    
    render(<EditorWithPreview initialData={invalidData} onPublish={onPublish} />);
    
    const publishButton = screen.getByRole('button', { name: 'Publish' });
    fireEvent.click(publishButton);

    expect(alertSpy).toHaveBeenCalledWith('Please fix all errors before publishing');
    expect(onPublish).not.toHaveBeenCalled();
    
    alertSpy.mockRestore();
  });
});
