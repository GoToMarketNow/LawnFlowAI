import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, AlertCircle, Loader2, CreditCard } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface GetPaidStepProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
  userId?: number;
  businessId?: number;
  sessionId?: number;
}

const PAYMENT_METHODS = [
  { id: 'cash', name: 'Cash', recommended: true },
  { id: 'check', name: 'Check', recommended: true },
  { id: 'ach', name: 'ACH', recommended: true },
  { id: 'credit_card', name: 'Credit Card', recommended: true },
  { id: 'apple_pay', name: 'Apple Pay', recommended: false },
  { id: 'google_pay', name: 'Google Pay', recommended: false },
];

function TestPaymentForm({ 
  clientSecret, 
  onSuccess, 
  onCancel 
}: { 
  clientSecret: string; 
  onSuccess: () => void; 
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        toast({
          title: "Test Payment Successful!",
          description: "Your payment processing is verified and working.",
        });
        onSuccess();
      }
    } catch (error) {
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border rounded-lg">
        <PaymentElement />
      </div>
      <div className="flex gap-2">
        <Button 
          type="submit" 
          disabled={!stripe || processing}
          className="flex-1"
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Pay $0.01
            </>
          )}
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          disabled={processing}
        >
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Use test card: 4242 4242 4242 4242 | Any future date | Any CVC
      </p>
    </form>
  );
}

export function GetPaidStep({ data, onChange, userId, businessId, sessionId }: GetPaidStepProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const selectedMethods = data.payment_methods || ['cash', 'check'];
  const bankConnected = data.bank_connected || false;
  const testPaymentVerified = data.test_payment_verified || false;

  const toggleMethod = (methodId: string) => {
    const newMethods = selectedMethods.includes(methodId)
      ? selectedMethods.filter((id: string) => id !== methodId)
      : [...selectedMethods, methodId];
    onChange({ payment_methods: newMethods });
  };

  const handleConnectBank = async () => {
    // Simulate bank connection (in real app, would open Plaid/Stripe Connect)
    setLoading(true);
    
    // In development, simulate success after 1 second
    if (import.meta.env.DEV) {
      setTimeout(() => {
        onChange({ bank_connected: true });
        setLoading(false);
        toast({
          title: "Bank Connected",
          description: "Your bank account has been connected successfully.",
        });
      }, 1000);
    } else {
      // In production, integrate with Plaid or Stripe Connect
      onChange({ bank_connected: true });
      setLoading(false);
    }
  };

  const handleRunTestPayment = async () => {
    if (!userId || !businessId) {
      toast({
        title: "Missing Information",
        description: "User or business information is missing.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Create test payment intent
      const response = await apiRequest<{ ok: boolean; paymentIntent: any }>(
        '/api/test-payment/create',
        {
          method: 'POST',
          body: JSON.stringify({ userId, businessId, sessionId }),
        }
      );

      if (response.ok && response.paymentIntent) {
        setClientSecret(response.paymentIntent.clientSecret);
        setShowPaymentForm(true);
        
        toast({
          title: "Test Payment Ready",
          description: "Enter test card details to verify payment processing.",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to Create Test Payment",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateSuccess = async () => {
    if (!userId || !businessId) return;

    setLoading(true);
    try {
      await apiRequest('/api/test-payment/simulate-success', {
        method: 'POST',
        body: JSON.stringify({ userId, businessId, sessionId }),
      });

      onChange({ test_payment_verified: true });
      toast({
        title: "Test Payment Verified",
        description: "Payment processing has been simulated successfully.",
      });
    } catch (error) {
      toast({
        title: "Simulation Failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    onChange({ test_payment_verified: true });
    setShowPaymentForm(false);
    setClientSecret(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-yellow-900">Critical Step</p>
            <p className="text-sm text-yellow-800 mt-1">
              You must complete payment setup to finish onboarding. This ensures you can get paid for jobs.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div>
        <h3 className="text-lg font-semibold mb-2">How Can Customers Pay You? *</h3>
        <div className="space-y-2">
          {PAYMENT_METHODS.map((method) => (
            <div key={method.id} className="flex items-center space-x-2">
              <Checkbox
                id={method.id}
                checked={selectedMethods.includes(method.id)}
                onCheckedChange={() => toggleMethod(method.id)}
              />
              <Label htmlFor={method.id} className="font-normal cursor-pointer flex items-center gap-2">
                {method.name}
                {method.recommended && (
                  <Badge variant="secondary" className="text-xs">Recommended</Badge>
                )}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Bank Connection */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Connect Your Bank *</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Securely connect your bank account to receive digital payments.
        </p>
        <Button
          variant={bankConnected ? "outline" : "default"}
          onClick={handleConnectBank}
          disabled={bankConnected || loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : bankConnected ? (
            <>
              <Check className="h-4 w-4 mr-2 text-green-600" />
              Bank Connected
            </>
          ) : (
            'Connect Bank Account'
          )}
        </Button>
      </div>

      {/* Test Payment */}
      {bankConnected && !testPaymentVerified && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Test Payment ($0.01) *</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Let's verify everything works with a micro-transaction.
          </p>
          
          {!showPaymentForm ? (
            <div className="flex gap-2">
              <Button
                onClick={handleRunTestPayment}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  'Run Test Payment'
                )}
              </Button>
              
              {import.meta.env.DEV && (
                <Button
                  variant="outline"
                  onClick={handleSimulateSuccess}
                  disabled={loading}
                >
                  Simulate Success (Dev Only)
                </Button>
              )}
            </div>
          ) : clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <TestPaymentForm
                clientSecret={clientSecret}
                onSuccess={handlePaymentSuccess}
                onCancel={() => {
                  setShowPaymentForm(false);
                  setClientSecret(null);
                }}
              />
            </Elements>
          )}
        </div>
      )}

      {/* Test Payment Verified */}
      {testPaymentVerified && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex gap-2">
            <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-900">Test Payment Successful!</p>
              <p className="text-sm text-green-800 mt-1">
                Your payment processing is verified and working correctly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {bankConnected && testPaymentVerified && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex gap-2">
            <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-900">Payment Setup Complete!</p>
              <p className="text-sm text-green-800 mt-1">
                You're ready to receive payments from customers.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
