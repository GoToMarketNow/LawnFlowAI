import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Loader2, RefreshCw, Smartphone, Shield } from "lucide-react";
import QRCode from 'qrcode.react';

interface VerificationStatusProps {
  sessionId: number;
  onVerificationComplete?: () => void;
}

interface VerificationState {
  web_verified: boolean;
  mobile_verified: boolean;
  device_binding?: {
    device_type: string;
    device_name: string;
    verified_at: string;
  };
  qr_code_token?: string;
}

export function VerificationStatus({ sessionId, onVerificationComplete }: VerificationStatusProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<VerificationState>({
    web_verified: true, // Already on web
    mobile_verified: false,
  });
  const [loading, setLoading] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    checkStatus();
    
    // Poll for status updates every 5 seconds
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const checkStatus = async () => {
    try {
      const response = await apiRequest<{ session: any }>(
        `/api/onboarding/session/${sessionId}`,
        { method: "GET" }
      );

      const newStatus = {
        web_verified: response.session.web_verified || true,
        mobile_verified: response.session.mobile_verified || false,
        device_binding: response.session.device_binding,
      };

      setStatus(newStatus);

      if (newStatus.web_verified && newStatus.mobile_verified && onVerificationComplete) {
        onVerificationComplete();
      }
    } catch (error) {
      console.error('Failed to check status:', error);
    }
  };

  const generateQRCode = async () => {
    setLoading(true);
    try {
      const response = await apiRequest<{ qr_data: any; token: string }>(
        `/api/onboarding/qr-code/${sessionId}`,
        { method: "GET" }
      );

      setQrData(response.qr_data);
      setShowQRCode(true);

      toast({
        title: "QR Code Generated",
        description: "Scan this with your mobile device to connect",
      });
    } catch (error) {
      toast({
        title: "Failed to generate QR code",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyWeb = async () => {
    setChecking(true);
    try {
      await apiRequest(`/api/onboarding/verify-web`, {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });

      setStatus((prev) => ({ ...prev, web_verified: true }));

      toast({
        title: "Web Verified",
        description: "Your web dashboard is working correctly",
      });
    } catch (error) {
      toast({
        title: "Verification failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Platform Verification
          </CardTitle>
          <CardDescription>
            Ensure both web and mobile platforms are working correctly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Web Verification */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${status.web_verified ? 'bg-green-100' : 'bg-gray-100'}`}>
                {status.web_verified ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <X className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <div>
                <p className="font-semibold">Web Dashboard</p>
                <p className="text-sm text-muted-foreground">
                  {status.web_verified ? 'Verified and working' : 'Not verified'}
                </p>
              </div>
            </div>
            {!status.web_verified && (
              <Button
                size="sm"
                onClick={verifyWeb}
                disabled={checking}
              >
                {checking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  'Verify'
                )}
              </Button>
            )}
          </div>

          <Separator />

          {/* Mobile Verification */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${status.mobile_verified ? 'bg-green-100' : 'bg-gray-100'}`}>
                {status.mobile_verified ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <Smartphone className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <div>
                <p className="font-semibold">Mobile App</p>
                {status.mobile_verified && status.device_binding ? (
                  <p className="text-sm text-muted-foreground">
                    {status.device_binding.device_name} connected
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Not connected - scan QR code below
                  </p>
                )}
              </div>
            </div>
            {status.mobile_verified ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Connected
              </Badge>
            ) : (
              <Badge variant="outline">Optional</Badge>
            )}
          </div>

          {/* QR Code Section */}
          {!status.mobile_verified && (
            <>
              <Separator />
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Connect Mobile App</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Scan the QR code with the LawnFlow mobile app to connect your device
                  </p>
                </div>

                {!showQRCode ? (
                  <Button onClick={generateQRCode} disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Smartphone className="h-4 w-4 mr-2" />
                        Generate QR Code
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="p-4 bg-white border-4 border-green-500 rounded-lg">
                      {qrData && (
                        <QRCode
                          value={JSON.stringify(qrData)}
                          size={200}
                          level="H"
                          includeMargin
                        />
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium mb-1">
                        1. Open LawnFlow mobile app
                      </p>
                      <p className="text-sm font-medium mb-1">
                        2. Tap "Scan QR Code"
                      </p>
                      <p className="text-sm font-medium">
                        3. Point camera at this code
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateQRCode}
                      disabled={loading}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerate Code
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      QR code expires in 15 minutes
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Overall Status */}
      {status.web_verified && status.mobile_verified && (
        <Card className="border-green-500 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Check className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">
                  All Platforms Verified
                </p>
                <p className="text-sm text-green-800">
                  Your account is fully set up and ready to use
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
