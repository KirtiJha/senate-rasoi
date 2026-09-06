import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModerationMenu } from '../../components/ModerationMenu';
import { useOpenThread } from '../../components/MessageNeighbour';
import { Avatar, Badge, Button, Container, DetailSkeleton, ErrorState, Touchable } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useBlocks } from '../../context/blocks';
import { useConfirm } from '../../context/confirm';
import { useToast } from '../../context/toast';
import { getProfile } from '../../lib/auth';
import { BORROW_CATEGORIES, LendItem, fetchItems } from '../../lib/borrow';
import { waLink } from '../../lib/dishes';
import { IMAGE_CACHE_PROPS } from '../../lib/image';
import { fetchMyListings } from '../../lib/listings';
import { Ride, fetchRides, formatRideTime } from '../../lib/rides';
import { getService } from '../../lib/services';
import { DbProfile, ListingRow } from '../../lib/types';
import { useCached } from '../../lib/useCachedList';
import { useThemeColors } from '../../theme';

function openUrl(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

/**
 * A neighbour, as a page.
 *
 * This was a card with a Message button and a list of listings. A profile
 * is the answer to "who is this?": the face and the name, where they live,
 * how to reach them, and then what they have put into the society — things
 * to borrow, things for sale, seats in a car. The phone shows only when
 * they chose to be in the directory, the same rule Residents follows.
 */
export default function PublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { userId: meId, communityId } = useAuth();
  const { isBlocked } = useBlocks();
  const blocked = isBlocked(userId);
  const isMe = !!meId && meId === userId;
  const { open: openThread, busy: opening, canMessage } = useOpenThread(userId);

  const page = useCached(['profile', userId, meId], async () => {
    const [profile, listings, lending, rides] = await Promise.all([
      getProfile(userId!),
      fetchMyListings(userId!).then((l) => l.filter((x: ListingRow) => x.status === 'active')).catch(() => [] as ListingRow[]),
      fetchItems({ mine: userId!, kind: 'offer', publicOnly: true, viewerId: meId }, communityId).catch(() => [] as LendItem[]),
      fetchRides(communityId).then((r) => r.filter((x) => x.driver_user_id === userId && x.active)).catch(() => [] as Ride[]),
    ]);
    return { profile, listings, lending, rides };
  }, { enabled: !!userId });

  if (page.loading) return <DetailSkeleton hero={false} />;
  if (page.failed) {
    return (
      <View className="flex-1 bg-bg" style={{ paddingTop: insets.top + 60 }}>
        <ErrorState title="Couldn't load this profile" message="Try again in a moment." onRetry={page.refetch} retrying={page.fetching} />
      </View>
    );
  }
  const profile: DbProfile | null | undefined = page.data?.profile;
  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Text className="text-muted">Profile not found.</Text>
      </View>
    );
  }

  const name = profile.name ?? 'Neighbour';
  const first = name.split(' ')[0];
  const isAdmin = (profile.roles ?? []).includes('admin');
  const showPhone = profile.show_in_directory !== false && !!profile.phone;
  const flatLabel = profile.flat ? `Flat ${[profile.block, profile.flat].filter(Boolean).join('-')}` : null;
  const since = new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  const call = async () => {
    const d = (profile.phone ?? '').replace(/\D/g, '');
    if (!d) return;
    if (await confirm({ title: `Call ${first}?`, message: profile.phone ?? '', confirmLabel: 'Call' })) openUrl(`tel:${d}`);
  };
  const whatsapp = () => {
    const wa = profile.whatsapp ?? profile.phone;
    if (!wa) return toast.show('No WhatsApp on file');
    openUrl(waLink(wa, `Hi ${first}! 👋`));
  };

  const facts: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [
    flatLabel ? { icon: 'home-outline', label: 'Home', value: flatLabel } : null,
    profile.resident_type ? { icon: 'key-outline', label: 'Lives here as', value: profile.resident_type === 'owner' ? 'Owner' : 'Tenant' } : null,
    profile.profession ? { icon: 'briefcase-outline', label: 'Profession', value: profile.profession } : null,
    profile.vehicle_no ? { icon: 'car-outline', label: 'Vehicle', value: profile.vehicle_no } : null,
    profile.donor_available && profile.blood_group ? { icon: 'water-outline', label: 'Blood donor', value: profile.blood_group } : null,
    { icon: 'calendar-outline', label: 'On Aangan since', value: since },
  ].filter(Boolean) as { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[];

  const { listings, lending, rides } = page.data!;

  return (
    <View className="flex-1 bg-bg">
      {/* Header: back and the moderation menu; the name lives in the page. */}
      <View style={{ paddingTop: insets.top + 8 }} className="bg-bg px-4 pb-1">
        <View className="flex-row items-center justify-between">
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as any))} hitSlop={10} className="h-9 w-9 items-center justify-center rounded-full active:bg-inset">
            <Ionicons name="chevron-back" size={22} color={c.ink} />
          </Pressable>
          {userId && !isMe ? (
            <ModerationMenu targetType="profile" targetId={userId} targetOwnerId={userId} targetOwnerName={name} />
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Container narrow>
          {/* Who */}
          <View className="items-center px-6 pt-2">
            <Avatar name={name} size={104} userId={userId} />
            <Text className="mt-3 text-center font-display-x text-[26px] leading-[30px] text-ink">{name}</Text>
            <View className="mt-2 flex-row flex-wrap items-center justify-center gap-1.5">
              {flatLabel ? <Badge tone="accent" label={flatLabel} /> : null}
              {isAdmin ? <Badge tone="highlight" icon="shield-checkmark" label="Admin" /> : null}
              {profile.resident_type ? <Badge tone="neutral" label={profile.resident_type === 'owner' ? 'Owner' : 'Tenant'} /> : null}
            </View>
            {profile.profession ? <Text className="font-sans mt-2 text-[14px] text-muted">{profile.profession}</Text> : null}
          </View>

          {/* Reach them */}
          <View className="mx-4 mt-5">
            {isMe ? (
              <Button label="Edit profile" icon="create-outline" variant="outline" fullWidth onPress={() => router.push('/profile/me' as any)} />
            ) : blocked ? (
              <View className="items-center rounded-2xl border border-line bg-inset px-4 py-3">
                <Ionicons name="ban-outline" size={20} color={c.faint} />
                <Text className="mt-1 font-sans-sb text-[13px] text-muted">Blocked</Text>
                <Text className="font-sans mt-0.5 text-center text-[12px] text-faint">Unblock from Profile → Blocked members to see their content again.</Text>
              </View>
            ) : (
              <View className="flex-row gap-2">
                {canMessage ? (
                  <ContactAction icon="chatbubble-ellipses-outline" label={opening ? 'Opening…' : 'Message'} primary onPress={openThread} disabled={opening} c={c} />
                ) : null}
                {showPhone ? <ContactAction icon="call-outline" label="Call" onPress={call} c={c} /> : null}
                {showPhone ? <ContactAction icon="logo-whatsapp" label="WhatsApp" onPress={whatsapp} c={c} /> : null}
              </View>
            )}
            {!isMe && !showPhone && !blocked ? (
              <Text className="font-sans mt-2 text-center text-[12px] text-faint">{first} keeps their number private. Message them here instead.</Text>
            ) : null}
          </View>

          {/* About */}
          <View className="mx-4 mt-5 overflow-hidden card">
            {facts.map((f, i) => (
              <View key={f.label} className={`flex-row items-center gap-3 px-4 py-3 ${i ? 'border-t border-line' : ''}`}>
                <Ionicons name={f.icon} size={17} color={c.muted} />
                <Text className="font-sans flex-1 text-[13px] text-muted">{f.label}</Text>
                <Text className="font-sans-sb text-[14px] text-ink">{f.value}</Text>
              </View>
            ))}
          </View>

          {blocked ? null : (
            <>
              {lending.length > 0 ? (
                <Section title="Lends" count={lending.length} c={c}>
                  {lending.map((it) => {
                    const cat = BORROW_CATEGORIES.find((b) => b.key === it.category);
                    return (
                      <Row key={it.id} icon={(cat?.icon as any) ?? 'cube-outline'} title={it.title} subtitle={it.status === 'lent' ? 'Lent out right now' : cat?.label ?? 'Lending'} photo={it.photo_url} onPress={() => router.push(`/borrow/${it.id}` as any)} c={c} />
                    );
                  })}
                </Section>
              ) : null}

              {listings.length > 0 ? (
                <Section title="Listings" count={listings.length} c={c}>
                  {listings.map((l) => {
                    const cat = getService(l.category);
                    return (
                      <Row key={l.id} icon={(cat?.icon as any) ?? 'grid-outline'} title={l.is_referral ? l.referral_name ?? l.title : l.title} subtitle={[cat?.label ?? l.category, l.price != null ? `₹${l.price.toLocaleString('en-IN')}` : null].filter(Boolean).join(' · ')} photo={l.photos?.[0]} onPress={() => router.push(`/listing/${l.id}` as any)} c={c} />
                    );
                  })}
                </Section>
              ) : null}

              {rides.length > 0 ? (
                <Section title="Drives" count={rides.length} c={c}>
                  {rides.map((r) => (
                    <Row key={r.id} icon="car-outline" title={`${r.from_text} → ${r.to_text}`} subtitle={`${formatRideTime(r.depart_time)} · ${r.seats_total} seat${r.seats_total === 1 ? '' : 's'}${r.price_per_seat ? ` · ₹${r.price_per_seat}` : ''}`} onPress={() => router.push(`/rides/${r.id}` as any)} c={c} />
                  ))}
                </Section>
              ) : null}

              {lending.length + listings.length + rides.length === 0 ? (
                <Text className="font-sans mt-8 text-center text-[13px] text-faint">Nothing on offer from {first} right now.</Text>
              ) : null}
            </>
          )}
        </Container>
      </ScrollView>
    </View>
  );
}

function ContactAction({ icon, label, onPress, primary, disabled, c }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; primary?: boolean; disabled?: boolean; c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Touchable feel="card" haptic={null} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
      <View pointerEvents="none" className="flex-1 items-center rounded-2xl py-3" style={{ backgroundColor: primary ? c.accent : c.surface, borderWidth: primary ? 0 : 1, borderColor: c.line, opacity: disabled ? 0.7 : 1 }}>
      <Ionicons name={icon} size={20} color={primary ? c.onAccent : c.accent} />
      <Text className="mt-1 text-[12px] font-sans-sb" style={{ color: primary ? c.onAccent : c.ink }}>{label}</Text>
    
      </View>
    </Touchable>
  );
}

function Section({ title, count, children, c }: { title: string; count: number; children: React.ReactNode; c: ReturnType<typeof useThemeColors> }) {
  return (
    <View className="mx-4 mt-6">
      <Text className="mb-2 text-[11px] font-sans-sb uppercase tracking-wider text-muted">{title} · {count}</Text>
      <View className="overflow-hidden card">{children}</View>
    </View>
  );
}

function Row({ icon, title, subtitle, photo, onPress, c }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; photo?: string | null; onPress: () => void; c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Touchable feel="card" haptic={null} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      <View pointerEvents="none" className="flex-row items-center gap-3 border-b border-line px-3.5 py-3">
      <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-xl" style={{ backgroundColor: c.accentSoft }}>
        {photo ? <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" {...IMAGE_CACHE_PROPS} /> : <Ionicons name={icon} size={20} color={c.accent} />}
      </View>
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{title}</Text>
        <Text className="font-sans text-[12px] text-muted" numberOfLines={1}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.faint} />
    
      </View>
    </Touchable>
  );
}
