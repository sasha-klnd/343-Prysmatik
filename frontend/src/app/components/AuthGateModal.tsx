import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, Sparkles } from 'lucide-react';

interface AuthGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignUp: () => void;
  onLogin: () => void;
  actionType?: string;
}

export function AuthGateModal({ isOpen, onClose, onSignUp, onLogin, actionType = 'cette action' }: AuthGateModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-6 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="pointer-events-auto w-full max-w-md"
            >
              <div className="glass-effect backdrop-blur-2xl rounded-3xl p-8 border border-white/10 shadow-2xl relative">
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>

                {/* Icon */}
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl blur-xl opacity-50"></div>
                    <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 p-4 rounded-2xl">
                      <Lock className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-white text-center mb-3">
                  Account required
                </h2>

                {/* Description */}
                <p className="text-gray-300 text-center mb-6 leading-relaxed">
                  Create an account to <span className="text-indigo-400 font-semibold">{actionType}</span> and save your activity.
                </p>

                {/* Action buttons */}
                <div className="space-y-3 mb-6">
                  <button
                    onClick={onSignUp}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold transition-all duration-200 shadow-lg shadow-indigo-600/30"
                  >
                    Create an account
                  </button>

                  <button
                    onClick={onLogin}
                    className="w-full py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold transition-all duration-200"
                  >
                    Sign in
                  </button>
                </div>

                {/* Footer note */}
                <div className="pt-6 border-t border-white/10">
                  <p className="text-sm text-gray-400 text-center flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span>
                      You can always use UrbiX AI in guest mode
                    </span>
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
