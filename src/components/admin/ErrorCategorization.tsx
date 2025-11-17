'use client';

import { useState, useEffect } from 'react';

interface ErrorCategory {
  category: string;
  count: number;
  percentage: number;
  examples: string[];
}

interface ErrorStats {
  totalErrors: number;
  byFormat: { format: string; count: number; percentage: number }[];
  byLayout: { layout: string; count: number; percentage: number }[];
  byField: { field: string; count: number; percentage: number }[];
  categories: ErrorCategory[];
}

export function ErrorCategorization() {
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchErrorStats();
  }, []);

  const fetchErrorStats = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would fetch from an API endpoint
      // For now, we'll use mock data
      const mockData: ErrorStats = {
        totalErrors: 156,
        byFormat: [
          { format: 'PDF', count: 89, percentage: 57.1 },
          { format: 'DOCX', count: 45, percentage: 28.8 },
          { format: 'TXT', count: 22, percentage: 14.1 },
        ],
        byLayout: [
          { layout: 'Multi-column', count: 67, percentage: 42.9 },
          { layout: 'Single-column', count: 34, percentage: 21.8 },
          { layout: 'Design-heavy', count: 55, percentage: 35.3 },
        ],
        byField: [
          { field: 'experience.dates', count: 45, percentage: 28.8 },
          { field: 'skills.categories', count: 38, percentage: 24.4 },
          { field: 'profile.phone', count: 29, percentage: 18.6 },
          { field: 'education.gpa', count: 24, percentage: 15.4 },
          { field: 'projects.links', count: 20, percentage: 12.8 },
        ],
        categories: [
          {
            category: 'Date Parsing',
            count: 45,
            percentage: 28.8,
            examples: [
              'Unable to parse date format: "Jan 2020 - Present"',
              'Ambiguous date range in experience section',
              'Missing end date in education entry',
            ],
          },
          {
            category: 'Layout Detection',
            count: 38,
            percentage: 24.4,
            examples: [
              'Multi-column layout caused text order confusion',
              'Sidebar content mixed with main content',
              'Header/footer text included in body',
            ],
          },
          {
            category: 'Field Extraction',
            count: 35,
            percentage: 22.4,
            examples: [
              'Phone number not detected in contact section',
              'Skills listed in paragraph format not extracted',
              'Project URLs not identified',
            ],
          },
          {
            category: 'Section Classification',
            count: 28,
            percentage: 17.9,
            examples: [
              'Projects section misclassified as experience',
              'Certifications not detected as separate section',
              'Summary merged with experience bullets',
            ],
          },
          {
            category: 'Content Quality',
            count: 10,
            percentage: 6.4,
            examples: [
              'Low-quality PDF scan with OCR errors',
              'Non-standard characters causing encoding issues',
              'Corrupted file metadata',
            ],
          },
        ],
      };

      setErrorStats(mockData);
    } catch (error) {
      console.error('Error fetching error stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading error statistics...</div>
      </div>
    );
  }

  if (!errorStats) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">No error data available</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Error Categorization
        </h2>
        <div className="text-3xl font-bold text-red-600 mb-2">
          {errorStats.totalErrors}
        </div>
        <p className="text-sm text-gray-600">Total parsing errors detected</p>
      </div>

      {/* Error Categories */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          Error Categories
        </h3>
        <div className="space-y-4">
          {errorStats.categories.map((category, index) => (
            <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
              <button
                onClick={() =>
                  setSelectedCategory(
                    selectedCategory === category.category ? null : category.category
                  )
                }
                className="w-full text-left"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-lg font-medium text-gray-900">
                    {category.category}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">
                      {category.count} errors ({category.percentage.toFixed(1)}%)
                    </span>
                    <svg
                      className={`w-5 h-5 transition-transform ${
                        selectedCategory === category.category ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-600 h-2 rounded-full"
                    style={{ width: `${category.percentage}%` }}
                  ></div>
                </div>
              </button>

              {selectedCategory === category.category && (
                <div className="mt-4 pl-4 border-l-2 border-gray-300">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Example Errors:
                  </h4>
                  <ul className="space-y-2">
                    {category.examples.map((example, exIndex) => (
                      <li key={exIndex} className="text-sm text-gray-600">
                        • {example}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Errors by Format */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          Errors by File Format
        </h3>
        <div className="space-y-3">
          {errorStats.byFormat.map((format, index) => (
            <div key={index}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">{format.format}</span>
                <span className="text-sm text-gray-500">
                  {format.count} errors ({format.percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-600 h-2 rounded-full"
                  style={{ width: `${format.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Errors by Layout */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          Errors by Layout Type
        </h3>
        <div className="space-y-3">
          {errorStats.byLayout.map((layout, index) => (
            <div key={index}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">{layout.layout}</span>
                <span className="text-sm text-gray-500">
                  {layout.count} errors ({layout.percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{ width: `${layout.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Most Problematic Fields */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          Most Problematic Fields
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Field
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Error Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Percentage
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {errorStats.byField.map((field, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {field.field}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {field.count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {field.percentage.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
