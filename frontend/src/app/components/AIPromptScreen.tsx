import { useState } from 'react';
import { Bus, Bike, Car, Footprints, Users, Sparkles, ArrowRight, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface AIPromptScreenProps {
  onStartPlanning: (prompt: string) => void;
}

export function AIPromptScreen({ onStartPlanning }: AIPromptScreenProps) {
  const [prompt, setPrompt] = useState('');

  const examplePrompts = [
    "Cheapest way to Vieux-Montréal from Mile End",
    "Route to Mont-Royal avoiding steep hills",
    "Bus + bike combo to McGill University",
    "Free parking near Quartier des Spectacles + metro"
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onStartPlanning(prompt);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0b0d] via-[#0f1012] to-[#141518] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl w-full relative z-10"
      >
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-4 mb-6"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl blur-xl opacity-50"></div>
              <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 p-3 rounded-2xl">
                <Zap className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className="text-6xl font-bold gradient-text">UrbiX</h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl text-gray-400 max-w-2xl mx-auto"
          >
            Premium intelligent mobility for Montréal
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm text-gray-500 mt-2"
          >
            Powered by Prysmatik • Unified transit experience
          </motion.p>
        </div>

        {/* Transport Mode Icons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center gap-4 mb-12"
        >
          {[
            { icon: Bus, gradient: 'from-blue-600 to-cyan-600' },
            { icon: Bike, gradient: 'from-emerald-600 to-green-600' },
            { icon: Car, gradient: 'from-purple-600 to-pink-600' },
            { icon: Users, gradient: 'from-orange-600 to-amber-600' },
            { icon: Footprints, gradient: 'from-teal-600 to-cyan-600' }
          ].map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0, rotate: -180 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{
                delay: 0.7 + idx * 0.1,
                type: "spring",
                stiffness: 200,
                damping: 15
              }}
              className="relative group"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} rounded-2xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-300`}></div>
              <div className={`relative p-4 rounded-2xl bg-gradient-to-br ${item.gradient} backdrop-blur-xl border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-110`}>
                <item.icon className="w-6 h-6 text-white" />
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Main Prompt Input */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="glass-effect rounded-3xl p-8 mb-6 shadow-2xl"
        >
          <label className="block mb-6">
            <span className="text-lg font-semibold text-white mb-3 block flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Where do you want to go?
            </span>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="E.g., 'Get me to Plateau Mont-Royal in under 30 minutes, I prefer biking...'"
                className="w-full px-5 py-4 pr-14 rounded-2xl bg-white/5 border border-white/10 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none text-white placeholder:text-gray-500 transition-all duration-200"
                rows={4}
              />
              <div className="absolute top-4 right-4 pointer-events-none">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center opacity-30">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          </label>

          <button
            type="submit"
            disabled={!prompt.trim()}
            className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 hover:from-indigo-500 hover:via-purple-500 hover:to-cyan-500 disabled:from-gray-700 disabled:via-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:scale-[1.02] disabled:hover:scale-100"
          >
            <span>Plan my journey</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.form>

        {/* Example Prompts */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="space-y-4"
        >
          <p className="text-sm text-gray-500 text-center mb-4 flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" />
            Popular routes in Montréal
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {examplePrompts.map((example, idx) => (
              <motion.button
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 + idx * 0.1 }}
                onClick={() => setPrompt(example)}
                className="text-left px-5 py-4 glass-effect hover:bg-white/10 border border-white/10 hover:border-indigo-500/30 rounded-2xl text-sm text-gray-300 hover:text-white transition-all duration-200 group"
              >
                <span className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-indigo-400 transition-colors" />
                  {example}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Footer tagline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="text-center mt-12"
        >
          <p className="text-xs text-gray-600">
            Intelligent routing • Real-time data • Multi-modal optimization
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
