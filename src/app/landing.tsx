import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, G } from 'react-native-svg';
import { BrandMark } from '../components/BrandMark';
import { useResponsive } from '../components/ui';

const MAXW = 1080;
// Fixed light palette — the landing is a marketing page and stays light
// regardless of the visitor's device theme.
const P = {
  ink: '#1B1410',
  muted: '#6E665F',
  faint: '#A8A099',
  accent: '#0F6E56',
  orange: '#E8650A',
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
          <Pressable onPress={() => router.push('/onboard' as any)} className="ml-1 rounded-full px-4 py-2 active:opacity-90" style={{ backgroundColor: P.accent }}>
            <Text className="font-sans-sb" style={{ fontSize: 14, color: '#fff' }}>Get started</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Hero ── */}
        <LinearGradient colors={['#EAF6F2', '#D8F0E7', '#F1FAF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View className="w-full self-center px-5" style={{ maxWidth: MAXW, paddingTop: isDesktop ? 72 : 44, paddingBottom: isDesktop ? 72 : 44 }}>
            <View className={isWide ? 'flex-row items-center gap-12' : ''}>
              <View className="flex-1">
                <View className="mb-4 flex-row items-center gap-2 self-start rounded-full px-3 py-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.75)', borderWidth: 1, borderColor: 'rgba(15,110,86,0.3)' }}>
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
                  <Pressable onPress={() => router.push('/onboard' as any)} className="flex-row items-center gap-2 rounded-2xl px-6 py-3.5 active:opacity-90" style={{ backgroundColor: P.accent }}>
                    <Text className="font-sans-bold" style={{ fontSize: 16, color: '#fff' }}>Find your society</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </Pressable>
                  <Pressable onPress={go} hitSlop={6} className="flex-row items-center gap-1 px-2 py-3.5 active:opacity-60">
                    <Text className="font-sans-bold" style={{ fontSize: 16, color: P.accent }}>Sign in</Text>
                    <Ionicons name="arrow-forward" size={16} color={P.accent} />
                  </Pressable>
                </View>
                <View className="mt-6 flex-row flex-wrap items-center gap-x-5 gap-y-2">
                  {['Society-verified', 'Built-in AI assistant', 'No SMS/OTP — phone + PIN', 'Works on web & mobile'].map((t) => (
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
              {['Dishes & orders lost in the scroll', 'No directory — who lives where?', 'Polls become 40 "+1" messages', "Listings & services nobody can find later", 'Payments chased one-by-one', 'Need an answer? Scroll 500 messages'].map((t) => (
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
                {['A live food board with reserve & pay', 'Owner/tenant directory with one-tap contact', 'Real polls with instant results', 'A searchable marketplace & services', 'A payment ledger both sides confirm', 'Ask Aangan — answers in your language'].map((t) => (
                  <View key={t} className="mb-2 flex-row items-center gap-2">
                    <Ionicons name="checkmark" size={15} color="#16A34A" />
                    <Text className="font-sans-md" style={{ fontSize: 14, color: P.ink }}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </Section>

        {/* ── AI ── */}
        <Section>
          <Kicker>Powered by AI · private by design</Kicker>
          <Heading isDesktop={isDesktop}>Your society's own assistant</Heading>
          <Text className="mt-3 w-full max-w-[640px] self-center text-center font-sans-md" style={{ fontSize: 15, lineHeight: 23, color: P.muted }}>
            Ask in plain words, snap a photo to post, and read everything in your language. The AI works only
            over your own society's data — and personal phone numbers are never sent.
          </Text>

          {/* Ask Aangan showcase */}
          <View className="mt-9 overflow-hidden rounded-3xl p-[1.5px]" style={{ backgroundColor: P.accent }}>
            <View className={`rounded-[22px] p-6 ${isWide ? 'flex-row items-center gap-10' : ''}`} style={{ backgroundColor: P.surface }}>
              <View className="flex-1">
                <View className="mb-3 flex-row items-center gap-2">
                  <BrandMark size={30} id="ai-mark" />
                  <Text className="font-display" style={{ fontSize: 21, color: P.ink }}>Ask Aangan</Text>
                </View>
                <Text className="font-sans-md" style={{ fontSize: 15, lineHeight: 23, color: P.muted }}>
                  A friendly chat that answers anything about your society — food, flats to rent, things to
                  borrow, trusted services, who lives where, announcements and more. Just ask the way you'd ask
                  a neighbour, follow-up questions and all.
                </Text>
                <View className="mt-4 flex-row flex-wrap gap-2">
                  {['Any veg tiffin for lunch?', '2 BHK for rent?', 'Is there a doctor here?', 'Where can I borrow a drill?'].map((q) => (
                    <View key={q} className="rounded-full px-3 py-1.5" style={{ borderWidth: 1, borderColor: P.line, backgroundColor: P.bg }}>
                      <Text className="font-sans-md" style={{ fontSize: 12.5, color: P.muted }}>{q}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View className={isWide ? '' : 'mt-6'}>
                <AskPreview />
              </View>
            </View>
          </View>

          {/* Supporting AI features */}
          <View className={`mt-4 ${isWide ? 'flex-row' : ''} gap-4`}>
            <Feature icon="camera" color="#0F6E56" title="Snap to post"
              body="Photograph your dish, listing or item — AI fills in the title, category and details, so posting takes seconds. It also flags photos that don't match." />
            <Feature icon="language" color="#7C3AED" title="Every language"
              body="Posts, listings and menus auto-translate into each reader's preferred language — 12 Indian languages — with one tap to see the original." />
            <Feature icon="sparkles" color="#E8650A" title="Weekly digest"
              body="A warm AI recap of the week in your society — new dishes, listings, polls and announcements — waiting on your home screen." />
          </View>
        </Section>

        {/* ── Commerce ── */}
        <Section bg={P.inset}>
          <Kicker>Earn & save from your neighbours</Kicker>
          <Heading isDesktop={isDesktop}>A local economy inside your gate</Heading>
          <View className={`mt-9 ${isWide ? 'flex-row' : ''} gap-4`}>
            <Feature icon="restaurant" color="#E8650A" title="Home food & tiffins"
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
            <LinearGradient colors={['#15936F', '#0A4F3A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View className="items-center px-6 py-14">
                <BrandMark size={56} id="cta-mark" />
                <Text className="mt-4 text-center font-display-x" style={{ color: '#fff', fontSize: isDesktop ? 32 : 26, lineHeight: isDesktop ? 40 : 33 }}>
                  Turn your society into a trusted local network
                </Text>
                <Text className="mt-2.5 max-w-[520px] text-center font-sans-md" style={{ fontSize: 15, lineHeight: 23, color: 'rgba(255,255,255,0.9)' }}>
                  Discover, transact, coordinate and help each other — without ever leaving your society.
                </Text>
                <Pressable onPress={() => router.push('/onboard' as any)} className="mt-7 flex-row items-center gap-2 rounded-2xl px-7 py-3.5 active:opacity-90" style={{ backgroundColor: '#fff' }}>
                  <Text className="font-sans-bold" style={{ fontSize: 16, color: '#0F6E56' }}>Find your society — it's free</Text>
                  <Ionicons name="arrow-forward" size={18} color="#0F6E56" />
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* ── Footer ── */}
        <View className="px-5 pb-10 pt-12" style={{ borderTopWidth: 1, borderTopColor: P.line }}>
          <View className="items-center">
            <LogoLockup />
          </View>
          <View className="mt-7 flex-row items-center justify-center gap-5">
            <Text onPress={() => router.push('/legal' as any)} className="font-sans-sb" style={{ fontSize: 13, color: P.muted }}>Terms</Text>
            <Text onPress={() => router.push('/legal?tab=privacy' as any)} className="font-sans-sb" style={{ fontSize: 13, color: P.muted }}>Privacy</Text>
            <Text onPress={() => router.push('/about' as any)} className="font-sans-sb" style={{ fontSize: 13, color: P.accent }}>About</Text>
          </View>
          <Text className="mt-4 w-full max-w-[620px] self-center text-center font-sans-md" style={{ fontSize: 11, lineHeight: 16, color: P.faint }}>
            Made for Indian apartment societies. Phone + PIN sign-in, no SMS/OTP. Payments happen directly between
            neighbours over UPI — Aangan never holds your money.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Full brand lockup (faithful port of assets/images/aangan_diversity_logo.svg) ──
// 8 petals of the diversity flower (matches assets/images/aangan_diversity_logo.svg).
const LOGO_PETALS = [
  { a: 0, c: '#E8650A', o: 0.92 },
  { a: 45, c: '#D4537E', o: 0.88 },
  { a: 90, c: '#1D9E75', o: 0.9 },
  { a: 135, c: '#534AB7', o: 0.88 },
  { a: 180, c: '#BA7517', o: 0.9 },
  { a: 225, c: '#D85A30', o: 0.88 },
  { a: 270, c: '#185FA5', o: 0.88 },
  { a: 315, c: '#3B6D11', o: 0.88 },
];

function DiversityEmblem({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 236 236" accessibilityLabel="Aangan">
      <Circle cx={118} cy={118} r={116} fill="none" stroke="#D3D1C7" strokeWidth={0.75} opacity={0.6} />
      <G transform="translate(118,118)">
        {LOGO_PETALS.map((p) => (
          <G key={p.a} transform={`rotate(${p.a})`}><Ellipse cx={0} cy={-58} rx={22} ry={58} fill={p.c} opacity={p.o} /></G>
        ))}
        <Circle cx={0} cy={0} r={54} fill="#ffffff" opacity={0.92} />
        <Circle cx={0} cy={0} r={54} fill="none" stroke="#e8e5e0" strokeWidth={1} />
        {LOGO_PETALS.map((p) => (
          <G key={`i${p.a}`} transform={`rotate(${p.a})`}><Ellipse cx={0} cy={-33} rx={13} ry={19} fill={p.c} opacity={0.26} /></G>
        ))}
        <Circle cx={0} cy={0} r={22} fill="#1A1A1A" />
        <Circle cx={0} cy={0} r={14} fill="#E8650A" />
        <Circle cx={0} cy={0} r={6} fill="#ffffff" />
        <Circle cx={0} cy={0} r={2.5} fill="#E8650A" />
        {LOGO_PETALS.map((p) => (
          <G key={`d${p.a}`} transform={`rotate(${p.a})`}><Circle cx={0} cy={-115} r={4} fill={p.c} opacity={0.47} /></G>
        ))}
      </G>
    </Svg>
  );
}

function LogoLockup({ emblem = 94 }: { emblem?: number }) {
  const word = emblem * 0.44;
  return (
    <View className="flex-row items-center">
      <DiversityEmblem size={emblem} />
      <View style={{ marginLeft: 2 }}>
        <Text className="font-display-x" style={{ fontSize: word, lineHeight: word * 1.1, color: '#1A1A1A', letterSpacing: -1.2 }}>aangan</Text>
        <Text className="font-sans-md" style={{ fontSize: emblem * 0.13, letterSpacing: 4, color: '#888780', marginTop: 1 }}>आँगन</Text>
        <View className="flex-row" style={{ marginTop: 7, marginBottom: 5 }}>
          {LOGO_PETALS.map((p) => (
            <View key={p.a} style={{ width: 15, height: 3.5, borderRadius: 2, backgroundColor: p.c, marginRight: 3 }} />
          ))}
        </View>
        <Text className="font-sans" style={{ fontSize: emblem * 0.1, letterSpacing: 1.3, color: '#B4B2A9' }}>every home. every language. one courtyard.</Text>
      </View>
    </View>
  );
}

// ── Ask Aangan mini-chat preview (for the AI section) ───────────────
function AskPreview() {
  return (
    <View className="w-full max-w-[340px] rounded-[24px] p-3.5" style={{ borderWidth: 1, borderColor: P.line, backgroundColor: P.bg, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } }}>
      <View className="max-w-[80%] self-end rounded-2xl rounded-br-md px-3.5 py-2.5" style={{ backgroundColor: P.accent }}>
        <Text className="font-sans-md" style={{ fontSize: 13, color: '#fff' }}>Any veg tiffin for lunch?</Text>
      </View>
      <View className="mt-2.5 flex-row items-end gap-2">
        <BrandMark size={22} id="ask-preview-mark" />
        <View className="flex-1 rounded-2xl rounded-bl-md px-3.5 py-2.5" style={{ borderWidth: 1, borderColor: P.line, backgroundColor: P.surface }}>
          <Text className="font-sans-md" style={{ fontSize: 13, lineHeight: 19, color: P.ink }}>Yes! Found 2 veg lunch tiffins in your society 🍱</Text>
        </View>
      </View>
      <View className="ml-8 mt-2 flex-row items-center gap-2.5 rounded-2xl p-2.5" style={{ borderWidth: 1, borderColor: P.line, backgroundColor: P.surface }}>
        <View className="h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: '#F59E0B20' }}>
          <Ionicons name="repeat" size={16} color="#F59E0B" />
        </View>
        <View className="flex-1">
          <Text className="font-sans-bold" style={{ fontSize: 12.5, color: P.ink }} numberOfLines={1}>Annapurna veg tiffin</Text>
          <Text className="font-sans-md" style={{ fontSize: 11, color: P.muted }} numberOfLines={1}>Tiffin · ₹70/day</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={P.faint} />
      </View>
    </View>
  );
}

// ── Hero visual: a stacked "app preview" card ───────────────────────
function HeroCard() {
  const rows = [
    { icon: 'sparkles', color: '#0F6E56', title: '“Any veg tiffin today?”', sub: 'Ask Aangan · 2 matches found' },
    { icon: 'restaurant', color: '#E8650A', title: 'Aalu parwal sabji', sub: 'Pratibha · 3 plates left · ₹80' },
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
