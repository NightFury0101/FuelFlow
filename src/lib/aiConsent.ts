// Permission to send data to a third-party AI (App Store guideline 5.1.2(i)).
//
// Nothing goes to an AI company until the person has seen a screen that names that company,
// says what is sent and why, and tapped Allow. Permission is tied to the destination: switching
// from Gemini to Claude (or to Premium) asks again. It can be withdrawn in Profile → AI coach,
// which stops all coach requests until it's given again.

import type { AiConfig } from './ai';
import type { Profile } from './types';

export type CoachProvider = 'claude' | 'gemini';

export const COMPANY: Record<CoachProvider, string> = {
  gemini: 'Google (Gemini)',
  claude: 'Anthropic (Claude)',
};

/** A stable id for where coach requests go. Consent is stored against this id. */
export function consentId(ai: AiConfig, premiumProvider: CoachProvider = 'claude'): string {
  if (ai.kind === 'key') return ai.provider;
  if (ai.kind === 'premium') return `premium:${premiumProvider}`;
  let host = ai.url;
  try {
    host = new URL(ai.url).host;
  } catch {
    /* keep as typed */
  }
  return `server:${host}`;
}

export interface Disclosure {
  /** Who receives the data, in plain words. */
  recipient: string;
  /** Extra sentence about that recipient's terms, or null. */
  note: string | null;
}

export function disclosure(ai: AiConfig, premiumProvider: CoachProvider = 'claude'): Disclosure {
  if (ai.kind === 'key') {
    return {
      recipient: COMPANY[ai.provider],
      note:
        ai.provider === 'gemini'
          ? 'It’s sent with your own key, under Google’s terms. On Gemini’s free tier Google may use conversations to improve its products.'
          : 'It’s sent with your own key, under Anthropic’s terms.',
    };
  }
  if (ai.kind === 'premium') {
    return {
      recipient: COMPANY[premiumProvider],
      note: 'It passes through FuelFlow’s coach server, which doesn’t keep it. RevenueCat’s random ID for this app is sent to confirm your subscription.',
    };
  }
  let host = ai.url;
  try {
    host = new URL(ai.url).host;
  } catch {
    /* keep as typed */
  }
  return { recipient: `your coach server (${host})`, note: 'That server may pass it on to the AI company it’s set up with.' };
}

/** True when the person has allowed sending to exactly this destination. */
export function hasConsent(profile: Pick<Profile, 'aiConsent'> | null | undefined, id: string): boolean {
  return !!profile?.aiConsent && profile.aiConsent === id;
}
