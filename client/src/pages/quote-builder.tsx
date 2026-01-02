import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, Send, Calculator, RotateCcw, Phone, MapPin, Wrench, Clock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface QuoteDraftInput {
  customer_name?: string;
  customer_phone?: string;
  service_address?: string;
  services_requested?: string[];
  frequency?: "one_time" | "weekly" | "biweekly" | "monthly" | "unknown";
  complexity?: "light" | "medium" | "heavy" | "unknown";
  lot_area_sqft?: number;
  property_band?: string;
}

interface QuoteCalculation {
  rangeLow: number;
  rangeHigh: number;
  confidence: number;
  assumptions: string[];
  reviewRequired: boolean;
  reviewReasons: string[];
}

export default function QuoteBuilder() {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [formData, setFormData] = useState<QuoteDraftInput>({
    services_requested: [],
    frequency: "one_time",
    complexity: "medium",
  });
  const [quoteResult, setQuoteResult] = useState<QuoteCalculation | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [followUpQuestion, setFollowUpQuestion] = useState<string>("");
  const recognitionRef = useRef<any>(null);

  // Initialize Web Speech API
  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPart;
          } else {
            interimTranscript += transcriptPart;
          }
        }
        
        if (finalTranscript) {
          setTranscript(prev => (prev + " " + finalTranscript).trim());
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Parse voice transcript
  const parseVoiceMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/uqb/parse-voice", { transcript: text });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.extracted) {
        setFormData(prev => ({
          ...prev,
          ...data.extracted,
          services_requested: data.extracted.services_requested || prev.services_requested,
        }));
      }
      if (data.missing_fields) {
        setMissingFields(data.missing_fields);
      }
      if (data.questions && data.questions.length > 0) {
        setFollowUpQuestion(data.questions[0]);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error parsing voice",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Detect voice commands
  const detectCommandMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/uqb/detect-command", { transcript: text });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.commands?.send_quote && quoteResult) {
        handleSendQuote();
      }
      if (data.commands?.clear_form) {
        handleReset();
      }
    },
  });

  // Calculate quote
  const calculateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/uqb/calculate", {
        serviceType: formData.services_requested?.[0] || "mowing",
        lotAreaSqft: formData.lot_area_sqft || 5000,
        complexity: formData.complexity,
        frequency: formData.frequency,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setQuoteResult(data);
    },
    onError: (error: any) => {
      toast({
        title: "Error calculating quote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send quote
  const sendQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!quoteResult || !formData.customer_phone) {
        throw new Error("Quote and phone number required");
      }
      const res = await apiRequest("POST", "/api/uqb/send", {
        customerPhone: formData.customer_phone,
        rangeLow: quoteResult.rangeLow,
        rangeHigh: quoteResult.rangeHigh,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Quote sent",
        description: data.sent ? "SMS delivered successfully" : "Quote recorded (SMS not configured)",
      });
      handleReset();
    },
    onError: (error: any) => {
      toast({
        title: "Error sending quote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      // Parse the transcript when stopping
      if (transcript.trim()) {
        parseVoiceMutation.mutate(transcript);
        detectCommandMutation.mutate(transcript);
      }
    } else {
      setTranscript("");
      recognitionRef.current?.start();
      setIsRecording(true);
    }
  };

  const handleReset = () => {
    setFormData({
      services_requested: [],
      frequency: "one_time",
      complexity: "medium",
    });
    setTranscript("");
    setQuoteResult(null);
    setMissingFields([]);
    setFollowUpQuestion("");
  };

  const handleSendQuote = () => {
    if (!formData.customer_phone) {
      toast({
        title: "Phone number required",
        description: "Please enter the customer's phone number to send the quote",
        variant: "destructive",
      });
      return;
    }
    sendQuoteMutation.mutate();
  };

  const updateField = (field: keyof QuoteDraftInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear the field from missing if it was filled
    if (value) {
      setMissingFields(prev => prev.filter(f => f !== field));
    }
  };

  const toggleService = (service: string) => {
    setFormData(prev => {
      const current = prev.services_requested || [];
      if (current.includes(service)) {
        return { ...prev, services_requested: current.filter(s => s !== service) };
      }
      return { ...prev, services_requested: [...current, service] };
    });
  };

  const services = [
    { id: "mowing", label: "Lawn Mowing" },
    { id: "cleanup", label: "Yard Cleanup" },
    { id: "mulch", label: "Mulching" },
    { id: "trimming", label: "Trimming" },
    { id: "leaf_removal", label: "Leaf Removal" },
    { id: "edging", label: "Edging" },
  ];

  const isSpeechSupported = typeof window !== "undefined" && "webkitSpeechRecognition" in window;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Quote Builder</h1>
          <p className="text-muted-foreground">Create and send quotes using voice or form input</p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleReset} data-testid="button-reset">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Voice Input Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Voice Input
            </CardTitle>
            <CardDescription>
              {isSpeechSupported 
                ? "Click the microphone and describe the job"
                : "Speech recognition not supported in this browser"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <Button
                size="lg"
                variant={isRecording ? "destructive" : "default"}
                className="w-24 h-24 rounded-full"
                onClick={toggleRecording}
                disabled={!isSpeechSupported}
                data-testid="button-record"
              >
                {isRecording ? (
                  <MicOff className="h-10 w-10" />
                ) : (
                  <Mic className="h-10 w-10" />
                )}
              </Button>
            </div>
            
            {isRecording && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Listening...
              </div>
            )}

            {transcript && (
              <div className="space-y-2">
                <Label>Transcript</Label>
                <Textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={4}
                  className="resize-none"
                  data-testid="input-transcript"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => parseVoiceMutation.mutate(transcript)}
                  disabled={parseVoiceMutation.isPending}
                  data-testid="button-parse"
                >
                  {parseVoiceMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Parse Transcript
                </Button>
              </div>
            )}

            {followUpQuestion && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-1">Follow-up Question</p>
                <p className="text-sm text-muted-foreground">{followUpQuestion}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Form Input Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Quote Details
            </CardTitle>
            <CardDescription>Enter or confirm the job details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_name">Customer Name</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name || ""}
                  onChange={(e) => updateField("customer_name", e.target.value)}
                  placeholder="John Smith"
                  data-testid="input-customer-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_phone" className="flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  Phone Number
                  {missingFields.includes("customer_phone") && (
                    <Badge variant="outline" className="text-xs">Required</Badge>
                  )}
                </Label>
                <Input
                  id="customer_phone"
                  type="tel"
                  value={formData.customer_phone || ""}
                  onChange={(e) => updateField("customer_phone", e.target.value)}
                  placeholder="(555) 123-4567"
                  data-testid="input-customer-phone"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="service_address" className="flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                Service Address
                {missingFields.includes("service_address") && (
                  <Badge variant="outline" className="text-xs">Required</Badge>
                )}
              </Label>
              <Input
                id="service_address"
                value={formData.service_address || ""}
                onChange={(e) => updateField("service_address", e.target.value)}
                placeholder="123 Main St, City, State 12345"
                data-testid="input-address"
              />
            </div>

            {/* Services */}
            <div className="space-y-2">
              <Label>Services Requested</Label>
              <div className="flex flex-wrap gap-2">
                {services.map((service) => (
                  <Badge
                    key={service.id}
                    variant={formData.services_requested?.includes(service.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleService(service.id)}
                    data-testid={`badge-service-${service.id}`}
                  >
                    {service.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Frequency & Complexity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="frequency" className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Frequency
                </Label>
                <Select
                  value={formData.frequency || "one_time"}
                  onValueChange={(value) => updateField("frequency", value)}
                >
                  <SelectTrigger id="frequency" data-testid="select-frequency">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-time</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="complexity">Job Complexity</Label>
                <Select
                  value={formData.complexity || "medium"}
                  onValueChange={(value) => updateField("complexity", value)}
                >
                  <SelectTrigger id="complexity" data-testid="select-complexity">
                    <SelectValue placeholder="Select complexity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="heavy">Heavy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Lot Size */}
            <div className="space-y-2">
              <Label htmlFor="lot_area_sqft">Lot Size (sq ft)</Label>
              <Input
                id="lot_area_sqft"
                type="number"
                value={formData.lot_area_sqft || ""}
                onChange={(e) => updateField("lot_area_sqft", parseInt(e.target.value) || undefined)}
                placeholder="5000"
                data-testid="input-lot-size"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to auto-detect from address
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quote Result Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Quote Calculation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {quoteResult ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Range</p>
                  <p className="text-3xl font-bold" data-testid="text-quote-range">
                    ${(quoteResult.rangeLow / 100).toFixed(0)} - ${(quoteResult.rangeHigh / 100).toFixed(0)}
                  </p>
                </div>
                <div className="text-center border-l pl-4">
                  <p className="text-sm text-muted-foreground">Confidence</p>
                  <Badge variant={quoteResult.confidence >= 0.8 ? "default" : "outline"}>
                    {(quoteResult.confidence * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>

              {quoteResult.assumptions && quoteResult.assumptions.length > 0 && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium mb-2">Assumptions</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {quoteResult.assumptions.map((a, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {quoteResult.reviewRequired && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <p className="text-sm font-medium text-destructive">Review Required</p>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {quoteResult.reviewReasons?.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  onClick={handleSendQuote}
                  disabled={sendQuoteMutation.isPending || !formData.customer_phone}
                  data-testid="button-send-quote"
                >
                  {sendQuoteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Quote
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Fill in the details above, then calculate the quote
              </p>
              <Button
                onClick={() => calculateMutation.mutate()}
                disabled={calculateMutation.isPending || (formData.services_requested?.length || 0) === 0}
                data-testid="button-calculate"
              >
                {calculateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Calculator className="h-4 w-4 mr-2" />
                )}
                Calculate Quote
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
