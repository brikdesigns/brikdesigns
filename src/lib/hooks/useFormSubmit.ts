'use client';

import { useState } from 'react';

export type FormState = 'idle' | 'submitting' | 'success' | 'error';

export interface UseFormSubmitOptions {
  /** Endpoint URL to POST/PATCH/PUT against. */
  endpoint: string;
  /** HTTP method. Defaults to POST. */
  method?: 'POST' | 'PATCH' | 'PUT';
  /**
   * Optional callback fired after a successful response. When provided, the
   * hook stays in `idle` instead of transitioning to `success` — use this when
   * the consumer is navigating away on save (e.g. router.push) and shouldn't
   * flash a success card before the route change.
   */
  onSuccess?: () => void;
}

export interface UseFormSubmitResult {
  state: FormState;
  error: string;
  isSubmitting: boolean;
  isSuccess: boolean;
  isError: boolean;
  submit: (body: unknown) => Promise<void>;
  /** Surface a client-side validation error without making a network request. */
  setError: (message: string) => void;
}

/**
 * Drives the submit-state machine for fetch-backed forms.
 *
 * Captures the recurring shape across ContactForm / LeadCaptureForm / EntityForm:
 * idle → submitting → (success | error). On error, parses `{ error: string }`
 * from the response body, falling back to a status-code message. On success,
 * either transitions to `success` (default) or invokes `onSuccess` for forms
 * that navigate away.
 */
export function useFormSubmit({
  endpoint,
  method = 'POST',
  onSuccess,
}: UseFormSubmitOptions): UseFormSubmitResult {
  const [state, setState] = useState<FormState>('idle');
  const [error, setError] = useState('');

  async function submit(body: unknown) {
    setState('submitting');
    setError('');

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data?.error || `Submit failed (${res.status})`);
      }

      if (onSuccess) {
        onSuccess();
        setState('idle');
      } else {
        setState('success');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setState('error');
    }
  }

  function setClientError(message: string) {
    setError(message);
    setState('error');
  }

  return {
    state,
    error,
    isSubmitting: state === 'submitting',
    isSuccess: state === 'success',
    isError: state === 'error',
    submit,
    setError: setClientError,
  };
}
