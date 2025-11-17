import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileEditor } from '../ProfileEditor';
import { ParsedResumeData } from '../../../types';

describe('ProfileEditor', () => {
  const mockProfile: ParsedResumeData['profile'] = {
    name: 'John Doe',
    title: 'Software Engineer',
    email: 'john@example.com',
    phone: '+1 (555) 123-4567',
    location: 'San Francisco, CA',
    links: {
      github: 'https://github.com/johndoe',
      linkedin: 'https://linkedin.com/in/johndoe',
      website: 'https://johndoe.com',
      portfolio: 'https://portfolio.johndoe.com'
    }
  };

  it('renders all profile fields', () => {
    const onChange = vi.fn();
    render(<ProfileEditor profile={mockProfile} onChange={onChange} />);

    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Software Engineer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+1 (555) 123-4567')).toBeInTheDocument();
  });

  it('calls onChange when name is updated', () => {
    const onChange = vi.fn();
    render(<ProfileEditor profile={mockProfile} onChange={onChange} />);

    const nameInput = screen.getByDisplayValue('John Doe');
    fireEvent.change(nameInput, { target: { value: 'Jane Smith' } });

    expect(onChange).toHaveBeenCalledWith({
      ...mockProfile,
      name: 'Jane Smith'
    });
  });

  it('calls onChange when email is updated', () => {
    const onChange = vi.fn();
    render(<ProfileEditor profile={mockProfile} onChange={onChange} />);

    const emailInput = screen.getByDisplayValue('john@example.com');
    fireEvent.change(emailInput, { target: { value: 'jane@example.com' } });

    expect(onChange).toHaveBeenCalledWith({
      ...mockProfile,
      email: 'jane@example.com'
    });
  });

  it('displays validation errors', () => {
    const onChange = vi.fn();
    const errors = [
      { field: 'profile.email', message: 'Invalid email format', severity: 'error' as const }
    ];

    render(<ProfileEditor profile={mockProfile} onChange={onChange} errors={errors} />);

    expect(screen.getByText('Invalid email format')).toBeInTheDocument();
  });

  it('updates GitHub link', () => {
    const onChange = vi.fn();
    render(<ProfileEditor profile={mockProfile} onChange={onChange} />);

    const githubInput = screen.getByDisplayValue('https://github.com/johndoe');
    fireEvent.change(githubInput, { target: { value: 'https://github.com/newuser' } });

    expect(onChange).toHaveBeenCalledWith({
      ...mockProfile,
      links: {
        ...mockProfile.links,
        github: 'https://github.com/newuser'
      }
    });
  });
});
