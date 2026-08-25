import { ScrollView, Text, View } from 'react-native';
import { Container, ScreenHeader } from '../components/ui';
import { SUPPORT_EMAIL } from '../lib/support';

const UPDATED = '25 August 2026';

/**
 * Public account-deletion instructions. Required by Google Play (a web URL,
 * openable without signing in, that explains how to request deletion and what
 * data is removed or kept). Registered as a public route in _layout.
 */
export default function DeleteAccountScreen() {
  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="trash-outline" title="Delete your account" showBack hideSociety />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          <Text className="mb-4 text-[12px] text-faint">Last updated: {UPDATED}</Text>
          {SECTIONS.map((s) => (
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

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: 'About this page',
    p: [
      'This page explains how to delete your Aangan account and what happens to your data. Aangan is a private community app for residential societies.',
    ],
  },
  {
    h: 'Delete your account from the app',
    p: [
      '1. Open the Aangan app and sign in.',
      '2. Go to the “You” tab, then open “My Profile”.',
      '3. Scroll to the bottom and tap “Delete account”.',
      '4. Confirm when prompted. Your account is deleted immediately and you are signed out. This action cannot be undone.',
    ],
  },
  {
    h: 'If you cannot open the app',
    p: [
      'If you are unable to sign in, email us at ' + SUPPORT_EMAIL + ' from the phone number or name registered on your account, with the subject “Delete my account”. We will verify and process your request, and confirm once it is done.',
    ],
  },
  {
    h: 'What data is deleted',
    p: [
      'Deleting your account permanently removes: your profile (name, phone number, flat/block, and any optional details such as profession, vehicle number, blood group, profile photo and UPI ID); the content you created (posts, comments, polls, marketplace and property listings, home-food dishes and tiffins, orders, event contributions and expenses, direct and listing messages, and documents you uploaded); your in-app payment records; and your society membership and sign-in.',
    ],
  },
  {
    h: 'What may be kept, and for how long',
    p: [
      'After deletion, some information may remain briefly in encrypted backups before it is overwritten, normally within 30 days.',
      'We may retain a minimal amount of information for longer only where required to comply with law, prevent fraud or abuse, or resolve a dispute. We do not use retained data for any other purpose.',
    ],
  },
  {
    h: 'Contact',
    p: [
      'For any question about account or data deletion, email ' + SUPPORT_EMAIL + '.',
    ],
  },
];
