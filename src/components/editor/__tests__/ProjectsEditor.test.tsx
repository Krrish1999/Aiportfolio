import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectsEditor } from '../ProjectsEditor';
import { ParsedResumeData } from '../../../types';

describe('ProjectsEditor', () => {
  const mockProjects: ParsedResumeData['projects'] = [
    {
      name: 'E-commerce Platform',
      description: 'Built a scalable e-commerce platform with React and Node.js',
      role: 'Lead Developer',
      links: {
        repo: 'https://github.com/user/ecommerce',
        demo: 'https://demo.ecommerce.com'
      },
      techStack: ['React', 'Node.js', 'PostgreSQL'],
      confidence: 0.92
    }
  ];

  it('renders project entries', () => {
    const onChange = vi.fn();
    render(<ProjectsEditor projects={mockProjects} onChange={onChange} />);

    expect(screen.getByDisplayValue('E-commerce Platform')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Built a scalable e-commerce platform with React and Node.js')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Lead Developer')).toBeInTheDocument();
  });

  it('adds new project', () => {
    const onChange = vi.fn();
    render(<ProjectsEditor projects={mockProjects} onChange={onChange} />);

    const addButton = screen.getByText('+ Add Project');
    fireEvent.click(addButton);

    expect(onChange).toHaveBeenCalledWith([
      ...mockProjects,
      {
        name: '',
        description: '',
        links: {},
        techStack: [],
        confidence: 1.0
      }
    ]);
  });

  it('removes project', () => {
    const onChange = vi.fn();
    render(<ProjectsEditor projects={mockProjects} onChange={onChange} />);

    const removeButton = screen.getByText('Remove');
    fireEvent.click(removeButton);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('updates project name', () => {
    const onChange = vi.fn();
    render(<ProjectsEditor projects={mockProjects} onChange={onChange} />);

    const nameInput = screen.getByDisplayValue('E-commerce Platform');
    fireEvent.change(nameInput, { target: { value: 'New Project Name' } });

    expect(onChange).toHaveBeenCalledWith([
      {
        ...mockProjects[0],
        name: 'New Project Name'
      }
    ]);
  });

  it('updates project description', () => {
    const onChange = vi.fn();
    render(<ProjectsEditor projects={mockProjects} onChange={onChange} />);

    const descInput = screen.getByDisplayValue('Built a scalable e-commerce platform with React and Node.js');
    fireEvent.change(descInput, { target: { value: 'Updated description' } });

    expect(onChange).toHaveBeenCalledWith([
      {
        ...mockProjects[0],
        description: 'Updated description'
      }
    ]);
  });

  it('updates tech stack', () => {
    const onChange = vi.fn();
    render(<ProjectsEditor projects={mockProjects} onChange={onChange} />);

    const techStackInput = screen.getByDisplayValue('React, Node.js, PostgreSQL');
    fireEvent.change(techStackInput, { target: { value: 'React, TypeScript, MongoDB' } });

    expect(onChange).toHaveBeenCalledWith([
      {
        ...mockProjects[0],
        techStack: ['React', 'TypeScript', 'MongoDB']
      }
    ]);
  });

  it('updates repository URL', () => {
    const onChange = vi.fn();
    render(<ProjectsEditor projects={mockProjects} onChange={onChange} />);

    const repoInput = screen.getByDisplayValue('https://github.com/user/ecommerce');
    fireEvent.change(repoInput, { target: { value: 'https://github.com/user/newrepo' } });

    expect(onChange).toHaveBeenCalledWith([
      {
        ...mockProjects[0],
        links: {
          ...mockProjects[0].links,
          repo: 'https://github.com/user/newrepo'
        }
      }
    ]);
  });

  it('updates demo URL', () => {
    const onChange = vi.fn();
    render(<ProjectsEditor projects={mockProjects} onChange={onChange} />);

    const demoInput = screen.getByDisplayValue('https://demo.ecommerce.com');
    fireEvent.change(demoInput, { target: { value: 'https://newdemo.com' } });

    expect(onChange).toHaveBeenCalledWith([
      {
        ...mockProjects[0],
        links: {
          ...mockProjects[0].links,
          demo: 'https://newdemo.com'
        }
      }
    ]);
  });

  it('displays confidence score indicator', () => {
    const onChange = vi.fn();
    render(<ProjectsEditor projects={mockProjects} onChange={onChange} />);

    expect(screen.getAllByText('High Confidence')).toHaveLength(2); // Name and Description fields
  });

  it('displays validation errors', () => {
    const onChange = vi.fn();
    const errors = [
      { field: 'projects.0.name', message: 'Project name is required', severity: 'error' as const }
    ];

    render(<ProjectsEditor projects={mockProjects} onChange={onChange} errors={errors} />);

    expect(screen.getByText('Project name is required')).toBeInTheDocument();
  });

  it('handles empty projects array', () => {
    const onChange = vi.fn();
    render(<ProjectsEditor projects={[]} onChange={onChange} />);

    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('+ Add Project')).toBeInTheDocument();
  });
});
