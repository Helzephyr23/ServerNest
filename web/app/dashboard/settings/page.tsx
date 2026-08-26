"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function PanelSettingsPage() {
  const { success, error: toastError } = useToast();
  const [totpStatus, setTotpStatus] = useState<{ enabled: boolean; setup: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchStatus = () => {
    api.get("/api/auth/2fa/status")
      .then((res) => setTotpStatus(res))
      .catch(() => setTotpStatus({ enabled: false, setup: false }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleSetup = async () => {
    setSubmitting(true);
    try {
      const res = await api.post("/api/auth/2fa/setup");
      setQrCode(res.qr);
    } catch (err: any) {
      toastError("Failed to setup 2FA", err.message);
    }
    setSubmitting(false);
  };

  const handleVerifySetup = async () => {
    setSubmitting(true);
    try {
      await api.post("/api/auth/2fa/verify", { code: setupCode });
      success("2FA enabled successfully");
      setQrCode("");
      setSetupCode("");
      fetchStatus();
    } catch (err: any) {
      toastError("Invalid code", err.message);
    }
    setSubmitting(false);
  };

  const handleDisable = async () => {
    setSubmitting(true);
    try {
      await api.post("/api/auth/2fa/disable", { password: disablePassword, code: disableCode });
      success("2FA disabled");
      setDisablePassword("");
      setDisableCode("");
      fetchStatus();
    } catch (err: any) {
      toastError("Failed to disable 2FA", err.message);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full max-w-md" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-full max-w-sm" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-9 w-full max-w-sm" />
            </div>
            <Skeleton className="h-9 w-48" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and panel preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
        </CardHeader>
        <CardContent>
          {totpStatus?.enabled ? (
            <div className="space-y-4">
              <div className="rounded-md bg-green-500/10 px-4 py-3 text-sm text-green-500">
                2FA is currently enabled
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Password</label>
                <Input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Authentication Code</label>
                <Input
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                />
              </div>
              <Button variant="destructive" onClick={handleDisable} disabled={submitting || !disablePassword || !disableCode}>
                {submitting ? "Disabling..." : "Disable 2FA"}
              </Button>
            </div>
          ) : qrCode ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </p>
              <div className="flex justify-center">
                <img src={qrCode} alt="2FA QR Code" className="h-48 w-48" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Enter the 6-digit code from your app</label>
                <Input
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-lg tracking-widest"
                />
              </div>
              <Button onClick={handleVerifySetup} disabled={submitting || setupCode.length !== 6}>
                {submitting ? "Verifying..." : "Enable 2FA"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account. Once enabled, you'll need both your password and a
                one-time code from your authenticator app to sign in.
              </p>
              <Button onClick={handleSetup} disabled={submitting}>
                {submitting ? "Setting up..." : "Enable Two-Factor Authentication"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
