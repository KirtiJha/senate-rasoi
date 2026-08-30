import { ScrollView, Text, View } from 'react-native';
import { Container, ScreenHeader } from '../components/ui';
import { SUPPORT_EMAIL } from '../lib/support';

const UPDATED = '29 August 2026';

/**
 * Published child-safety (CSAE) standards. Google Play requires apps in the
 * Social or Dating categories to link to externally published standards against
 * child sexual abuse and exploitation. The link must be publicly reachable
 * worldwide without signing in, must not be a PDF, and must not be editable by
 * the public — so this is a normal app route served by the web build, not a
 * shared document.
 *
 * Registered as a public route in _layout. Keep every claim on this page true:
 * it is a compliance document, and Google's reviewers check it against what the
 * app actually does.
 */
export default function ChildSafetyScreen() {
  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="shield-checkmark-outline" title="Child safety standards" showBack hideSociety />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          <Text className="mb-1 font-display-x text-[20px] text-ink">
            Aangan standards against child sexual abuse and exploitation
          </Text>
          <Text className="font-sans mb-4 text-[12px] text-faint">Last updated: {UPDATED}</Text>

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
    h: 'Our commitment',
    p: [
      'Aangan has zero tolerance for child sexual abuse and exploitation (CSAE). Content or behaviour that sexualises, endangers or exploits a child is absolutely prohibited on Aangan, without exception and regardless of intent.',
      'These standards are published, apply to every user of Aangan, and are enforced by removal of content, permanent loss of access, and referral to law enforcement.',
    ],
  },
  {
    h: 'Aangan is an adults-only app',
    p: [
      'Aangan is intended for adults aged 18 and over. It is not designed for, marketed to, or directed at children.',
      'Aangan is also not an open social network. It is a private app for a single verified residential society. Membership is granted only to residents of that society, verified by phone number against a resident roster and approved by a society administrator. There is no public sign-up, no public profile, no discovery of strangers, and no way for someone outside your society to view your content or contact you.',
      'This closed structure is our primary safeguard: an adult stranger cannot reach a child through Aangan, because they cannot enter the community at all.',
    ],
  },
  {
    h: 'What is prohibited',
    p: [
      'The following are prohibited on Aangan and will result in immediate removal and permanent loss of access:',
      '• Child sexual abuse material (CSAM) — any image, video, drawing or text depicting a minor in a sexual manner.',
      '• Sexualisation of a minor, including sexual commentary about a child, or sharing images of children in a sexualised context.',
      '• Grooming — building a relationship with a minor for sexual purposes, or attempting to arrange sexual contact with a minor.',
      '• Sextortion — threatening to share intimate imagery of a person in order to coerce them.',
      '• Trafficking of a minor, or facilitating or advertising it.',
      '• Soliciting, offering, linking to or advertising any of the above, on or off the app.',
      'Attempting any of the above is treated the same as doing it.',
    ],
  },
  {
    h: 'How to report a child-safety concern',
    p: [
      'Every piece of content in Aangan carries a report control. Open the “⋯” menu on any post, comment, listing, item or profile, choose Report, and select the reason “Child safety (CSAE)”. Reports go immediately to your society administrators, who are notified straight away.',
      'You can also block any member from that same “⋯” menu. Blocking is mutual — neither of you will see the other\'s content, and neither can message the other. Blocked members can be managed at Profile → Blocked members.',
      'To report a child-safety concern directly to us, including anonymously or if you cannot access the app, email ' + SUPPORT_EMAIL + ' with the subject “Child safety”. Reports sent to this address are prioritised above all other correspondence.',
      'If a child is in immediate danger, contact your local emergency services first. In India, call 112, or the national child helpline 1098.',
    ],
  },
  {
    h: 'How we respond',
    p: [
      'We treat every child-safety report as urgent and act on it ahead of any other queue.',
      'When a report is substantiated we: remove the content immediately; permanently terminate the account of the person responsible and bar them from the society; preserve the relevant records where lawful so that investigators can use them; and report the matter to the appropriate authorities.',
      'We report suspected child sexual abuse material to law enforcement in the relevant jurisdiction, and, where applicable, to the National Center for Missing & Exploited Children (NCMEC).',
      'We do not require a reporter to be certain before reporting. If you are unsure, report it and let us assess it.',
    ],
  },
  {
    h: 'Compliance with child-safety laws',
    p: [
      'Aangan operates in India and complies with applicable Indian law, including the Protection of Children from Sexual Offences (POCSO) Act, 2012, the Information Technology Act, 2000, and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, which require prompt removal of child sexual abuse material and cooperation with lawful requests from authorities.',
      'Where users are located in other jurisdictions, we comply with the applicable child-safety laws of those jurisdictions and cooperate with lawful requests from their authorities.',
      'These standards also reflect Google Play\'s Child Safety Standards policy and Apple\'s App Store Review Guidelines on objectionable and user-generated content.',
    ],
  },
  {
    h: 'Point of contact',
    p: [
      'For any question, report or lawful request relating to child safety on Aangan — including from Google, Apple, law enforcement, or a child-protection organisation — contact:',
      SUPPORT_EMAIL,
      'This is a monitored mailbox. We aim to acknowledge child-safety correspondence within one working day, and to act on substantiated reports immediately.',
    ],
  },
  {
    h: 'Changes to these standards',
    p: [
      'We may update these standards as the app changes or as regulatory requirements evolve. The date at the top of this page reflects the most recent revision. This page is published at a permanent public address and is not editable by users.',
    ],
  },
];
