'use client';

import posthog from 'posthog-js';

/**
 * Product analytics (PostHog, EU region). Off unless NEXT_PUBLIC_POSTHOG_KEY is
 * set: without the key nothing is loaded and every call here does nothing.
 *
 * What is collected: pages visited, clicks, and the few moments that tell the
 * story of a learner (below) — tied to the member's internal id, never their
 * name, email or phone. Session recording is off. The policies page says so.
 */
export const ANALYTICS_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || '';

let started = false;

export function startAnalytics() {
  if (!ANALYTICS_KEY || started || typeof window === 'undefined') return;
  started = true;
  posthog.init(ANALYTICS_KEY, {
    api_host: '/ingest',
    ui_host: 'https://eu.posthog.com',
    capture_pageview: 'history_change',
    capture_pageleave: true,
    person_profiles: 'identified_only',
    disable_session_recording: true,
    respect_dnt: true,
  });
}

/** Who is browsing — their id only — and which hat they are wearing. */
export function identifyMember(id: string | null, role?: string | null) {
  if (!started) return;
  if (!id) {
    posthog.reset();
    return;
  }
  posthog.identify(id, role ? { role } : undefined);
}

/** The moments that make the funnel: signed up, finished a lesson, booked… */
export type AnalyticsEvent =
  | 'onboarding_completed'
  | 'quiz_passed'
  | 'quiz_failed'
  | 'assignment_submitted'
  | 'precheck_shown'
  | 'booking_requested'
  | 'certificate_linkedin'
  | 'linkedin_post';

export function track(event: AnalyticsEvent, properties?: Record<string, string | number | boolean | null>) {
  if (!started) return;
  posthog.capture(event, properties);
}
