import type { ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { Link } from '../router';

// Keep these accurate when the app changes. Last reviewed for: on-device storage, optional
// Firebase accounts, optional AI coach with the user's own Gemini/Claude key, Open Food Facts search.
export const LEGAL_UPDATED = '31 October 2026';
const CONTACT_URL = 'https://github.com/NightFury0101/FuelFlow/issues';
/** Support email shown on the Help & support page. App Store reviewers expect a way to reach you;
 *  set this to an address you check (e.g. 'support@yourdomain.com'). null = GitHub page only. */
export const SUPPORT_EMAIL: string | null = null;

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
      <p className="legal-lead">FuelFlow keeps your data on your phone by default. Nothing is sent to us unless you create an account or use the Premium coach, and we never sell your data or show ads.</p>

      <Section title="If you don’t create an account">
        <p>Everything you enter is stored only on your device (in the app, or in your browser on the website). We don’t receive it. If you delete the app, clear your browser data or lose your phone, it’s gone — so download a backup from Profile now and then.</p>
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

      <Section title="FuelFlow Premium (iPhone app)">
        <ul>
          <li>Subscriptions are bought and paid through Apple. We never see your card or payment details.</li>
          <li>
            <strong>RevenueCat</strong> checks your purchase with Apple for us. It receives a random ID for your app install, what you bought and when — not your name, email or diary.
          </li>
          <li>When you ask the built-in Premium coach a question, your question, recent chat messages and (only if you switch it on) the food-log summary go to our coach server, which passes them to the AI company (Anthropic or Google) and sends back the answer. Our server doesn’t keep your messages; it only counts questions per day to keep the service fair.</li>
        </ul>
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
        <p>FuelFlow Premium is an optional subscription sold in the iPhone app through Apple. It adds the built-in AI nutrition coach; everything else in FuelFlow stays free.</p>
        <ul>
          <li>The price and billing period are shown before you confirm. Payment is charged to your Apple ID.</li>
          <li>It renews automatically unless you cancel at least 24 hours before the end of the current period. Manage or cancel any time in your Apple ID settings.</li>
          <li>If a free trial is offered, any unused part of it ends when you buy a subscription.</li>
          <li>Refunds are handled by Apple under its rules — request one at reportaproblem.apple.com.</li>
          <li>The Premium coach has a fair daily question limit. Its answers are general suggestions, not medical advice.</li>
          <li>Apple’s standard licence agreement for apps (the Apple EULA) also applies to the iPhone app.</li>
        </ul>
      </Section>

      <Section title="Changes and law">
        <p>We may update these terms. We’ll change the date above and tell you in the app about important changes. These terms are governed by the laws of the Republic of Maldives.</p>
      </Section>
      <Contact />
    </div>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="faq">
      <summary>{q}</summary>
      <div className="faq-body">{children}</div>
    </details>
  );
}

/** Help & support — public page, also used as the App Store “Support URL” (…/#/support). */
export function Support() {
  return (
    <div className="page legal">
      <Back />
      <header>
        <h1>Help &amp; support</h1>
        <p className="muted">Answers to common questions, and how to reach us.</p>
      </header>

      <Section title="Contact us">
        {SUPPORT_EMAIL ? (
          <p>
            Email{' '}
            <a className="accent" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>{' '}
            — we usually reply within two working days.
          </p>
        ) : null}
        <p>
          Report a problem or suggest a feature on{' '}
          <a className="accent" href={CONTACT_URL} target="_blank" rel="noreferrer">
            our help page
          </a>
          .
        </p>
      </Section>

      <Section title="Common questions">
        <Faq q="Is FuelFlow free?">
          <p>Yes. Tracking, recipes, meal plans, progress and reminders are free, with no ads. The AI coach is free with your own Gemini key (Gemini’s free tier costs nothing).</p>
          <p>In the iPhone app you can also choose FuelFlow Premium, a subscription that builds the coach in so you don’t need a key. It’s optional and you can cancel any time in your Apple ID settings.</p>
        </Faq>
        <Faq q="Where is my data stored?">
          <p>On your phone. If you create an account, a copy is also backed up to your private account so it syncs across your devices. Nobody else can read it.</p>
        </Faq>
        <Faq q="How do I back up or move my data?">
          <p>Go to Profile → Your data → Download full backup. To bring it back, use Restore from backup on the new device. Creating an account does this automatically.</p>
        </Faq>
        <Faq q="How are my calorie and protein targets worked out?">
          <p>From your age, height, weight, activity and goal using the Mifflin–St Jeor formula, with a safe pace of change. You can change them in Profile → Daily targets. They’re estimates, not medical advice.</p>
        </Faq>
        <Faq q="How do I restore or cancel Premium?">
          <p>On a new phone, go to Profile → FuelFlow Premium → Restore purchases (use the same Apple ID). To cancel, open Settings → your name → Subscriptions on your iPhone, or tap Manage subscription in FuelFlow. Deleting the app doesn’t cancel it.</p>
        </Faq>
        <Faq q="How do I set up the AI coach?">
          <p>Go to Profile → AI nutrition coach, choose Gemini (free) or Claude, and paste your key. The key stays on your device. Your diary is only shared with the coach if you turn that on.</p>
        </Faq>
        <Faq q="Does it work offline?">
          <p>Yes. You can log food, water and weight without a connection. Food search, the AI coach and account sync need the internet and catch up when you’re back online.</p>
        </Faq>
        <Faq q="How do I delete my account?">
          <p>Go to Profile → Account &amp; sync → Delete my account, and confirm with your password. This permanently deletes the account and everything in it. To erase data without an account, use Profile → Your data → Delete all my data.</p>
        </Faq>
        <Faq q="Is FuelFlow medical advice?">
          <p>No. FuelFlow gives estimates for general wellbeing. If you’re under 18, pregnant or breastfeeding, or have a medical condition, please speak to a doctor or registered dietitian before changing what you eat.</p>
        </Faq>
      </Section>

      <p className="muted small">
        See also our{' '}
        <Link to="/privacy" className="accent">
          privacy policy
        </Link>{' '}
        and{' '}
        <Link to="/terms" className="accent">
          terms of use
        </Link>
        .
      </p>
    </div>
  );
}
