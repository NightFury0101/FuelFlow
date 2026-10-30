import type { ReactNode } from 'react';
import { Icon } from '../components/Icon';

// Keep these accurate when the app changes. Last reviewed for: on-device storage, optional
// Firebase accounts, optional AI coach with the user's own Gemini/Claude key, Open Food Facts search.
export const LEGAL_UPDATED = '30 October 2026';
const CONTACT_URL = 'https://github.com/NightFury0101/FuelFlow/issues';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Back() {
  return (
    <button className="back-link" onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.hash = '/'))}>
      <Icon name="left" size={16} /> Back
    </button>
  );
}

const Contact = () => (
  <p>
    Questions or requests about your data:{' '}
    <a className="accent" href={CONTACT_URL} target="_blank" rel="noreferrer">
      contact us here
    </a>
    .
  </p>
);

export function Privacy() {
  return (
    <div className="page legal">
      <Back />
      <header>
        <h1>Privacy policy</h1>
        <p className="muted small">Last updated {LEGAL_UPDATED}</p>
      </header>
      <p className="legal-lead">FuelFlow keeps your data on your phone by default. Nothing is sent to us unless you create an account, and we never sell your data or show ads.</p>

      <Section title="If you don’t create an account">
        <p>Everything you enter is stored only in your browser on your device. We don’t receive it. If you clear your browser data or lose your phone, it’s gone — so download a backup from Profile now and then.</p>
      </Section>

      <Section title="If you create an account">
        <p>Your account is provided through Google Firebase. We store:</p>
        <ul>
          <li>Your email address. Your password is handled by Firebase Authentication — we never see it.</li>
          <li>What you enter in FuelFlow: your profile (name, date of birth, sex, height, weight, goal, activity, dietary preferences), food diary, recipes, meal plans, water, weigh-ins and body measurements.</li>
        </ul>
        <p>This is kept on Google Cloud servers in your private account. Security rules mean only you, signed in, can read or change it. It’s used only to back up your data and keep it in sync across your devices.</p>
      </Section>

      <Section title="Health information">
        <p>Your weight, measurements and eating records can reveal things about your health. We treat all of it as private. We don’t share it with gyms, trainers, employers or anyone else. If you want a trainer to see it, you choose to export it and send it yourself.</p>
      </Section>

      <Section title="The AI nutrition coach (optional)">
        <p>The coach is off until you connect it with your own key. When you ask a question:</p>
        <ul>
          <li>Your question and recent chat messages are sent straight from your phone to the AI company you chose: Google (Gemini) or Anthropic (Claude).</li>
          <li>A short summary of your food log is sent only if you switch on “Let the coach see my food log”.</li>
          <li>That company’s own terms and privacy policy apply. Google may use conversations on Gemini’s free tier to improve its products.</li>
        </ul>
        <p>Your AI key and your chat history stay on your phone. They aren’t stored in your account.</p>
      </Section>

      <Section title="Other services FuelFlow uses">
        <ul>
          <li>
            <strong>Open Food Facts</strong> receives the words you type when searching for packaged products.
          </li>
          <li>
            <strong>Google Fonts</strong> serves the app’s fonts and receives your IP address when they load.
          </li>
          <li>
            <strong>GitHub Pages</strong> hosts the app and may log visits for security.
          </li>
        </ul>
        <p>FuelFlow has no advertising, analytics or tracking cookies.</p>
      </Section>

      <Section title="Your choices">
        <ul>
          <li>See, edit or delete anything you’ve logged, at any time.</li>
          <li>Download all your data from Profile → Your data (JSON backup or CSV).</li>
          <li>Signing out removes your data from that phone; it stays in your account.</li>
          <li>Profile → Delete my account permanently deletes your account and everything in it. We don’t keep a copy.</li>
        </ul>
      </Section>

      <Section title="Children">
        <p>FuelFlow isn’t meant for children under 13. Anyone under 18 should use it with a parent or guardian. For under-18s, FuelFlow doesn’t set weight-loss targets and suggests talking to a doctor.</p>
      </Section>

      <Section title="Security">
        <p>All connections use encryption (HTTPS), and your account data is protected by access rules. No system is perfectly secure, so use a password you don’t use anywhere else.</p>
      </Section>

      <Section title="Changes">
        <p>If this policy changes, we’ll update the date above and tell you in the app before major changes take effect.</p>
      </Section>
      <Contact />
    </div>
  );
}

export function Terms() {
  return (
    <div className="page legal">
      <Back />
      <header>
        <h1>Terms of use</h1>
        <p className="muted small">Last updated {LEGAL_UPDATED}</p>
      </header>
      <p className="legal-lead">FuelFlow is a free tool to help you track what you eat. By using it you agree to these terms.</p>

      <Section title="Not medical advice">
        <p>FuelFlow’s calorie and nutrient targets, food values, charts and AI coach give general estimates for wellbeing. They are not medical, dietary or professional advice.</p>
        <p>Talk to a doctor or registered dietitian before changing your diet if you are pregnant or breastfeeding, under 18, have a medical condition, or have, or have had, an eating disorder. If you are struggling with food or your body, please reach out to a health professional or someone you trust.</p>
      </Section>

      <Section title="Food data and AI">
        <ul>
          <li>Food values come from typical reference values, the Open Food Facts community database, and what you enter. They can contain mistakes.</li>
          <li>The AI coach can be wrong. Treat its answers as suggestions and use your judgement.</li>
          <li>If you connect your own AI key, you are responsible for it and for any charges from the AI company.</li>
        </ul>
      </Section>

      <Section title="Your account and your data">
        <ul>
          <li>Keep your password private, and use one account per person.</li>
          <li>Your data belongs to you. You let us store and sync it only so that FuelFlow works for you. You can export it or delete it at any time.</li>
        </ul>
      </Section>

      <Section title="Fair use">
        <p>Don’t misuse FuelFlow. That means don’t try to access other people’s data, disrupt the service, or use automated tools to overload it. We may suspend accounts that do.</p>
      </Section>

      <Section title="Availability">
        <p>FuelFlow is provided free and “as is”. We work to keep it running and your data safe, but we can’t promise it will always be available or error-free. Keep a backup of anything important.</p>
        <p>To the extent the law allows, we aren’t liable for losses that come from using, or not being able to use, FuelFlow.</p>
      </Section>

      <Section title="Premium">
        <p>FuelFlow doesn’t sell anything at the moment. If paid features are introduced, their price and terms will be shown clearly before you pay. The features you use for free today will stay free.</p>
      </Section>

      <Section title="Changes and law">
        <p>We may update these terms. We’ll change the date above and tell you in the app about important changes. These terms are governed by the laws of the Republic of Maldives.</p>
      </Section>
      <Contact />
    </div>
  );
}
