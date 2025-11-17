import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AdminDashboard } from '../AdminDashboard';
import { AggregatedMetrics } from '@/services/analytics';

// Mock fetch
global.fetch = vi.fn();

const mockMetrics: AggregatedMetrics = {
  totalSessions: 150,
  publishedSessions: 120,
  conversionRate: 80,
  averageParsingAccuracy: 0.85,
  averageTimeToPublish: 900000, // 15 minutes
  averageEditCount: 3.5,
  mostEditedFields: [
    { fieldName: 'profile.phone', editCount: 45, avgConfidence: 0.65 },
    { fieldName: 'experience.dates', editCount: 38, avgConfidence: 0.72 },
    { fieldName: 'skills.categories', editCount: 32, avgConfidence: 0.78 },
  ],
  parsingAccuracyByFormat: [
    { format: 'pdf', accuracy: 0.87, count: 80 },
    { format: 'docx', accuracy: 0.82, count: 50 },
    { format: 'txt', accuracy: 0.79, count: 20 },
  ],
  lowConfidenceFields: [
    { fieldName: 'profile.phone', avgConfidence: 0.65, count: 45 },
    { fieldName: 'education.gpa', avgConfidence: 0.68, count: 32 },
  ],
};

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with initial data', () => {
    render(<AdminDashboard initialData={mockMetrics} />);

    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument(); // Total sessions
    expect(screen.getByText('120')).toBeInTheDocument(); // Published sessions
  });

  it('should display summary cards with correct values', () => {
    render(<AdminDashboard initialData={mockMetrics} />);

    expect(screen.getByText('Total Sessions')).toBeInTheDocument();
    expect(screen.getByText('Published Portfolios')).toBeInTheDocument();
    expect(screen.getByText('Avg Parsing Accuracy')).toBeInTheDocument();
    expect(screen.getByText('Avg Time to Publish')).toBeInTheDocument();
  });

  it('should display most edited fields table', () => {
    render(<AdminDashboard initialData={mockMetrics} />);

    expect(screen.getByText('Most Edited Fields')).toBeInTheDocument();
    expect(screen.getByText('profile.phone')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('should display parsing accuracy by format', () => {
    render(<AdminDashboard initialData={mockMetrics} />);

    expect(screen.getByText('Parsing Accuracy by Format')).toBeInTheDocument();
    expect(screen.getByText(/pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/docx/i)).toBeInTheDocument();
  });

  it('should display low confidence fields', () => {
    render(<AdminDashboard initialData={mockMetrics} />);

    expect(screen.getByText('Low Confidence Fields')).toBeInTheDocument();
    expect(screen.getByText('education.gpa')).toBeInTheDocument();
  });

  it('should fetch metrics when no initial data provided', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMetrics,
    });

    render(<AdminDashboard />);

    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });
  });

  it('should handle date range filter', async () => {
    render(<AdminDashboard initialData={mockMetrics} />);

    const startDateInput = screen.getByLabelText('Start Date');
    const endDateInput = screen.getByLabelText('End Date');

    fireEvent.change(startDateInput, { target: { value: '2024-01-01' } });
    fireEvent.change(endDateInput, { target: { value: '2024-01-31' } });

    expect(startDateInput).toHaveValue('2024-01-01');
    expect(endDateInput).toHaveValue('2024-01-31');
  });

  it('should refresh metrics when refresh button clicked', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockMetrics,
    });

    render(<AdminDashboard initialData={mockMetrics} />);

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('should display error message on fetch failure', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });

  it('should format time duration correctly', () => {
    render(<AdminDashboard initialData={mockMetrics} />);

    // 900000ms = 15 minutes
    expect(screen.getByText('15m 0s')).toBeInTheDocument();
  });

  it('should color-code confidence scores', () => {
    render(<AdminDashboard initialData={mockMetrics} />);

    const confidenceElements = screen.getAllByText(/\d+\.\d+%/);
    expect(confidenceElements.length).toBeGreaterThan(0);
  });
});
