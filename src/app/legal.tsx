import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Container, ScreenHeader } from '../components/ui';
import { useThemeColors } from '../theme';

type Tab = 'terms' | 'privacy';

const UPDATED = '9 June 2026';

export default function LegalScreen() {
  const c = useThemeColors();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'privacy' ? 'privacy' : 'terms');

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="document-text-outline"
        title="Terms & Privacy"
        showBack
        hideSociety
        subBar={
          <View className="flex-row gap-2">
            {(['terms', 'privacy'] as Tab[]).map((t) => (
              <Text
                key={t}
                onPress={() => setTab(t)}
                className={`rounded-full px-3.5 py-1.5 text-[12px] font-sans-sb ${tab === t ? 'bg-accent text-on-accent' : 'bg-inset text-muted'}`}
              >
                {t === 'terms' ? 'Terms of Use' : 'Privacy Policy'}
              </Text>
            ))}
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          <Text className="mb-4 text-[12px] text-faint">Last updated: {UPDATED}</Text>
          {(tab === 'terms' ? TERMS : PRIVACY).map((s) => (
            <View key={s.h} className="mb-5">
              <Text className="mb-1.5 font-display-x text-[17px] text-ink">{s.h}</Text>
              {s.p.map((para, i) => (
                <Text key={i} className="mb-2 text-[14px] leading-[22px] text-muted">{para}</Text>
              ))}
            </View>
          ))}
          <View className="mt-2 rounded-2xl border border-line bg-inset p-4">
            <Text className="text-[12px] leading-[18px] text-muted">
              This is a plain-language starting template, not legal advice. Have it reviewed by a qualified
              professional and adapt it to your society and jurisdiction before a public launch.
            </Text>
          </View>
        </Container>
      </ScrollView>
    </View>
  );
}

const TERMS: { h: string; p: string[] }[] = [
  {
    h: 'About these terms',
    p: [
      'Aangan is a private app for a residential society. By creating an account or using Aangan, you agree to these Terms of Use. If you do not agree, please do not use the app.',
    ],
  },
  {
    h: 'Who can use Aangan',
    p: [
      'You must be at least 18 years old and an owner, tenant, or authorised resident/representative of the society you join. Each account is personal — keep your phone number and PIN secure and do not share them.',
    ],
  },
  {
    h: 'Aangan is a platform, not a party to your dealings',
    p: [
      'Aangan helps neighbours discover and coordinate with each other — home food, tiffins, services, listings, payments and more. We are NOT a party to, and do not guarantee, any transaction, deal, service, product, advice or interaction between residents.',
      'Any agreement (price, quality, delivery, timing, refunds, suitability) is solely between the residents involved. You deal with neighbours at your own discretion and risk.',
    ],
  },
  {
    h: 'Payments',
    p: [
      'Payments happen directly between residents (for example over UPI). Aangan does not process, hold, escrow or refund money, and is not a payment system or financial intermediary.',
      'The in-app payment record is only a convenience to help both sides keep track. Always verify a payment in your own UPI/bank app. Aangan is not responsible for failed, wrong, duplicate, or disputed payments.',
    ],
  },
  {
    h: 'Home food & home services',
    p: [
      'Home food and tiffins are prepared by fellow residents in home kitchens — not commercial, licensed, or inspected facilities. Hygiene, ingredients, allergens and freshness are the cook\'s responsibility, not Aangan\'s. If you have allergies or health conditions, check directly with the cook and consume at your own risk.',
      'Services and recommendations listed by residents are not vetted or endorsed by Aangan.',
    ],
  },
  {
    h: 'Emergency contacts',
    p: [
      'Emergency contacts in the app are a convenience only and may be incomplete or out of date. They are NOT a substitute for official emergency services — in a real emergency call the official numbers (e.g. 112 in India) or your security desk directly.',
    ],
  },
  {
    h: 'Your content & acceptable use',
    p: [
      'You are responsible for what you post, sell, offer or share. Do not post anything unlawful, misleading, hateful, harassing, infringing, or that sells prohibited items, and do not spam or misuse others\' contact details.',
      'You grant Aangan a limited licence to store and display your content within your society so the app can function. Society admins may moderate, hide, remove content, or block members who break these rules.',
    ],
  },
  {
    h: 'Availability & changes',
    p: [
      'Aangan is provided “as is” and “as available”. We may change, suspend or discontinue features at any time, and the app may have downtime or errors.',
    ],
  },
  {
    h: 'Limitation of liability',
    p: [
      'To the maximum extent permitted by law, Aangan and its creators are not liable for any loss, damage, illness, injury, dispute, or harm arising from your use of the app or from any dealings, food, services, payments or interactions between residents.',
    ],
  },
  {
    h: 'Ending your account',
    p: [
      'You can delete your account at any time from Profile → Delete account. We may suspend or remove accounts that violate these terms.',
    ],
  },
  {
    h: 'Changes & contact',
    p: [
      'We may update these terms; continued use means you accept the changes. For questions, reach your society admin through the app.',
    ],
  },
];

const PRIVACY: { h: string; p: string[] }[] = [
  {
    h: 'What we collect',
    p: [
      'Account & profile: your phone number (used as your login), name, flat, and optional details you add — profession, vehicle number, UPI ID, photo.',
      'Activity you create: posts, comments, polls, listings, dishes, tiffins, orders, messages, documents you upload, payment records you create, and your society membership.',
    ],
  },
  {
    h: 'How we use it',
    p: [
      'Only to run Aangan for your society — show you the feed, directory, food board, listings, messages and payments, and let neighbours coordinate with each other. We do not sell your data, and we do not show ads.',
    ],
  },
  {
    h: 'Who can see your information',
    p: [
      'Aangan is society-scoped: your information is visible to members of your own society, never to other societies or the public internet.',
      'You control parts of this — for example you can hide your phone number from the directory, opt out of features, and choose whether documents are public or privately shared. Society admins can see member details to moderate the community.',
    ],
  },
  {
    h: 'Where your data lives',
    p: [
      'Data is stored with our cloud provider (Supabase / Postgres + object storage) and protected by row-level security so each society only sees its own data. We use phone-as-email aliases and a 6-digit PIN for sign-in (no SMS/OTP).',
      'No system is perfectly secure; please keep your PIN private.',
    ],
  },
  {
    h: 'Payments & contact details',
    p: [
      'Your UPI ID and phone/WhatsApp are shared with neighbours to let them pay or contact you. Payments occur in your own UPI app — Aangan does not receive or store your bank/UPI credentials, only the UPI ID you choose to display.',
    ],
  },
  {
    h: 'Your rights',
    p: [
      'You can edit your profile, change your visibility settings, and delete your account at any time (Profile → Delete account), which removes your account and associated content.',
    ],
  },
  {
    h: 'Children',
    p: ['Aangan is intended for adults (18+). It is not directed at children.'],
  },
  {
    h: 'Changes & contact',
    p: [
      'We may update this policy; we\'ll revise the date above. For privacy questions, contact your society admin through the app.',
    ],
  },
];
