import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { setAccessToken } from '../lib/auth';
import { SetupMode } from '../lib/types';
import { toast } from 'sonner';

const SimpleLogo = ({ size = 64 }: { size?: number }) => (
  <div
    className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-3xl"
    style={{ width: size, height: size }}
  >
    IP
  </div>
);

export const Setup = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'mode' | 'admin'>('mode');
  const [mode, setMode] = useState<SetupMode>('personal');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleModeSelect = (selectedMode: SetupMode) => {
    setMode(selectedMode);
    setStep('admin');
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName) {
      toast.error('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.initSetup(email, password, displayName, mode);
      setAccessToken(response.session.access_token);
      apiClient.setToken(response.session.access_token);
      toast.success('Setup complete! Welcome to Docker Panel');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Setup error:', error);
      toast.error(error.response?.data?.error || 'Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'mode') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex justify-center mb-6">
              <SimpleLogo size={64} />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
              Welcome to Docker Panel
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Let's set up your self-hosted Docker management platform
            </p>
          </div>

          {/* Mode Selection */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6">
              Choose Your Setup Mode
            </h2>

            <button
              onClick={() => handleModeSelect('personal')}
              className="w-full p-6 border-2 border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left"
            >
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                🏠 Personal Mode
              </h3>
              <p className="text-slate-600 dark:text-slate-300 mb-3">
                Self-hosted Docker panel for your apps
              </p>
              <ul className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
                <li>✓ Simple Docker app management</li>
                <li>✓ Start, stop, restart containers</li>
                <li>✓ View logs and configure environments</li>
                <li>✓ Perfect for hobby projects and self-hosting</li>
              </ul>
            </button>

            <button
              onClick={() => handleModeSelect('business')}
              className="w-full p-6 border-2 border-slate-200 dark:border-slate-700 rounded-lg hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all text-left"
            >
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                🚀 Hosting Business Mode
              </h3>
              <p className="text-slate-600 dark:text-slate-300 mb-3">
                Full-featured hosting control panel
              </p>
              <ul className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
                <li>✓ All Personal Mode features</li>
                <li>✓ Customer account management</li>
                <li>✓ Plans, pricing, and billing</li>
                <li>✓ White-label and team management</li>
              </ul>
            </button>
          </div>

          {/* Info */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Note:</strong> You can change modes later. Personal Mode is recommended for
              most self-hosters.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <SimpleLogo size={48} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Create Admin Account
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-2">
            {mode === 'personal'
              ? 'Setting up Personal Mode'
              : 'Setting up Hosting Business Mode'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleCreateAdmin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Setting up...' : 'Complete Setup'}
          </button>

          <button
            type="button"
            onClick={() => setStep('mode')}
            disabled={loading}
            className="w-full px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            Back to Mode Selection
          </button>
        </form>
      </div>
    </div>
  );
};
