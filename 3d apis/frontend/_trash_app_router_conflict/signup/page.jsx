'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import RPMCreatorEmbed from '../../components/RPMCreatorEmbed';

/**
 * Signup Page with RPM Avatar Creation
 * Requirement E: /signup and /signup/avatar flow
 * Requirement L: Block progress until avatar created
 * 
 * Flow:
 * 1. User enters email/password
 * 2. Create account (POST /api/auth/signup)
 * 3. Show RPM Avatar Creator
 * 4. On avatar completion, POST to /api/avatar/receive
 * 5. Redirect to /wardrobe
 */

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState('register'); // 'register' | 'create-avatar' | 'processing'
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [userId, setUserId] = useState(null);
  const [token, setToken] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle form input
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Step 1: Create account
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Store user ID and token
      setUserId(data.user._id);
      setToken(data.token);

      // Move to avatar creation step
      setStep('create-avatar');
      setLoading(false);

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Step 2: Handle avatar creation from RPM
  const handleAvatarCreated = async (avatarData) => {
    console.log('Avatar created:', avatarData);
    setStep('processing');
    setError('');

    try {
      // Send avatar data to backend (Requirement C: POST /api/avatar/receive)
      const response = await fetch('/api/avatar/receive', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: userId,
          avatarId: avatarData.avatarId,
          rpmUrl: avatarData.rpmUrl,
          metadata: {
            bodyType: avatarData.bodyType,
            gender: avatarData.gender,
            skinTone: avatarData.skinTone,
            hairColor: avatarData.hairColor,
            ...avatarData.metadata
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save avatar');
      }

      console.log('Avatar saved successfully:', data);

      // Success! Redirect to wardrobe (Requirement E)
      setTimeout(() => {
        router.push('/wardrobe');
      }, 1000);

    } catch (err) {
      console.error('Avatar save error:', err);
      setError(err.message);
      setStep('create-avatar'); // Allow retry
    }
  };

  const handleAvatarError = (err) => {
    console.error('RPM error:', err);
    setError('Avatar creation failed. Please try again.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Create Your Account
        </h1>

        {/* Step indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center ${step === 'register' ? 'text-blue-600' : 'text-green-600'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'register' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
              }`}>
                {step === 'register' ? '1' : '✓'}
              </div>
              <span className="ml-2 font-medium">Register</span>
            </div>
            
            <div className="w-16 h-1 bg-gray-300"></div>
            
            <div className={`flex items-center ${
              step === 'register' ? 'text-gray-400' : 
              step === 'create-avatar' ? 'text-blue-600' : 'text-green-600'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'register' ? 'bg-gray-300 text-gray-600' :
                step === 'create-avatar' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
              }`}>
                {step === 'processing' ? '✓' : '2'}
              </div>
              <span className="ml-2 font-medium">Create Avatar</span>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Step 1: Registration Form */}
        {step === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Your username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Min. 6 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Creating Account...' : 'Continue to Avatar Creation'}
            </button>

            <p className="text-center text-sm text-gray-600 mt-4">
              Already have an account?{' '}
              <a href="/login" className="text-blue-600 hover:underline">
                Log in
              </a>
            </p>
          </form>
        )}

        {/* Step 2: Avatar Creation */}
        {step === 'create-avatar' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4">
              <p className="font-medium">Account created! Now create your 3D avatar.</p>
              <p className="text-sm mt-1">
                Upload a photo or use your camera to create a personalized avatar.
              </p>
            </div>

            <RPMCreatorEmbed
              onAvatarCreated={handleAvatarCreated}
              onError={handleAvatarError}
            />

            <p className="text-center text-sm text-gray-600 mt-4">
              This step is required to access your wardrobe.
            </p>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === 'processing' && (
          <div className="text-center py-12">
            <div className="inline-block w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-lg font-medium text-gray-700">Saving your avatar...</p>
            <p className="text-sm text-gray-600 mt-2">
              Redirecting to your wardrobe...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
