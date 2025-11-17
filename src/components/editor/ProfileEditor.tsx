'use client';

import React from 'react';
import { FormField } from '../forms/FormField';
import { ParsedResumeData, ValidationError } from '../../types';
import { validateEmail, validatePhone, validateURL } from '../../utils/validation';

interface ProfileEditorProps {
  profile: ParsedResumeData['profile'];
  onChange: (profile: ParsedResumeData['profile']) => void;
  errors?: ValidationError[];
}

export function ProfileEditor({ profile, onChange, errors = [] }: ProfileEditorProps) {
  const getError = (field: string) => errors.find(e => e.field === field)?.message;

  const handleChange = (field: keyof ParsedResumeData['profile'], value: string) => {
    onChange({ ...profile, [field]: value });
  };

  const handleLinkChange = (linkType: keyof ParsedResumeData['profile']['links'], value: string) => {
    onChange({
      ...profile,
      links: { ...profile.links, [linkType]: value }
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Profile Information</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField label="Full Name" required error={getError('profile.name')}>
          <input
            type="text"
            value={profile.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="John Doe"
          />
        </FormField>

        <FormField label="Professional Title" required error={getError('profile.title')}>
          <input
            type="text"
            value={profile.title}
            onChange={(e) => handleChange('title', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Senior Software Engineer"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField label="Email" required error={getError('profile.email')}>
          <input
            type="email"
            value={profile.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="john@example.com"
          />
        </FormField>

        <FormField label="Phone" error={getError('profile.phone')}>
          <input
            type="tel"
            value={profile.phone || ''}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+1 (555) 123-4567"
          />
        </FormField>
      </div>

      <FormField label="Location" error={getError('profile.location')}>
        <input
          type="text"
          value={profile.location || ''}
          onChange={(e) => handleChange('location', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="San Francisco, CA"
        />
      </FormField>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Links</h3>
        
        <FormField label="GitHub" error={getError('profile.links.github')}>
          <input
            type="url"
            value={profile.links.github || ''}
            onChange={(e) => handleLinkChange('github', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://github.com/username"
          />
        </FormField>

        <FormField label="LinkedIn" error={getError('profile.links.linkedin')}>
          <input
            type="url"
            value={profile.links.linkedin || ''}
            onChange={(e) => handleLinkChange('linkedin', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://linkedin.com/in/username"
          />
        </FormField>

        <FormField label="Website" error={getError('profile.links.website')}>
          <input
            type="url"
            value={profile.links.website || ''}
            onChange={(e) => handleLinkChange('website', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://yourwebsite.com"
          />
        </FormField>

        <FormField label="Portfolio" error={getError('profile.links.portfolio')}>
          <input
            type="url"
            value={profile.links.portfolio || ''}
            onChange={(e) => handleLinkChange('portfolio', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://portfolio.com"
          />
        </FormField>
      </div>
    </div>
  );
}
