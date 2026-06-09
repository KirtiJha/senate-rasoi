import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '../components/BrandMark';
import { useResponsive } from '../components/ui';
import { useThemeColors } from '../theme';

const MAXW = 1080;

export default function LandingScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop, isWide } = useResponsive();

  const go = () => router.push('/sign-in' as any);

  return (
    <View className="flex-1 bg-bg">
      {/* Top bar */}
      <View style={{ paddingTop: insets.top + 8 }} className="border-b border-line bg-bg/95 px-5 pb-3">
        <View className="w-full max-w-[1080px] self-center flex-row items-center">
          <View className="flex-row items-center gap-2 flex-1">
            <BrandMark size={30} id="nav-mark" />
            <Text className="font-display text-[20px] text-ink">Aangan</Text>
          </View>
          <Pressable onPress={go} hitSlop={6} className="rounded-full px-3.5 py-2 active:opacity-70">
            <Text className="font-sans-sb text-[14px] text-ink">Sign in</Text>
          </Pressable>
          <Pressable onPress={go} className="ml-1 rounded-full bg-accent px-4 py-2 active:bg-accent-press">
            <Text className="font-sans-sb text-[14px] text-on-accent">Get started</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Hero ── */}
        <LinearGradient colors={['#FFF3EE', '#FFE7DF', '#FFF7F4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View className="w-full self-center px-5" style={{ maxWidth: MAXW, paddingTop: isDesktop ? 72 : 44, paddingBottom: isDesktop ? 72 : 44 }}>
            <View className={isWide ? 'flex-row items-center gap-12' : ''}>
              <View className="flex-1">
                <View className="mb-4 flex-row items-center gap-2 self-start rounded-full border border-accent/30 bg-white/70 px-3 py-1.5">
                  <View className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <Text className="font-sans-sb text-[12px] text-accent">A private super-app for your society</Text>
                </View>
                <Text className="font-display-x text-ink" style={{ fontSize: isDesktop ? 46 : 33, lineHeight: isDesktop ? 52 : 38 }}>
                  Everything neighbours do for each other — in one private app.
                </Text>
                <Text className="mt-4 max-w-[560px] font-sans-md text-muted" style={{ fontSize: isDesktop ? 17 : 15, lineHeight: isDesktop ? 27 : 23 }}>
                  Order home-cooked meals, find trusted local services, buy &amp; sell, chat, vote, and stay
                  organised — all inside your verified residential society.
                </Text>
                <View className="mt-7 flex-row flex-wrap items-center gap-3">
                  <Pressable onPress={go} className="flex-row items-center gap-2 rounded-2xl bg-accent px-6 py-3.5 active:bg-accent-press">
                    <Text className="font-sans-bold text-[16px] text-on-accent">Start your society</Text>
                    <Ionicons name="arrow-forward" size={18} color={c.onAccent} />
                  </Pressable>
                  <Pressable onPress={go} className="rounded-2xl border border-line bg-white px-6 py-3.5 active:opacity-70">
                    <Text className="font-sans-bold text-[16px] text-ink">Explore Aangan</Text>
                  </Pressable>
                </View>
                <View className="mt-6 flex-row flex-wrap items-center gap-x-5 gap-y-2">
                  {['Society-verified', 'No SMS/OTP — phone + PIN', 'Works on web & mobile'].map((t) => (
                    <View key={t} className="flex-row items-center gap-1.5">
                      <Ionicons name="checkmark-circle" size={15} color="#16A34A" />
                      <Text className="font-sans-md text-[13px] text-muted">{t}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Visual */}
              {isWide ? (
                <View className="flex-1 items-center">
                  <HeroCard c={c} />
                </View>
              ) : (
                <View className="mt-9 items-center"><HeroCard c={c} /></View>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* ── Why not WhatsApp groups? ── */}
        <Section>
          <Text className="text-center font-sans-sb text-[13px] uppercase tracking-wider text-accent">Why not just a WhatsApp group?</Text>
          <Text className="mx-auto mt-2 max-w-[680px] text-center font-display-x text-ink" style={{ fontSize: isDesktop ? 30 : 24, lineHeight: isDesktop ? 38 : 31 }}>
            Society life is scattered across a dozen chats. Aangan puts it in one place.
          </Text>
          <View className={`mt-9 ${isWide ? 'flex-row' : ''} gap-4`}>
            <View className="flex-1 rounded-3xl border border-line bg-surface p-5">
              <View className="mb-3 flex-row items-center gap-2">
                <Ionicons name="chatbubbles-outline" size={20} color={c.faint} />
                <Text className="font-sans-bold text-[15px] text-muted">Today, with WhatsApp groups</Text>
              </View>
              {['Dishes & orders lost in the scroll', 'No directory — who lives where?', 'Polls become 40 "+1" messages', 'Listings & services nobody can find later', 'Payments chased one-by-one'].map((t) => (
                <View key={t} className="mb-2 flex-row items-center gap-2">
                  <Ionicons name="close" size={15} color="#EF4444" />
                  <Text className="font-sans-md text-[14px] text-muted">{t}</Text>
                </View>
              ))}
            </View>
            <View className="flex-1 overflow-hidden rounded-3xl p-[1.5px]" style={{ backgroundColor: c.accent }}>
              <View className="flex-1 rounded-[22px] bg-surface p-5">
                <View className="mb-3 flex-row items-center gap-2">
                  <BrandMark size={20} id="vs-mark" />
                  <Text className="font-sans-bold text-[15px] text-ink">With Aangan</Text>
                </View>
                {['A live food board with reserve & pay', 'Owner/tenant directory with one-tap contact', 'Real polls with instant results', 'A searchable marketplace & services', 'A payment ledger both sides confirm'].map((t) => (
                  <View key={t} className="mb-2 flex-row items-center gap-2">
                    <Ionicons name="checkmark" size={15} color="#16A34A" />
                    <Text className="font-sans-md text-[14px] text-ink">{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </Section>

        {/* ── Commerce ── */}
        <Section bg={c.inset}>
          <Kicker>Earn & save from your neighbours</Kicker>
          <Heading isDesktop={isDesktop}>A local economy inside your gate</Heading>
          <View className={`mt-9 ${isWide ? 'flex-row' : ''} gap-4`}>
            <Feature c={c} icon="restaurant" color="#FF5A3C" title="Home food & tiffins"
              body="Discover daily dishes, reserve plates, and subscribe to tiffin services from verified home chefs in your own society." />
            <Feature c={c} icon="pricetags" color="#14B8A6" title="Marketplace & services"
              body="Buy, sell, and find trusted help across 15 categories — tuitions, tailoring, clinics, carpooling and more — with inquiries and per-listing chat." />
            <Feature c={c} icon="wallet" color="#16A34A" title="UPI payments, the Indian way"
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
                <View className="h-full rounded-2xl border border-line bg-surface p-4">
                  <View className="mb-2.5 h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: f.color + '20' }}>
                    <Ionicons name={f.icon as any} size={20} color={f.color} />
                  </View>
                  <Text className="font-sans-bold text-[14px] text-ink">{f.title}</Text>
                  <Text className="mt-0.5 font-sans-md text-[12px] leading-[17px] text-muted">{f.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </Section>

        {/* ── Trust ── */}
        <Section bg={c.inset}>
          <View className={isWide ? 'flex-row items-center gap-12' : ''}>
            <View className="flex-1">
              <Kicker left>Built on trust, not strangers</Kicker>
              <Heading isDesktop={isDesktop} left>A safer graph than open neighbourhood apps</Heading>
              <Text className="mt-3 max-w-[520px] font-sans-md text-[15px] leading-[24px] text-muted">
                Everyone you see actually lives in your society. Access is society-scoped, the directory is
                real, and admins keep it clean — so every deal, chat and payment starts from trust.
              </Text>
            </View>
            <View className="mt-7 flex-1 gap-3 lg:mt-0">
              {TRUST.map((t) => (
                <View key={t.title} className="flex-row items-start gap-3 rounded-2xl border border-line bg-surface p-4">
                  <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: t.color + '20' }}>
                    <Ionicons name={t.icon as any} size={18} color={t.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-sans-bold text-[14px] text-ink">{t.title}</Text>
                    <Text className="mt-0.5 font-sans-md text-[12.5px] leading-[18px] text-muted">{t.body}</Text>
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
                <Text className="mt-4 text-center font-display-x text-white" style={{ fontSize: isDesktop ? 32 : 26, lineHeight: isDesktop ? 40 : 33 }}>
                  Turn your society into a trusted local network
                </Text>
                <Text className="mt-2.5 max-w-[520px] text-center font-sans-md text-[15px] leading-[23px] text-white/90">
                  Discover, transact, coordinate and help each other — without ever leaving your society.
                </Text>
                <Pressable onPress={go} className="mt-7 flex-row items-center gap-2 rounded-2xl bg-white px-7 py-3.5 active:opacity-90">
                  <Text className="font-sans-bold text-[16px]" style={{ color: '#F5492B' }}>Get started — it's free</Text>
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
              <Text className="font-display text-[16px] text-ink">Aangan</Text>
              <Text className="font-sans-md text-[12px] text-faint">· आँगन, your society's courtyard</Text>
            </View>
            <Pressable onPress={go}><Text className="font-sans-sb text-[13px] text-accent">Sign in</Text></Pressable>
          </View>
          <Text className="mt-3 w-full max-w-[1080px] self-center font-sans-md text-[11px] text-faint">
            Made for Indian apartment societies. Phone + PIN sign-in, no SMS/OTP. Payments happen directly between
            neighbours over UPI — Aangan never holds your money.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Hero visual: a stacked "app preview" card ───────────────────────
function HeroCard({ c }: { c: ReturnType<typeof useThemeColors> }) {
  const rows = [
    { icon: 'restaurant', color: '#FF5A3C', title: 'Aalu parwal sabji', sub: 'Pratibha · 3 plates left · ₹80' },
    { icon: 'pricetags', color: '#14B8A6', title: 'Maths tuition (Class 9–10)', sub: 'Flat C-204 · ₹4,000/mo' },
    { icon: 'stats-chart', color: '#6366F1', title: 'New gym equipment?', sub: 'Poll · 28 votes' },
    { icon: 'wallet', color: '#16A34A', title: 'Paid ₹80 to Pratibha', sub: 'Awaiting confirmation' },
  ];
  return (
    <View className="w-full max-w-[380px] rounded-[28px] border border-line bg-surface p-3.5" style={{ shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 30, shadowOffset: { width: 0, height: 16 } }}>
      <View className="mb-3 flex-row items-center gap-2 px-1.5 pt-1">
        <BrandMark size={22} id="hero-mark" />
        <Text className="flex-1 font-display text-[15px] text-ink">Today in your society</Text>
        <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: '#0D948822' }}>
          <Ionicons name="business" size={10} color="#0D9488" />
          <Text className="text-[10px] font-sans-sb" style={{ color: '#0D9488' }}>Green Valley</Text>
        </View>
      </View>
      {rows.map((r, i) => (
        <View key={i} className={`flex-row items-center gap-3 rounded-2xl bg-bg p-3 ${i ? 'mt-2' : ''}`}>
          <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: r.color + '20' }}>
            <Ionicons name={r.icon as any} size={19} color={r.color} />
          </View>
          <View className="flex-1">
            <Text className="font-sans-bold text-[13px] text-ink" numberOfLines={1}>{r.title}</Text>
            <Text className="font-sans-md text-[11px] text-muted" numberOfLines={1}>{r.sub}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Small layout helpers ────────────────────────────────────────────
function Section({ children, bg }: { children: ReactNode; bg?: string }) {
  return (
    <View style={{ backgroundColor: bg }} className="px-5 py-14">
      <View className="w-full self-center" style={{ maxWidth: MAXW }}>{children}</View>
    </View>
  );
}
function Kicker({ children, left }: { children: ReactNode; left?: boolean }) {
  return <Text className={`font-sans-sb text-[13px] uppercase tracking-wider text-accent ${left ? '' : 'text-center'}`}>{children}</Text>;
}
function Heading({ children, isDesktop, left }: { children: ReactNode; isDesktop: boolean; left?: boolean }) {
  return (
    <Text className={`mt-2 font-display-x text-ink ${left ? '' : 'text-center'}`} style={{ fontSize: isDesktop ? 30 : 24, lineHeight: isDesktop ? 38 : 31 }}>
      {children}
    </Text>
  );
}
function Feature({ c, icon, color, title, body }: { c: ReturnType<typeof useThemeColors>; icon: string; color: string; title: string; body: string }) {
  return (
    <View className="flex-1 rounded-3xl border border-line bg-surface p-5">
      <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: color + '20' }}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text className="font-sans-bold text-[17px] text-ink">{title}</Text>
      <Text className="mt-1.5 font-sans-md text-[14px] leading-[21px] text-muted">{body}</Text>
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
  { icon: 'shield-checkmark', color: '#16A34A', title: 'Society-scoped access', body: "You only ever see your own society — never strangers." },
  { icon: 'id-card', color: '#0EA5E9', title: 'Real resident directory', body: 'Owner/tenant, flat, profession — a verified neighbour graph.' },
  { icon: 'construct', color: '#F59E0B', title: 'Admin moderation', body: 'Society admins manage members, roles and content.' },
];
