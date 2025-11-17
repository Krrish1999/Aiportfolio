import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ABTestingPanel } from '../ABTestingPanel';

describe('ABTestingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render A/B testing panel', () => {
    render(<ABTestingPanel />);

    expect(screen.getByText('A/B Testing')).toBeInTheDocument();
    expect(screen.getByText('Create New Test')).toBeInTheDocument();
  });

  it('should display existing tests', () => {
    render(<ABTestingPanel />);

    expect(screen.getByText('Bio Generation Prompt Optimization')).toBeInTheDocument();
    expect(screen.getByText('Template Layout Comparison')).toBeInTheDocument();
  });

  it('should show test status badges', () => {
    render(<ABTestingPanel />);

    expect(screen.getByText('RUNNING')).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
  });

  it('should display variant details', () => {
    render(<ABTestingPanel />);

    expect(screen.getByText('Original Prompt')).toBeInTheDocument();
    expect(screen.getByText('Enhanced Prompt')).toBeInTheDocument();
    expect(screen.getByText('Minimal Template')).toBeInTheDocument();
    expect(screen.getByText('Modern Template')).toBeInTheDocument();
  });

  it('should show conversion rates', () => {
    render(<ABTestingPanel />);

    // Check for conversion rate percentages
    const conversionRates = screen.getAllByText(/\d+\.\d+%/);
    expect(conversionRates.length).toBeGreaterThan(0);
  });

  it('should display winner badge for completed tests', () => {
    render(<ABTestingPanel />);

    const winnerBadges = screen.getAllByText('WINNER');
    expect(winnerBadges.length).toBeGreaterThan(0);
  });

  it('should show statistical significance', () => {
    render(<ABTestingPanel />);

    expect(screen.getByText('Statistical Significance:')).toBeInTheDocument();
  });

  it('should open create test modal when button clicked', async () => {
    render(<ABTestingPanel />);

    const createButton = screen.getByText('Create New Test');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create New A/B Test')).toBeInTheDocument();
    });
  });

  it('should close modal when cancel button clicked', async () => {
    render(<ABTestingPanel />);

    const createButton = screen.getByText('Create New Test');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create New A/B Test')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Create New A/B Test')).not.toBeInTheDocument();
    });
  });

  it('should allow selecting test type in modal', async () => {
    render(<ABTestingPanel />);

    const createButton = screen.getByText('Create New Test');
    fireEvent.click(createButton);

    await waitFor(() => {
      const testTypeSelect = screen.getByLabelText('Test Type');
      expect(testTypeSelect).toBeInTheDocument();
    });
  });

  it('should display traffic and conversion metrics', () => {
    render(<ABTestingPanel />);

    expect(screen.getByText('Traffic:')).toBeInTheDocument();
    expect(screen.getByText('Conversions:')).toBeInTheDocument();
    expect(screen.getByText('Conversion Rate:')).toBeInTheDocument();
  });

  it('should show average confidence scores', () => {
    render(<ABTestingPanel />);

    expect(screen.getByText('Avg Confidence:')).toBeInTheDocument();
  });

  it('should display test dates', () => {
    render(<ABTestingPanel />);

    expect(screen.getByText(/Started:/)).toBeInTheDocument();
  });

  it('should handle test creation', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    render(<ABTestingPanel />);

    const createButton = screen.getByText('Create New Test');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create New A/B Test')).toBeInTheDocument();
    });

    const testNameInput = screen.getByPlaceholderText(/e\.g\., Experience Bullet/);
    fireEvent.change(testNameInput, { target: { value: 'New Test' } });

    const createTestButton = screen.getByRole('button', { name: 'Create Test' });
    fireEvent.click(createTestButton);

    expect(consoleSpy).toHaveBeenCalledWith('Creating test:', expect.any(Object));
    consoleSpy.mockRestore();
  });
});
