'use client';

import { createOrganization } from '@/app/actions/organizations';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Building2 } from 'lucide-react';
import { useState } from 'react';

export default function OnboardingPage() {
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    const result = await createOrganization(formData);
    if ('error' in result) {
      setError(result.error);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Willkommen!</h1>
        <p className="text-sm text-muted-foreground">
          Erstellen Sie Ihre erste Organisation, um loszulegen.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Form */}
      <form className="space-y-3" action={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="name">Organisationsname</Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="name"
              name="name"
              type="text"
              required
              minLength={3}
              placeholder="z.B. Ihre Firma GmbH"
              className="pl-10"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Mindestens 3 Zeichen. Sie können später weitere Organisationen
            erstellen.
          </p>
        </div>

        {/* Submit button */}
        <Button type="submit" className="w-full mt-1">
          Organisation erstellen
        </Button>
      </form>
    </div>
  );
}
