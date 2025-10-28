'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import { 
  Lock, 
  Zap, 
  ShieldCheck, 
  TrendingUp, 
  TrendingDown,
  Eye,
  EyeOff,
  Shuffle,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react';

interface OrderForm {
  side: 'buy' | 'sell';
  quantity: string;
  priceType: 'market' | 'limit';
  limitPrice: string;
  slippage: number;
}

interface EncryptionProgress {
  step: 'encrypting' | 'proof_generation' | 'submission' | 'complete';
  progress: number;
  message: string;
}

export default function AdvancedTradingForm() {
  const [form, setForm] = useState<OrderForm>({
    side: 'buy',
    quantity: '',
    priceType: 'market',
    limitPrice: '',
    slippage: 0.5
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [encryptionProgress, setEncryptionProgress] = useState<EncryptionProgress | null>(null);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);
  const [estimatedGas, setEstimatedGas] = useState(0.003);
  const [currentPrice] = useState(151.25);
  const [walletConnected, setWalletConnected] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  // Simulated wallet connection
  const connectWallet = async () => {
    setIsSubmitting(true);
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    setWalletConnected(true);
    setIsSubmitting(false);
  };

  // Simulate order encryption and submission
  const submitOrder = async () => {
    if (!walletConnected) {
      await connectWallet();
      return;
    }

    setIsSubmitting(true);
    
    // Encryption progress simulation
    const steps: EncryptionProgress[] = [
      { step: 'encrypting', progress: 25, message: 'Encrypting order with ElGamal...' },
      { step: 'proof_generation', progress: 60, message: 'Generating zero-knowledge proofs...' },
      { step: 'submission', progress: 90, message: 'Submitting to dark pool...' },
      { step: 'complete', progress: 100, message: 'Order submitted successfully!' }
    ];

    for (const step of steps) {
      setEncryptionProgress(step);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Reset after completion
    setTimeout(() => {
      setEncryptionProgress(null);
      setIsSubmitting(false);
      // Reset form
      setForm(prev => ({ ...prev, quantity: '', limitPrice: '' }));
    }, 2000);
  };

  const updateForm = (field: keyof OrderForm, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const estimatedTotal = parseFloat(form.quantity || '0') * 
    (form.priceType === 'market' ? currentPrice : parseFloat(form.limitPrice || '0'));

  const isFormValid = form.quantity && 
    (form.priceType === 'market' || form.limitPrice) &&
    parseFloat(form.quantity) > 0;

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="bg-black/40 border-gray-800 text-white backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Dark Pool Trading
            </CardTitle>
            <Badge variant="outline" className="text-green-400 border-green-400">
              <Lock className="w-3 h-3 mr-1" />
              Encrypted
            </Badge>
          </div>
          <CardDescription className="text-gray-400">
            Submit privacy-preserving orders to the encrypted order book
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {!walletConnected ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Connect Wallet to Trade</h3>
              <p className="text-gray-400 mb-4 text-sm">
                Connect your Solana wallet to start trading in the encrypted dark pool
              </p>
              <Button 
                onClick={connectWallet}
                disabled={isSubmitting}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect Phantom Wallet'
                )}
              </Button>
            </div>
          ) : (
            <>
              {/* Order Side Tabs */}
              <Tabs value={form.side} onValueChange={(value: string) => updateForm('side', value as 'buy' | 'sell')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-gray-800">
                  <TabsTrigger value="buy" className="text-white data-[state=active]:bg-green-600">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Buy
                  </TabsTrigger>
                  <TabsTrigger value="sell" className="text-white data-[state=active]:bg-red-600">
                    <TrendingDown className="w-4 h-4 mr-2" />
                    Sell
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={form.side} className="space-y-4 mt-4">
                  {/* Order Type */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">Order Type</Label>
                    <Tabs value={form.priceType} onValueChange={(value: string) => updateForm('priceType', value as 'market' | 'limit')}>
                      <TabsList className="grid w-full grid-cols-2 bg-gray-800">
                        <TabsTrigger value="market" className="text-white">Market</TabsTrigger>
                        <TabsTrigger value="limit" className="text-white">Limit</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Quantity Input */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">Quantity (SOL)</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={form.quantity}
                      onChange={(e) => updateForm('quantity', e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>

                  {/* Limit Price (if limit order) */}
                  {form.priceType === 'limit' && (
                    <div className="space-y-2">
                      <Label className="text-gray-300">Limit Price (USD)</Label>
                      <Input
                        type="number"
                        placeholder={currentPrice.toFixed(2)}
                        value={form.limitPrice}
                        onChange={(e) => updateForm('limitPrice', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                      />
                    </div>
                  )}

                  {/* Slippage for Market Orders */}
                  {form.priceType === 'market' && (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-gray-300">Slippage Tolerance</Label>
                        <span className="text-sm text-gray-400">{form.slippage}%</span>
                      </div>
                      <Slider
                        value={[form.slippage]}
                        onValueChange={(value: number[]) => updateForm('slippage', value[0])}
                        max={5}
                        min={0.1}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                  )}

                  {/* Order Summary */}
                  <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Current Price</span>
                      <span className="text-white">${currentPrice.toFixed(2)}</span>
                    </div>
                    
                    {form.quantity && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Estimated Total</span>
                        <span className="text-white">${estimatedTotal.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Network Fee</span>
                      <span className="text-white">{estimatedGas} SOL</span>
                    </div>
                  </div>

                  {/* Privacy Info */}
                  <div className="space-y-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPrivacyDetails(!showPrivacyDetails)}
                      className="text-blue-400 hover:text-blue-300 p-0 h-auto"
                    >
                      {showPrivacyDetails ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                      Privacy Details
                    </Button>
                    
                    {showPrivacyDetails && (
                      <Alert className="bg-blue-950/30 border-blue-800">
                        <ShieldCheck className="h-4 w-4" />
                        <AlertDescription className="text-blue-200 text-xs space-y-1">
                          <div>• Order encrypted with ElGamal homomorphic encryption</div>
                          <div>• VRF ensures fair order shuffling</div>
                          <div>• Zero-knowledge proofs for privacy</div>
                          <div>• 3-of-5 threshold decryption</div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Submit Button */}
                  <Button
                    onClick={submitOrder}
                    disabled={!isFormValid || isSubmitting}
                    className={`w-full ${
                      form.side === 'buy' 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        {form.side === 'buy' ? 'Submit Buy Order' : 'Submit Sell Order'}
                      </>
                    )}
                  </Button>
                </TabsContent>
              </Tabs>
            </>
          )}

          {/* Encryption Progress */}
          {encryptionProgress && (
            <div className="space-y-3">
              <Alert className="bg-blue-950/30 border-blue-800">
                <div className="flex items-center gap-2">
                  {encryptionProgress.step === 'complete' ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  <AlertDescription className="text-blue-200">
                    {encryptionProgress.message}
                  </AlertDescription>
                </div>
              </Alert>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Progress</span>
                  <span>{encryptionProgress.progress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${encryptionProgress.progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Real-time Info */}
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Next round: 30s</span>
            </div>
            <div className="flex items-center gap-1">
              <Shuffle className="w-3 h-3" />
              <span>VRF shuffling active</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}