import { useState, useRef, useEffect } from 'react';
import { Bus, Bike, Car, Footprints, Users, Sparkles, Send, ChevronDown, ChevronUp, DollarSign, Clock, Leaf, ArrowRight, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TransportPlan {
  id: string;
  title: string;
  isBest: boolean;
  totalTime: string;
  cost: string;
  modes: Array<{ type: string; icon: any; color: string }>;
  explanation: string;
  sustainability: 'high' | 'medium' | 'low';
  steps: Array<{ mode: string; duration: string; detail: string }>;
}

interface AIConversationScreenProps {
  initialPrompt: string;
  onViewMap: (plan: TransportPlan) => void;
}

export function AIConversationScreen({ initialPrompt, onViewMap }: AIConversationScreenProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'user', content: initialPrompt },
    { 
      role: 'assistant', 
      content: "I've analyzed your request and found the best routes for you. Here are my recommendations:" 
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [showPlans, setShowPlans] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mock AI-generated plans - Montréal context
  const plans: TransportPlan[] = [
    {
      id: '1',
      isBest: true,
      title: 'Express STM + Walk',
      totalTime: '28 min',
      cost: '$3.50',
      modes: [
        { type: 'Walk', icon: Footprints, color: 'text-emerald-400' },
        { type: 'Bus', icon: Bus, color: 'text-indigo-400' },
        { type: 'Walk', icon: Footprints, color: 'text-emerald-400' }
      ],
      explanation: 'Best balance of speed and cost. Minimal walking distance (8 min total), direct STM bus route with no transfers.',
      sustainability: 'high',
      steps: [
        { mode: 'Walk', duration: '5 min', detail: 'Walk to Parc & St-Viateur bus stop' },
        { mode: 'Bus #55', duration: '18 min', detail: 'Express route to Vieux-Montréal' },
        { mode: 'Walk', duration: '5 min', detail: 'Walk to destination on Rue Saint-Paul' }
      ]
    },
    {
      id: '2',
      isBest: false,
      title: 'BIXI Bike Share',
      totalTime: '22 min',
      cost: '$2.00',
      modes: [
        { type: 'Walk', icon: Footprints, color: 'text-emerald-400' },
        { type: 'Bike', icon: Bike, color: 'text-emerald-400' }
      ],
      explanation: 'Fastest option if you\'re comfortable biking. Weather forecast shows clear skies.',
      sustainability: 'high',
      steps: [
        { mode: 'Walk', duration: '2 min', detail: 'Walk to nearest BIXI station (8 bikes available)' },
        { mode: 'Bike', duration: '20 min', detail: 'Bike via de Maisonneuve protected bike lane' }
      ]
    },
    {
      id: '3',
      isBest: false,
      title: 'Drive + Park',
      totalTime: '35 min',
      cost: '$8.00',
      modes: [
        { type: 'Car', icon: Car, color: 'text-purple-400' },
        { type: 'Walk', icon: Footprints, color: 'text-emerald-400' }
      ],
      explanation: 'Convenient but slower due to traffic. Includes $6 parking fee in Vieux-Montréal.',
      sustainability: 'low',
      steps: [
        { mode: 'Drive', duration: '18 min', detail: 'Drive via Boulevard Saint-Laurent (moderate traffic)' },
        { mode: 'Park', duration: '12 min', detail: 'Find parking + walk to destination' }
      ]
    }
  ];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setMessages([...messages, 
      { role: 'user', content: inputValue },
      { role: 'assistant', content: "I've updated the routes based on your preferences. Let me know if you'd like me to adjust anything else!" }
    ]);
    setInputValue('');
  };

  const getSustainabilityColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-emerald-400 bg-emerald-600/20 border-emerald-500/30';
      case 'medium': return 'text-amber-400 bg-amber-600/20 border-amber-500/30';
      case 'low': return 'text-red-400 bg-red-600/20 border-red-500/30';
      default: return 'text-gray-400 bg-gray-600/20 border-gray-500/30';
    }
  };

  const PlanCard = ({ plan, idx }: { plan: TransportPlan; idx: number }) => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 + idx * 0.1 }}
      className={`glass-effect rounded-2xl shadow-2xl border transition-all ${ 
        plan.isBest 
          ? 'border-indigo-500/50 glow-effect' 
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      {plan.isBest && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold px-6 py-3 rounded-t-2xl flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          AI Recommended
        </div>
      )}
      
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">{plan.title}</h3>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {plan.totalTime}
              </div>
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" />
                {plan.cost}
              </div>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 border ${getSustainabilityColor(plan.sustainability)}`}>
            <Leaf className="w-3 h-3" />
            {plan.sustainability === 'high' ? 'Eco-friendly' : plan.sustainability === 'medium' ? 'Moderate' : 'High carbon'}
          </div>
        </div>

        {/* Modes */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {plan.modes.map((mode, mIdx) => (
            <div key={mIdx} className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
                <mode.icon className={`w-4 h-4 ${mode.color}`} />
                <span className="text-sm text-gray-300">{mode.type}</span>
              </div>
              {mIdx < plan.modes.length - 1 && (
                <ArrowRight className="w-4 h-4 text-gray-600" />
              )}
            </div>
          ))}
        </div>

        {/* Explanation */}
        <p className="text-gray-300 mb-4 leading-relaxed">{plan.explanation}</p>

        {/* Expandable Steps */}
        <div>
          <button
            onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
            className="text-indigo-400 hover:text-indigo-300 font-medium text-sm flex items-center gap-1.5 mb-3 transition-colors"
          >
            Detailed steps
            {expandedPlan === plan.id ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          
          <AnimatePresence>
            {expandedPlan === plan.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-2 overflow-hidden"
              >
                {plan.steps.map((step, sIdx) => (
                  <div key={sIdx} className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div className="text-sm font-semibold text-indigo-400 min-w-[100px]">
                      {step.mode}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-gray-300">{step.detail}</div>
                      <div className="text-xs text-gray-500 mt-1">{step.duration}</div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Button */}
        <button
          onClick={() => onViewMap(plan)}
          className="w-full mt-5 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
        >
          View on Map
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-[#0a0b0d] flex flex-col lg:flex-row">
      {/* Mobile Plans Toggle Button */}
      <button
        onClick={() => setShowPlans(!showPlans)}
        className="lg:hidden fixed bottom-6 right-6 z-50 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-full shadow-2xl flex items-center gap-2"
      >
        {showPlans ? 'Show Chat' : 'Show Plans'}
        <ArrowRight className="w-5 h-5" />
      </button>

      {/* Left Panel - Chat */}
      <div className={`${showPlans ? 'hidden lg:flex' : 'flex'} w-full lg:w-2/5 bg-[#0f1012] border-r border-white/10 flex-col`}>
        <div className="p-6 border-b border-white/10 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg blur-md opacity-50"></div>
              <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white">UrbiX Assistant</h2>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((message, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 ${ 
                message.role === 'user' 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' 
                  : 'glass-effect text-gray-200 border border-white/10'
              }`}>
                {message.content}
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-6 border-t border-white/10">
          <div className="flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Refine your preferences..."
              className="flex-1 px-5 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-white placeholder:text-gray-500 transition-all"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-xl transition-all shadow-lg shadow-indigo-600/20"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

      {/* Right Panel - Plans (Desktop) */}
      <div className="hidden lg:block flex-1 overflow-y-auto p-8 bg-[#0a0b0d]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8">Your Travel Plans</h2>
          <div className="space-y-5">
            {plans.map((plan, idx) => (
              <PlanCard key={plan.id} plan={plan} idx={idx} />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Plans View */}
      <div className={`${!showPlans ? 'hidden lg:hidden' : 'lg:hidden'} flex-1 overflow-y-auto p-6 bg-[#0a0b0d]`}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8">Your Travel Plans</h2>
          <div className="space-y-5 pb-24">
            {plans.map((plan, idx) => (
              <PlanCard key={plan.id} plan={plan} idx={idx} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}