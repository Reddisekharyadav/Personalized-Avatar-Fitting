'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Create Asset from Amazon Page
 * Requirement C & F: Asset creation from Amazon product links
 * 
 * User provides Amazon product URL, backend extracts image,
 * processes it, and creates RPM-compatible asset
 */

export default function CreateAssetPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    amazonUrl: '',
    title: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [assetId, setAssetId] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      // Validate Amazon URL
      if (!formData.amazonUrl.includes('amazon')) {
        throw new Error('Please provide a valid Amazon product URL');
      }

      const response = await fetch('/api/assets/create-from-amazon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create asset');
      }

      setAssetId(data.assetId);
      setSuccess(true);
      setLoading(false);

      // Redirect to wardrobe after 3 seconds
      setTimeout(() => {
        router.push('/wardrobe');
      }, 3000);

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">Create Asset from Amazon</h1>
            <button
              onClick={() => router.push('/wardrobe')}
              className="text-gray-600 hover:text-gray-800 flex items-center"
            >
              ← Back to Wardrobe
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {success ? (
            // Success State
            <div className="text-center py-8">
              <div className="text-green-600 text-6xl mb-4">✓</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Asset Creation Started!
              </h2>
              <p className="text-gray-600 mb-2">
                Your asset is being processed in the background.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Asset ID: <code className="bg-gray-100 px-2 py-1 rounded">{assetId}</code>
              </p>
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-6">
                <p className="text-sm">
                  Processing may take a few minutes. The asset will appear in your wardrobe
                  when ready. You'll be redirected shortly...
                </p>
              </div>
              <button
                onClick={() => router.push('/wardrobe')}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
              >
                Go to Wardrobe Now
              </button>
            </div>
          ) : (
            // Form State
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Add Clothing from Amazon
                </h2>
                <p className="text-gray-600">
                  Paste an Amazon product link to create a custom clothing asset for your avatar.
                </p>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-blue-800 mb-2">How it works:</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
                  <li>Find a clothing item on Amazon (shirt, jacket, pants, etc.)</li>
                  <li>Copy the product URL</li>
                  <li>Paste it below and give your asset a name</li>
                  <li>We'll extract the product image and create a wearable asset</li>
                  <li>Once ready, apply it to your avatar in the wardrobe</li>
                </ol>
              </div>

              {/* Legal Notice */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-xs text-yellow-800">
                  <strong>Note:</strong> This feature extracts publicly available product images
                  from Amazon for personal use only. Please respect Amazon's Terms of Service
                  and use responsibly.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label
                    htmlFor="amazonUrl"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Amazon Product URL *
                  </label>
                  <input
                    type="url"
                    id="amazonUrl"
                    name="amazonUrl"
                    value={formData.amazonUrl}
                    onChange={handleChange}
                    required
                    placeholder="https://www.amazon.com/dp/..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Example: https://www.amazon.com/dp/B08EXAMPLE or https://www.amazon.in/...
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="title"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Asset Name *
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Blue Denim Jacket"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Description (Optional)
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Add notes about this clothing item..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex space-x-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Creating Asset...
                      </span>
                    ) : (
                      'Create Asset'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push('/wardrobe')}
                    className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
