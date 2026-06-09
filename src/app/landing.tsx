import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '../components/BrandMark';
import { useResponsive } from '../components/ui';

const MAXW = 1080;
// Fixed light palette — the landing is a marketing page and stays light
// regardless of the visitor's device theme.
const P = {
  ink: '#1B1410',
  muted: '#6E665F',
  faint: '#A8A099',
  accent: '#FF5A3C',
  surface: '#FFFFFF',
  bg: '#FCF7F3',
  inset: '#F4EDE7',
  line: '#ECE4DC',
};

export default function LandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDesktop, isWide } = useResponsive();
  const go = () => router.push('/sign-in' as any);

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      {/* Top bar */}
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: P.line, backgroundColor: P.bg }}>
        <View className="w-full max-w-[1080px] self-center flex-row items-center">
          <View className="flex-row items-center gap-2 flex-1">
            <BrandMark size={30} id="nav-mark" />
            <Text className="font-display" style={{ fontSize: 20, color: P.ink }}>Aangan</Text>
          </View>
          <Pressable onPress={go} hitSlop={6} className="rounded-full px-3.5 py-2 active:opacity-70">
            <Text className="font-sans-sb" style={{ fontSize: 14, color: P.ink }}>Sign in</Text>
          </Pressable>
          <Pressable onPress={go} className="ml-1 rounded-full px-4 py-2 active:opacity-90" style={{ backgroundColor: P.accent }}>
            <Text className="font-sans-sb" style={{ fontSize: 14, color: '#fff' }}>Get started</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Hero ── */}
        <LinearGradient colors={['#FFF3EE', '#FFE7DF', '#FFF7F4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View className="w-full self-center px-5" style={{ maxWidth: MAXW, paddingTop: isDesktop ? 72 : 44, paddingBottom: isDesktop ? 72 : 44 }}>
            <View className={isWide ? 'flex-row items-center gap-12' : ''}>
              <View className="flex-1">
                <View className="mb-4 flex-row items-center gap-2 self-start rounded-full px-3 py-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.75)', borderWidth: 1, borderColor: 'rgba(255,90,60,0.3)' }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: P.accent }} />
                  <Text className="font-sans-sb" style={{ fontSize: 12, color: P.accent }}>A private super-app for your society</Text>
                </View>
                <Text className="font-display-x" style={{ color: P.ink, fontSize: isDesktop ? 46 : 32, lineHeight: isDesktop ? 52 : 38 }}>
                  Everything neighbours do for each other — in one private app.
                </Text>
                <Text className="mt-4 max-w-[560px] font-sans-md" style={{ color: P.muted, fontSize: isDesktop ? 17 : 15, lineHeight: isDesktop ? 27 : 23 }}>
                  Order home-cooked meals, find trusted local services, buy &amp; sell, chat, vote, and stay
                  organised — all inside your verified residential society.
                </Text>
                <View className="mt-7 flex-row flex-wrap items-center gap-3">
                  <Pressable onPress={go} className="flex-row items-center gap-2 rounded-2xl px-6 py-3.5 active:opacity-90" style={{ backgroundColor: P.accent }}>
                    <Text className="font-sans-bold" style={{ fontSize: 16, color: '#fff' }}>Start your society</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </Pressable>
                  <Pressable onPress={go} className="rounded-2xl px-6 py-3.5 active:opacity-70" style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: P.line }}>
                    <Text className="font-sans-bold" style={{ fontSize: 16, color: P.ink }}>Explore Aangan</Text>
                  </Pressable>
                </View>
                <View className="mt-6 flex-row flex-wrap items-center gap-x-5 gap-y-2">
                  {['Society-verified', 'No SMS/OTP — phone + PIN', 'Works on web & mobile'].map((t) => (
                    <View key={t} className="flex-row items-center gap-1.5">
                      <Ionicons name="checkmark-circle" size={15} color="#16A34A" />
                      <Text className="font-sans-md" style={{ fontSize: 13, color: P.muted }}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className={isWide ? 'flex-1 items-center' : 'mt-9 items-center'}>
                <HeroCard />
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ── Why not WhatsApp groups? ── */}
        <Section>
          <Kicker>Why not just a WhatsApp group?</Kicker>
          <Heading isDesktop={isDesktop}>Society life is scattered across a dozen chats. Aangan puts it in one place.</Heading>
          <View className={`mt-9 ${isWide ? 'flex-row' : ''} gap-4`}>
            <View className="flex-1 rounded-3xl p-5" style={{ borderWidth: 1, borderColor: P.line, backgroundColor: P.surface }}>
              <View className="mb-3 flex-row items-center gap-2">
                <Ionicons name="chatbubbles-outline" size={20} color={P.faint} />
                <Text className="font-sans-bold" style={{ fontSize: 15, color: P.muted }}>Today, with WhatsApp groups</Text>
              </View>
              {['Dishes & orders lost in the scroll', 'No directory — who lives where?', 'Polls become 40 "+1" messages', "Listings & services nobody can find later", 'Payments chased one-by-one'].map((t) => (
                <View key={t} className="mb-2 flex-row items-center gap-2">
                  <Ionicons name="close" size={15} color="#EF4444" />
                  <Text className="font-sans-md" style={{ fontSize: 14, color: P.muted }}>{t}</Text>
                </View>
              ))}
            </View>
            <View className="flex-1 overflow-hidden rounded-3xl p-[1.5px]" style={{ backgroundColor: P.accent }}>
              <View className="flex-1 rounded-[22px] p-5" style={{ backgroundColor: P.surface }}>
                <View className="mb-3 flex-row items-center gap-2">
                  <BrandMark size={20} id="vs-mark" />
                  <Text className="font-sans-bold" style={{ fontSize: 15, color: P.ink }}>With Aangan</Text>
                </View>
                {['A live food board with reserve & pay', 'Owner/tenant directory with one-tap contact', 'Real polls with instant results', 'A searchable marketplace & services', 'A payment ledger both sides confirm'].map((t) => (
                  <View key={t} className="mb-2 flex-row items-center gap-2">
                    <Ionicons name="checkmark" size={15} color="#16A34A" />
                    <Text className="font-sans-md" style={{ fontSize: 14, color: P.ink }}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </Section>

        {/* ── Commerce ── */}
        <Section bg={P.inset}>
          <Kicker>Earn & save from your neighbours</Kicker>
          <Heading isDesktop={isDesktop}>A local economy inside your gate</Heading>
          <View className={`mt-9 ${isWide ? 'flex-row' : ''} gap-4`}>
            <Feature icon="restaurant" color="#FF5A3C" title="Home food & tiffins"
              body="Discover daily dishes, reserve plates, and subscribe to tiffin services from verified home chefs in your own society." />
            <Feature icon="pricetags" color="#14B8A6" title="Marketplace & services"
              body="Buy, sell, and find trusted help across 15 categories — tuitions, tailoring, clinics, carpooling and more — with inquiries and per-listing chat." />
            <Feature icon="wallet" color="#16A34A" title="UPI payments, the Indian way"
              body="Coordinate in-app, then pay neighbour-to-neighbour over UPI — a one-tap deep link or QR, with a ledger both sides confirm. No heavy checkout." />
          </View>
        </Section>

        {/* ── Community ── */}
        <Section>
          <Kicker>Coordinate & stay organised</Kicker>
          <Heading isDesktop={isDesktop}>Community that actually works</Heading>
          <View className="mt-9 flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
            {COMMUNITY.map((f) => (
              <View key={f.title} style={{ width: isWide ? '25%' : '50%', padding: 6 }}>
                <View className="h-full rounded-2xl p-4" style={{ borderWidth: 1, borderColor: P.line, backgroundColor: P.surface }}>
                  <View className="mb-2.5 h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: f.color + '20' }}>
                    <Ionicons name={f.icon as any} size={20} color={f.color} />
                  </View>
                  <Text className="font-sans-bold" style={{ fontSize: 14, color: P.ink }}>{f.title}</Text>
                  <Text className="mt-0.5 font-sans-md" style={{ fontSize: 12, lineHeight: 17, color: P.muted }}>{f.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </Section>

        {/* ── Trust ── */}
        <Section bg={P.inset}>
          <View className={isWide ? 'flex-row items-center gap-12' : ''}>
            <View className="flex-1">
              <Kicker left>Built on trust, not strangers</Kicker>
              <Heading isDesktop={isDesktop} left>A safer graph than open neighbourhood apps</Heading>
              <Text className="mt-3 max-w-[520px] font-sans-md" style={{ fontSize: 15, lineHeight: 24, color: P.muted }}>
                Everyone you see actually lives in your society. Access is society-scoped, the directory is
                real, and admins keep it clean — so every deal, chat and payment starts from trust.
              </Text>
            </View>
            <View className={`flex-1 gap-3 ${isWide ? '' : 'mt-7'}`}>
              {TRUST.map((t) => (
                <View key={t.title} className="flex-row items-start gap-3 rounded-2xl p-4" style={{ borderWidth: 1, borderColor: P.line, backgroundColor: P.surface }}>
                  <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: t.color + '20' }}>
                    <Ionicons name={t.icon as any} size={18} color={t.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-sans-bold" style={{ fontSize: 14, color: P.ink }}>{t.title}</Text>
                    <Text className="mt-0.5 font-sans-md" style={{ fontSize: 12.5, lineHeight: 18, color: P.muted }}>{t.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Section>

        {/* ── Final CTA ── */}
        <View className="px-5 py-4">
          <View className="w-full self-center overflow-hidden rounded-[32px]" style={{ maxWidth: MAXW }}>
            <LinearGradient colors={['#FF7A57', '#F5492B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View className="items-center px-6 py-14">
                <BrandMark size={56} id="cta-mark" />
                <Text className="mt-4 text-center font-display-x" style={{ color: '#fff', fontSize: isDesktop ? 32 : 26, lineHeight: isDesktop ? 40 : 33 }}>
                  Turn your society into a trusted local network
                </Text>
                <Text className="mt-2.5 max-w-[520px] text-center font-sans-md" style={{ fontSize: 15, lineHeight: 23, color: 'rgba(255,255,255,0.9)' }}>
                  Discover, transact, coordinate and help each other — without ever leaving your society.
                </Text>
                <Pressable onPress={go} className="mt-7 flex-row items-center gap-2 rounded-2xl px-7 py-3.5 active:opacity-90" style={{ backgroundColor: '#fff' }}>
                  <Text className="font-sans-bold" style={{ fontSize: 16, color: '#F5492B' }}>Get started — it's free</Text>
                  <Ionicons name="arrow-forward" size={18} color="#F5492B" />
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* ── Footer ── */}
        <View className="px-5 pb-10 pt-6">
          <View className="w-full self-center flex-row flex-wrap items-center gap-3" style={{ maxWidth: MAXW }}>
            <View className="flex-row items-center gap-2 flex-1">
              <BrandMark size={24} id="ft-mark" />
              <Text className="font-display" style={{ fontSize: 16, color: P.ink }}>Aangan</Text>
              <Text className="font-sans-md" style={{ fontSize: 12, color: P.faint }}>· आँगन, your society's courtyard</Text>
            </View>
            <View className="flex-row items-center gap-4">
              <Text onPress={() => router.push('/legal' as any)} className="font-sans-sb" style={{ fontSize: 13, color: P.muted }}>Terms</Text>
              <Text onPress={() => router.push('/legal?tab=privacy' as any)} className="font-sans-sb" style={{ fontSize: 13, color: P.muted }}>Privacy</Text>
              <Text onPress={go} className="font-sans-sb" style={{ fontSize: 13, color: P.accent }}>Sign in</Text>
            </View>
          </View>
          <Text className="mt-3 w-full max-w-[1080px] self-center font-sans-md" style={{ fontSize: 11, color: P.faint }}>
            Made for Indian apartment societies. Phone + PIN sign-in, no SMS/OTP. Payments happen directly between
            neighbours over UPI — Aangan never holds your money.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Hero visual: a stacked "app preview" card ───────────────────────
function HeroCard() {
  const rows = [
    { icon: 'restaurant', color: '#FF5A3C', title: 'Aalu parwal sabji', sub: 'Pratibha · 3 plates left · ₹80' },
    { icon: 'pricetags', color: '#14B8A6', title: 'Maths tuition (Class 9–10)', sub: 'Flat C-204 · ₹4,000/mo' },
    { icon: 'stats-chart', color: '#6366F1', title: 'New gym equipment?', sub: 'Poll · 28 votes' },
    { icon: 'wallet', color: '#16A34A', title: 'Paid ₹80 to Pratibha', sub: 'Awaiting confirmation' },
  ];
  return (
    <View className="w-full max-w-[380px] rounded-[28px] p-3.5" style={{ borderWidth: 1, borderColor: P.line, backgroundColor: P.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 30, shadowOffset: { width: 0, height: 16 } }}>
      <View className="mb-3 flex-row items-center gap-2 px-1.5 pt-1">
        <BrandMark size={22} id="hero-mark" />
        <Text className="flex-1 font-display" style={{ fontSize: 15, color: P.ink }}>Today in your society</Text>
        <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: '#0D948822' }}>
          <Ionicons name="business" size={10} color="#0D9488" />
          <Text className="font-sans-sb" style={{ fontSize: 10, color: '#0D9488' }}>Green Valley</Text>
        </View>
      </View>
      {rows.map((r, i) => (
        <View key={i} className="flex-row items-center gap-3 rounded-2xl p-3" style={{ backgroundColor: P.bg, marginTop: i ? 8 : 0 }}>
          <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: r.color + '20' }}>
            <Ionicons name={r.icon as any} size={19} color={r.color} />
          </View>
          <View className="flex-1">
            <Text className="font-sans-bold" style={{ fontSize: 13, color: P.ink }} numberOfLines={1}>{r.title}</Text>
            <Text className="font-sans-md" style={{ fontSize: 11, color: P.muted }} numberOfLines={1}>{r.sub}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Small layout helpers ────────────────────────────────────────────
function Section({ children, bg }: { children: ReactNode; bg?: string }) {
  return (
    <View style={{ backgroundColor: bg ?? P.bg }} className="px-5 py-14">
      <View className="w-full self-center" style={{ maxWidth: MAXW }}>{children}</View>
    </View>
  );
}
function Kicker({ children, left }: { children: ReactNode; left?: boolean }) {
  return <Text className="font-sans-sb" style={{ fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', color: P.accent, textAlign: left ? 'left' : 'center' }}>{children}</Text>;
}
function Heading({ children, isDesktop, left }: { children: ReactNode; isDesktop: boolean; left?: boolean }) {
  return (
    <Text className="mt-2 font-display-x" style={{ color: P.ink, fontSize: isDesktop ? 30 : 24, lineHeight: isDesktop ? 38 : 31, textAlign: left ? 'left' : 'center', maxWidth: left ? undefined : 720, alignSelf: left ? 'auto' : 'center' }}>
      {children}
    </Text>
  );
}
function Feature({ icon, color, title, body }: { icon: string; color: string; title: string; body: string }) {
  return (
    <View className="flex-1 rounded-3xl p-5" style={{ borderWidth: 1, borderColor: P.line, backgroundColor: P.surface }}>
      <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: color + '20' }}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text className="font-sans-bold" style={{ fontSize: 17, color: P.ink }}>{title}</Text>
      <Text className="mt-1.5 font-sans-md" style={{ fontSize: 14, lineHeight: 21, color: P.muted }}>{body}</Text>
    </View>
  );
}

const COMMUNITY = [
  { icon: 'chatbubbles', color: '#3B82F6', title: 'Society feed', body: 'Announcements, issues, events, lost & found — with comments.' },
  { icon: 'stats-chart', color: '#6366F1', title: 'Polls', body: 'Gather opinions and decide together, with live results.' },
  { icon: 'mail', color: '#0EA5E9', title: 'Direct messages', body: 'Private 1:1 chats with any neighbour.' },
  { icon: 'people', color: '#8B5CF6', title: 'Resident directory', body: 'Owners & tenants by flat, one-tap call / WhatsApp / invite.' },
  { icon: 'football', color: '#16A34A', title: 'Sports groups', body: 'Teams per sport with practice schedules & tournaments.' },
  { icon: 'folder', color: '#0EA5E9', title: 'Documents', body: 'Share society files publicly or privately with revoke.' },
  { icon: 'call', color: '#EF4444', title: 'Emergency contacts', body: 'Security, plumber, doctor — one tap to dial.' },
  { icon: 'wallet', color: '#16A34A', title: 'Payments', body: 'Track UPI payments and receipts, both sides confirm.' },
];

const TRUST = [
  { icon: 'shield-checkmark', color: '#16A34A', title: 'Society-scoped access', body: 'You only ever see your own society — never strangers.' },
  { icon: 'id-card', color: '#0EA5E9', title: 'Real resident directory', body: 'Owner/tenant, flat, profession — a verified neighbour graph.' },
  { icon: 'construct', color: '#F59E0B', title: 'Admin moderation', body: 'Society admins manage members, roles and content.' },
];
