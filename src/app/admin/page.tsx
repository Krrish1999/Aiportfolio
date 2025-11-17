'use client';

import { useState } from 'react';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { ErrorCategorization } from '@/components/admin/ErrorCategorization';
import { ABTestingPanel } from '@/components/admin/ABTestingPanel';

type TabType = 'dashboard' | 'errors' | 'abtesting';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">System Monitoring</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Analytics Dashboard
            </button>
            <button
              onClick={() => setActiveTab('errors')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'errors'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Error Analysis
            </button>
            <button
              onClick={() => setActiveTab('abtesting')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'abtesting'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              A/B Testing
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && <AdminDashboard />}
        {activeTab === 'errors' && <ErrorCategorization />}
        {activeTab === 'abtesting' && <ABTestingPanel />}
      </div>
    </div>
  );
}
