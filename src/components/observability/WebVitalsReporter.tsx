'use client';
import { useReportWebVitals } from 'next/web-vitals';
import * as Sentry from '@sentry/nextjs';

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    const unit = metric.name === 'CLS' ? '' : 'millisecond';
    Sentry.setMeasurement(metric.name, metric.value, unit as Parameters<typeof Sentry.setMeasurement>[2]);
  });
  return null;
}
