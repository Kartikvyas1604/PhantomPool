'use client';

import { useState } from 'react';
import { Button } from './ui/button';
// Card component inline for simplicity
import { X, Wallet, Zap, ShoppingCart, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

interface DevnetTutorialProps {
  isVisible: boolean;
  onClose: () => void;
}

export function DevnetTutorial({ isVisible, onClose }: DevnetTutorialProps) {
  const [currentStep, setCurrentStep] = useState(1);
  
  if (!isVisible) return null;

  const steps = [
    {
      title: "Connect Your Phantom Wallet",
      icon: <Wallet className="w-6 h-6" />,
      description: "First, you need to connect your Phantom wallet to the application.",
      action: "Click the 'Connect' button in the header",
      tip: "Make sure you have Phantom wallet installed as a browser extension"
    },
    {
      title: "Ensure You Have Test SOL",
      icon: <Zap className="w-6 h-6" />,
      description: "You need test SOL to make trades. If your balance is low, you can get more.",
      action: "Check your SOL balance in header, or click 'Get SOL' for 1 extra SOL",
      tip: "You already have 6.999 SOL - that's perfect for testing! This is testnet SOL with no real value."
    },
    {
      title: "Create Your First Trade",
      icon: <ShoppingCart className="w-6 h-6" />,
      description: "Now you can create buy or sell orders in the dark pool.",
      action: "Use the trading form to place your first order",
      tip: "Start with small amounts to understand how encrypted trading works"
    },
    {
      title: "Watch Your Order Get Matched",
      icon: <CheckCircle className="w-6 h-6" />,
      description: "Your encrypted order will be matched with others in the next round.",
      action: "Monitor the matching process and see your trade execute",
      tip: "All orders are encrypted until matching for maximum privacy"
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Welcome to PhantomPool Devnet! 🚀
              </h2>
              <p className="text-slate-400">
                Learn how to make your first encrypted trade on Solana devnet
              </p>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Steps Progress */}
          <div className="flex items-center justify-between mb-8">
            {steps.map((_, index) => (
              <div key={index} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index + 1 <= currentStep
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-0.5 w-8 sm:w-16 mx-2 ${
                      index + 1 < currentStep
                        ? 'bg-purple-600'
                        : 'bg-slate-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Current Step */}
          <div className="bg-slate-800/50 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="bg-purple-600 p-3 rounded-lg">
                {steps[currentStep - 1].icon}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-2">
                  Step {currentStep}: {steps[currentStep - 1].title}
                </h3>
                <p className="text-slate-300 mb-3">
                  {steps[currentStep - 1].description}
                </p>
                
                <div className="bg-slate-700/50 rounded-lg p-3 mb-3">
                  <p className="font-medium text-white text-sm">
                    📋 Action: {steps[currentStep - 1].action}
                  </p>
                </div>
                
                <div className="flex items-start gap-2 text-sm text-blue-400">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>{steps[currentStep - 1].tip}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              variant="outline"
              className="border-slate-600 text-slate-300"
            >
              Previous
            </Button>
            
            <div className="flex items-center gap-2">
              {currentStep < steps.length ? (
                <Button
                  onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Next Step
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={onClose}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Start Trading!
                  <CheckCircle className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>

          {/* Devnet Warning */}
          <div className="mt-6 bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-400 mb-1">
                  This is Solana Testnet - Test Environment
                </h4>
                <p className="text-yellow-300 text-sm">
                  You're using test tokens with no real value. Your 6.999 SOL is perfect for learning 
                  how PhantomPool works without any financial risk. All SOL and tokens here 
                  are for testing purposes only.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}