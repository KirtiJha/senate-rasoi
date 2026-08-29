import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Container, ScreenHeader } from '../components/ui';
import { SUPPORT_EMAIL } from '../lib/support';
import { useThemeColors } from '../theme';

type Tab = 'terms' | 'privacy';

const UPDATED = '25 August 2026';

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
      'You can report any content from the “⋯” menu on it, and block any member from that same menu. Blocking is mutual and can be undone at Profile → Blocked members.',
    ],
  },
  {
    h: 'Child safety',
    p: [
      'Aangan has zero tolerance for child sexual abuse and exploitation (CSAE). Aangan is for adults aged 18 and over, and any content that sexualises, endangers or exploits a child is prohibited without exception.',
      'Accounts responsible for such content are permanently removed and reported to the appropriate authorities. To report a child-safety concern, use the “⋯” menu on the content and choose “Child safety (CSAE)”, or email ' + SUPPORT_EMAIL + ' with the subject “Child safety”.',
      'Our full published standards, including how we respond and the laws we comply with, are at /child-safety.',
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
      'We may update these terms; continued use means you accept the changes. For questions about the app itself, or to report abuse that your society admin cannot resolve, email us at ' + SUPPORT_EMAIL + '. We aim to respond within 3 working days.',
    ],
  },
];

const PRIVACY: { h: string; p: string[] }[] = [
  {
    h: 'Introduction',
    p: [
      'Aangan (“we”, “us”, “the app”) is a private community platform for residential societies. This Privacy Policy explains what information we collect when you use Aangan, how we use and protect it, and the choices and rights you have. It applies to the Aangan mobile app and website.',
      'By creating an account or using Aangan, you consent to the practices described in this policy. If you do not agree, please do not use the app.',
    ],
  },
  {
    h: 'Information we collect',
    p: [
      'Account and profile information: your phone number (used as your login), your name and flat or block within your society, and any optional details you choose to add — profession, vehicle number, blood group, and UPI ID.',
      'Content you create: posts, comments, polls, marketplace and property listings, home-food dishes and tiffins, orders, event contributions and expenses, direct and listing messages, documents you upload, and payment records you create.',
      'Membership information: which society you belong to and your role (member or admin).',
      'Technical information needed to run the app: a device notification token so we can deliver push notifications, and basic app-interaction data required for features to work. We do NOT collect your device location, your contacts, your call or SMS logs, or your web browsing history.',
    ],
  },
  {
    h: 'How we use your information',
    p: [
      'We use your information only to operate Aangan for your society: to sign you in, show you the community feed, resident directory, food board, marketplace, events, messages and payment records, and to let neighbours discover and coordinate with each other. Your notification token is used only to send you app notifications.',
      'We do not sell your personal data, we do not share it with advertisers, and Aangan shows no ads.',
    ],
  },
  {
    h: 'Who can see your information',
    p: [
      'Aangan is society-scoped. Your profile and the content you post are visible only to verified members of your own society — never to other societies, and never to the public internet. Database-level security enforces this separation so each society can only access its own data.',
      'You control much of what is shared: you can hide your phone number from the directory, opt out of features, and choose whether each document you upload is public to your society or shared only with specific members. Society administrators can view member details and moderate content in order to run and keep the community safe.',
    ],
  },
  {
    h: 'Service providers we use',
    p: [
      'We rely on a small number of trusted providers who process data on our behalf, under their own security and privacy commitments, and only to make Aangan work:',
      'Supabase — our cloud database, authentication and file-storage provider, which hosts your account and content with row-level security so each society is isolated.',
      'Expo and Google Firebase Cloud Messaging — used solely to deliver push notifications to your device.',
      'If you use Aangan\'s optional AI features (such as filling in a listing from a photo, or asking a question about your society), the relevant content — for example the photo you are already posting — is sent to Google\'s AI service to generate the result. We do not send your phone number, PIN, or private contact details for this purpose.',
      'These providers act as processors for us; we do not sell or rent your data to anyone.',
    ],
  },
  {
    h: 'How long we keep your data',
    p: [
      'We keep your information for as long as your account is active so the app can function. When you delete your account, your profile and associated content are removed from our live systems. Some information may persist briefly in encrypted backups before it is overwritten, and we may retain minimal records where required to comply with law or resolve disputes.',
    ],
  },
  {
    h: 'How we protect your data',
    p: [
      'Data is encrypted in transit (HTTPS/TLS) and stored with our cloud provider under row-level security so each society only sees its own data. Sign-in uses a phone-number alias and a 6-digit PIN that you set yourself (no SMS/OTP). No system is perfectly secure, so please keep your PIN private and do not share your account.',
    ],
  },
  {
    h: 'Payments and contact details',
    p: [
      'Aangan is not a payment system and never processes, holds, or transfers money. If you choose to display a UPI ID, or share your phone or WhatsApp number, they are shown to neighbours so they can pay or contact you directly. Any payment happens entirely within your own UPI or banking app — Aangan never receives or stores your bank or UPI credentials, only the UPI ID you choose to display. In-app payment entries are a personal record-keeping convenience only.',
    ],
  },
  {
    h: 'Your rights and choices',
    p: [
      'You can view and edit your profile at any time, change your directory and visibility settings, and control the audience of documents you share. You can delete your account and its associated content at any time from Profile → Delete account.',
      'To exercise any privacy right, or to ask how your data is handled, contact us at ' + SUPPORT_EMAIL + '.',
    ],
  },
  {
    h: 'Children',
    p: [
      'Aangan is intended for adults aged 18 and over and is not directed at children. We do not knowingly collect information from anyone under 18.',
    ],
  },
  {
    h: 'Changes to this policy',
    p: [
      'We may update this Privacy Policy from time to time. When we do, we will revise the “Last updated” date shown above, and significant changes may be highlighted in the app. Your continued use of Aangan after an update means you accept the revised policy.',
    ],
  },
  {
    h: 'Contact us',
    p: [
      'For any privacy question, grievance, or request to access or delete your data, email us at ' + SUPPORT_EMAIL + '. We aim to respond within a reasonable time, and in any case within the period required by applicable law.',
    ],
  },
];
