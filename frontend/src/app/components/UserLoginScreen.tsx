import { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, ChevronLeft, Zap } from 'lucide-react';

interface UserLoginScreenProps {
  onLogin: (credentials: { email: string; password: string }) => Promise<void>;
  onSwitchToSignUp: () => void;
  onBack: () => void;
}

export function UserLoginScreen({ onLogin, onSwitchToSignUp, onBack }: UserLoginScreenProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      await onLogin(formData);
    } catch (err: any) {
      setError(err?.message || 'Login failed');
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0b0d] via-[#0f1012] to-[#141518] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-6 left-6 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200 backdrop-blur-xl z-10 group"
      >
        <ChevronLeft className="w-5 h-5 text-gray-300 group-hover:text-white transition-colors" />
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Glass card */}
        <div className="glass-effect backdrop-blur-2xl rounded-3xl p-8 border border-white/10 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center justify-center gap-3 mb-4"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl blur-lg opacity-50"></div>
                <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 p-2.5 rounded-xl">
                  <Zap className="w-7 h-7 text-white" />
                </div>
              </div>
              <h1 className="text-3xl font-bold gradient-text">UrbiX</h1>
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome back!</h2>
            <p className="text-gray-400">Sign in to your account</p>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email field */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="marie@example.com"
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-14 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot password link */}
            <div className="text-right">
              <a href="#" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                Forgot password?
              </a>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </form>

          {/* Switch to sign up */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              New to UrbiX?{' '}
              <button
                onClick={onSwitchToSignUp}
                className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
              >
                Create an account
              </button>
            </p>
          </div>

          {/* Demo notice */}
          <div className="mt-6 p-4 rounded-xl bg-indigo-600/10 border border-indigo-500/20">
            <p className="text-xs text-indigo-400 text-center">
              Demo: Use any email/password
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
