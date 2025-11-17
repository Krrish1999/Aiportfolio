import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomizationPanel } from '../CustomizationPanel';
import { CustomizationState } from '../TemplatePreview';

const mockCustomizations: CustomizationState = {
  theme: 'light',
  primaryColor: '#3B82F6',
  fontFamily: 'Inter, sans-serif',
  fontSize: 'medium',
  sectionOrder: ['profile', 'summary', 'skills', 'experience'],
  hiddenSections: [],
};

const availableSections = ['profile', 'summary', 'skills', 'experience', 'projects', 'education'];

describe('CustomizationPanel', () => {
  it('renders all customization options', () => {
    const onChange = vi.fn();
    render(
      <CustomizationPanel
        customizations={mockCustomizations}
        onCustomizationChange={onChange}
        availableSections={availableSections}
      />
    );

    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('Primary Color')).toBeInTheDocument();
    expect(screen.getByText('Font')).toBeInTheDocument();
    expect(screen.getByText('Font Size')).toBeInTheDocument();
    expect(screen.getByText('Section Order & Visibility')).toBeInTheDocument();
  });

  it('toggles theme between light and dark', () => {
    const onChange = vi.fn();
    render(
      <CustomizationPanel
        customizations={mockCustomizations}
        onCustomizationChange={onChange}
        availableSections={availableSections}
      />
    );

    const darkButton = screen.getByRole('button', { name: 'Dark' });
    fireEvent.click(darkButton);

    expect(onChange).toHaveBeenCalledWith({
      ...mockCustomizations,
      theme: 'dark',
    });
  });

  it('changes primary color', () => {
    const onChange = vi.fn();
    render(
      <CustomizationPanel
        customizations={mockCustomizations}
        onCustomizationChange={onChange}
        availableSections={availableSections}
      />
    );

    const purpleButton = screen.getByText('Purple').closest('button');
    fireEvent.click(purpleButton!);

    expect(onChange).toHaveBeenCalledWith({
      ...mockCustomizations,
      primaryColor: '#8B5CF6',
    });
  });

  it('changes font size', () => {
    const onChange = vi.fn();
    render(
      <CustomizationPanel
        customizations={mockCustomizations}
        onCustomizationChange={onChange}
        availableSections={availableSections}
      />
    );

    const largeButton = screen.getByRole('button', { name: 'Large' });
    fireEvent.click(largeButton);

    expect(onChange).toHaveBeenCalledWith({
      ...mockCustomizations,
      fontSize: 'large',
    });
  });

  it('moves section up in order', () => {
    const onChange = vi.fn();
    render(
      <CustomizationPanel
        customizations={mockCustomizations}
        onCustomizationChange={onChange}
        availableSections={availableSections}
      />
    );

    const moveUpButtons = screen.getAllByLabelText('Move up');
    // Click move up on 'summary' (index 1)
    fireEvent.click(moveUpButtons[1]);

    expect(onChange).toHaveBeenCalledWith({
      ...mockCustomizations,
      sectionOrder: ['summary', 'profile', 'skills', 'experience'],
    });
  });

  it('moves section down in order', () => {
    const onChange = vi.fn();
    render(
      <CustomizationPanel
        customizations={mockCustomizations}
        onCustomizationChange={onChange}
        availableSections={availableSections}
      />
    );

    const moveDownButtons = screen.getAllByLabelText('Move down');
    // Click move down on 'profile' (index 0)
    fireEvent.click(moveDownButtons[0]);

    expect(onChange).toHaveBeenCalledWith({
      ...mockCustomizations,
      sectionOrder: ['summary', 'profile', 'skills', 'experience'],
    });
  });

  it('disables move up for first section', () => {
    const onChange = vi.fn();
    render(
      <CustomizationPanel
        customizations={mockCustomizations}
        onCustomizationChange={onChange}
        availableSections={availableSections}
      />
    );

    const moveUpButtons = screen.getAllByLabelText('Move up');
    expect(moveUpButtons[0]).toBeDisabled();
  });

  it('disables move down for last section', () => {
    const onChange = vi.fn();
    render(
      <CustomizationPanel
        customizations={mockCustomizations}
        onCustomizationChange={onChange}
        availableSections={availableSections}
      />
    );

    const moveDownButtons = screen.getAllByLabelText('Move down');
    expect(moveDownButtons[moveDownButtons.length - 1]).toBeDisabled();
  });

  it('toggles section visibility', () => {
    const onChange = vi.fn();
    render(
      <CustomizationPanel
        customizations={mockCustomizations}
        onCustomizationChange={onChange}
        availableSections={availableSections}
      />
    );

    const visibilityButtons = screen.getAllByLabelText(/Toggle .* visibility/);
    // Click to hide 'summary' section (index 1, since profile is required)
    fireEvent.click(visibilityButtons[1]);

    expect(onChange).toHaveBeenCalledWith({
      ...mockCustomizations,
      hiddenSections: ['summary'],
    });
  });

  it('shows hidden sections with reduced opacity', () => {
    const customizationsWithHidden: CustomizationState = {
      ...mockCustomizations,
      hiddenSections: ['skills'],
    };
    
    render(
      <CustomizationPanel
        customizations={customizationsWithHidden}
        onCustomizationChange={vi.fn()}
        availableSections={availableSections}
      />
    );

    const skillsSection = screen.getByText('Skills').closest('div')?.parentElement;
    expect(skillsSection?.className).toContain('opacity-60');
  });

  it('prevents hiding profile section', () => {
    const onChange = vi.fn();
    render(
      <CustomizationPanel
        customizations={mockCustomizations}
        onCustomizationChange={onChange}
        availableSections={availableSections}
      />
    );

    const visibilityButtons = screen.getAllByLabelText(/Toggle .* visibility/);
    const profileButton = visibilityButtons[0];
    
    expect(profileButton).toBeDisabled();
  });

  it('unhides a hidden section when toggled', () => {
    const customizationsWithHidden: CustomizationState = {
      ...mockCustomizations,
      hiddenSections: ['summary'],
    };
    
    const onChange = vi.fn();
    render(
      <CustomizationPanel
        customizations={customizationsWithHidden}
        onCustomizationChange={onChange}
        availableSections={availableSections}
      />
    );

    const visibilityButtons = screen.getAllByLabelText(/Toggle .* visibility/);
    fireEvent.click(visibilityButtons[1]);

    expect(onChange).toHaveBeenCalledWith({
      ...customizationsWithHidden,
      hiddenSections: [],
    });
  });
});
