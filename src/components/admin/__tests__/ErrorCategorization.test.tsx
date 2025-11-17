import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ErrorCategorization } from '../ErrorCategorization';

describe('ErrorCategorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render error categorization component', async () => {
    render(<ErrorCategorization />);

    await waitFor(() => {
      expect(screen.getByText('Error Categorization')).toBeInTheDocument();
    });
  });

  it('should display total error count', async () => {
    render(<ErrorCategorization />);

    await waitFor(() => {
      expect(screen.getByText('156')).toBeInTheDocument();
      expect(screen.getByText('Total parsing errors detected')).toBeInTheDocument();
    });
  });

  it('should display error categories', async () => {
    render(<ErrorCategorization />);

    await waitFor(() => {
      expect(screen.getByText('Date Parsing')).toBeInTheDocument();
      expect(screen.getByText('Layout Detection')).toBeInTheDocument();
      expect(screen.getByText('Field Extraction')).toBeInTheDocument();
      expect(screen.getByText('Section Classification')).toBeInTheDocument();
      expect(screen.getByText('Content Quality')).toBeInTheDocument();
    });
  });

  it('should expand category to show examples when clicked', async () => {
    render(<ErrorCategorization />);

    await waitFor(() => {
      expect(screen.getByText('Date Parsing')).toBeInTheDocument();
    });

    const dateParsingButton = screen.getByText('Date Parsing').closest('button');
    if (dateParsingButton) {
      fireEvent.click(dateParsingButton);

      await waitFor(() => {
        expect(screen.getByText('Example Errors:')).toBeInTheDocument();
        expect(
          screen.getByText(/Unable to parse date format/)
        ).toBeInTheDocument();
      });
    }
  });

  it('should collapse category when clicked again', async () => {
    render(<ErrorCategorization />);

    await waitFor(() => {
      expect(screen.getByText('Layout Detection')).toBeInTheDocument();
    });

    const layoutButton = screen.getByText('Layout Detection').closest('button');
    if (layoutButton) {
      // Expand
      fireEvent.click(layoutButton);
      await waitFor(() => {
        expect(screen.getByText('Example Errors:')).toBeInTheDocument();
      });

      // Collapse
      fireEvent.click(layoutButton);
      await waitFor(() => {
        expect(screen.queryByText('Example Errors:')).not.toBeInTheDocument();
      });
    }
  });

  it('should display errors by file format', async () => {
    render(<ErrorCategorization />);

    await waitFor(() => {
      expect(screen.getByText('Errors by File Format')).toBeInTheDocument();
      expect(screen.getByText('PDF')).toBeInTheDocument();
      expect(screen.getByText('DOCX')).toBeInTheDocument();
      expect(screen.getByText('TXT')).toBeInTheDocument();
    });
  });

  it('should display errors by layout type', async () => {
    render(<ErrorCategorization />);

    await waitFor(() => {
      expect(screen.getByText('Errors by Layout Type')).toBeInTheDocument();
      expect(screen.getByText('Multi-column')).toBeInTheDocument();
      expect(screen.getByText('Single-column')).toBeInTheDocument();
      expect(screen.getByText('Design-heavy')).toBeInTheDocument();
    });
  });

  it('should display most problematic fields table', async () => {
    render(<ErrorCategorization />);

    await waitFor(() => {
      expect(screen.getByText('Most Problematic Fields')).toBeInTheDocument();
      expect(screen.getByText('experience.dates')).toBeInTheDocument();
      expect(screen.getByText('skills.categories')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    render(<ErrorCategorization />);

    expect(screen.getByText('Loading error statistics...')).toBeInTheDocument();
  });

  it('should display percentages for error categories', async () => {
    render(<ErrorCategorization />);

    await waitFor(() => {
      expect(screen.getByText(/28\.8%/)).toBeInTheDocument();
      expect(screen.getByText(/24\.4%/)).toBeInTheDocument();
    });
  });
});
