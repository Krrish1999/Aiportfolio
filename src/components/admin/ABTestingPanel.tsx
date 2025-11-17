'use client';

import { useState } from 'react';

interface ABTest {
  id: string;
  name: string;
  type: 'prompt' | 'template';
  status: 'draft' | 'running' | 'completed';
  variantA: {
    name: string;
    description: string;
    traffic: number;
    conversions: number;
    avgConfidence: number;
  };
  variantB: {
    name: string;
    description: string;
    traffic: number;
    conversions: number;
    avgConfidence: number;
  };
  startDate: string;
  endDate?: string;
  winner?: 'A' | 'B' | null;
}

export function ABTestingPanel() {
  const [tests, setTests] = useState<ABTest[]>([
    {
      id: 'test-1',
      name: 'Bio Generation Prompt Optimization',
      type: 'prompt',
      status: 'running',
      variantA: {
        name: 'Original Prompt',
        description: 'Standard bio generation with role focus',
        traffic: 156,
        conversions: 124,
        avgConfidence: 0.82,
      },
      variantB: {
        name: 'Enhanced Prompt',
        description: 'Bio generation with impact metrics emphasis',
        traffic: 148,
        conversions: 132,
        avgConfidence: 0.87,
      },
      startDate: '2024-01-15',
    },
    {
      id: 'test-2',
      name: 'Template Layout Comparison',
      type: 'template',
      status: 'completed',
      variantA: {
        name: 'Minimal Template',
        description: 'Clean, minimal design',
        traffic: 234,
        conversions: 198,
        avgConfidence: 0.85,
      },
      variantB: {
        name: 'Modern Template',
        description: 'Modern design with accent colors',
        traffic: 228,
        conversions: 205,
        avgConfidence: 0.86,
      },
      startDate: '2024-01-01',
      endDate: '2024-01-14',
      winner: 'B',
    },
  ]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTest, setNewTest] = useState<Partial<ABTest>>({
    type: 'prompt',
    status: 'draft',
  });

  const calculateConversionRate = (conversions: number, traffic: number) => {
    return traffic > 0 ? (conversions / traffic) * 100 : 0;
  };

  const calculateStatisticalSignificance = (test: ABTest) => {
    const rateA = calculateConversionRate(test.variantA.conversions, test.variantA.traffic);
    const rateB = calculateConversionRate(test.variantB.conversions, test.variantB.traffic);
    const diff = Math.abs(rateA - rateB);
    
    // Simplified significance calculation
    const totalTraffic = test.variantA.traffic + test.variantB.traffic;
    if (totalTraffic < 100) return 'Insufficient data';
    if (diff > 10) return 'High significance';
    if (diff > 5) return 'Moderate significance';
    return 'Low significance';
  };

  const handleCreateTest = () => {
    // In a real implementation, this would call an API
    console.log('Creating test:', newTest);
    setShowCreateModal(false);
    setNewTest({ type: 'prompt', status: 'draft' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-900">A/B Testing</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Create New Test
        </button>
      </div>

      {/* Active Tests */}
      <div className="space-y-4">
        {tests.map((test) => (
          <div key={test.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{test.name}</h3>
                <div className="flex gap-2 mt-2">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      test.status === 'running'
                        ? 'bg-green-100 text-green-800'
                        : test.status === 'completed'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {test.status.toUpperCase()}
                  </span>
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {test.type.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="text-right text-sm text-gray-500">
                <div>Started: {test.startDate}</div>
                {test.endDate && <div>Ended: {test.endDate}</div>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Variant A */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-medium text-gray-900">Variant A</h4>
                  {test.winner === 'A' && (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      WINNER
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-4">{test.variantA.description}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Traffic:</span>
                    <span className="font-medium">{test.variantA.traffic}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Conversions:</span>
                    <span className="font-medium">{test.variantA.conversions}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Conversion Rate:</span>
                    <span className="font-medium">
                      {calculateConversionRate(
                        test.variantA.conversions,
                        test.variantA.traffic
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg Confidence:</span>
                    <span className="font-medium">
                      {(test.variantA.avgConfidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Variant B */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-medium text-gray-900">Variant B</h4>
                  {test.winner === 'B' && (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      WINNER
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-4">{test.variantB.description}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Traffic:</span>
                    <span className="font-medium">{test.variantB.traffic}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Conversions:</span>
                    <span className="font-medium">{test.variantB.conversions}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Conversion Rate:</span>
                    <span className="font-medium">
                      {calculateConversionRate(
                        test.variantB.conversions,
                        test.variantB.traffic
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg Confidence:</span>
                    <span className="font-medium">
                      {(test.variantB.avgConfidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistical Significance */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Statistical Significance:</span>
                <span className="text-sm font-medium">{calculateStatisticalSignificance(test)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Test Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Create New A/B Test</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Test Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Experience Bullet Rewriting Test"
                  value={newTest.name || ''}
                  onChange={(e) => setNewTest({ ...newTest, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Test Type
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={newTest.type}
                  onChange={(e) =>
                    setNewTest({ ...newTest, type: e.target.value as 'prompt' | 'template' })
                  }
                >
                  <option value="prompt">Prompt</option>
                  <option value="template">Template</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Variant A Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Control"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Variant B Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Variation"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Traffic Split (%)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    defaultValue="50"
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-600">50/50</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTest}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
