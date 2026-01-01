import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Leaf, Phone, CheckCircle } from "lucide-react";

interface VerifyResponse {
  ok: boolean;
  verified: boolean;
  message: string;
  error?: string;
}

interface SendOtpResponse {
  ok: boolean;
  message: string;
}

export default function VerifyPhone() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const userId = parseInt(params.get("userId") || "0");
  const maskedPhone = decodeURIComponent(params.get("phone") || "");
  
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(30);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const verifyMutation = useMutation({
    mutationFn: async (otpCode: string) => {
      const response = await apiRequest("POST", "/api/auth/verify-otp", {
        userId,
        code: otpCode,
      });
      return response.json() as Promise<VerifyResponse>;
    },
    onSuccess: (data) => {
      if (data.verified) {
        setIsVerified(true);
        toast({
          title: "Phone Verified",
          description: "Your phone number has been verified successfully.",
        });
        setTimeout(() => {
          setLocation("/");
        }, 2000);
      } else if (data.error) {
        toast({
          title: "Verification Failed",
          description: data.error,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid code. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/send-otp", {
        userId,
      });
      return response.json() as Promise<SendOtpResponse>;
    },
    onSuccess: () => {
      setResendCooldown(30);
      setCode("");
      toast({
        title: "Code Sent",
        description: "A new verification code has been sent to your phone.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Send Code",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleCodeComplete = (value: string) => {
    setCode(value);
    if (value.length === 6) {
      verifyMutation.mutate(value);
    }
  };

  const handleResend = () => {
    if (resendCooldown === 0) {
      resendMutation.mutate();
    }
  };

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Invalid verification link.</p>
            <Button
              className="mt-4"
              onClick={() => setLocation("/register")}
              data-testid="button-go-register"
            >
              Go to Registration
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h2 className="text-xl font-semibold mb-2">Phone Verified</h2>
            <p className="text-muted-foreground">
              Redirecting you to the dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Phone className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Verify Your Phone</CardTitle>
          <CardDescription>
            We sent a 6-digit code to {maskedPhone || "your phone"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={handleCodeComplete}
              disabled={verifyMutation.isPending}
              data-testid="input-otp"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {verifyMutation.isPending && (
            <div className="flex justify-center items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Verifying...</span>
            </div>
          )}

          <div className="text-center">
            <Button
              variant="ghost"
              onClick={handleResend}
              disabled={resendCooldown > 0 || resendMutation.isPending}
              data-testid="button-resend"
            >
              {resendMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : resendCooldown > 0 ? (
                `Resend code in ${resendCooldown}s`
              ) : (
                "Resend code"
              )}
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>The code expires in 10 minutes.</p>
            <p>You have 5 attempts to enter the correct code.</p>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setLocation("/register")}
            data-testid="button-back"
          >
            Back to Registration
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
