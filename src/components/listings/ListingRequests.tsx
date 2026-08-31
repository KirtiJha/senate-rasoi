import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Text, View } from 'react-native';

import { useAuth } from '../../context/auth';
import { getService } from '../../lib/services';
import { fetchListingInquiries, fetchMyInquiries } from '../../lib/inquiries';
import { waLink } from '../../lib/listings';
import { InquiryRow } from '../../lib/types';
import { useThemeColors } from '../../theme';
import { Avatar, Touchable } from '../ui';
import { MessageNeighbour } from '../MessageNeighbour';

// Matches how every other screen here opens an external link.
function openUrl(u: string) {
  if (Platform.OS === 'web') window.open(u, '_blank');
  else Linking.openURL(u);
}

/**
 * Who has asked, and what they said.
 *
 * WHY THIS EXISTS. Asking to join a carpool wrote a row nothing ever read.
 * `fetchListingInquiries` and `fetchMyInquiries` had both been written and
 * neither was called from anywhere in the app, so the owner saw a bare count
 * on their own listing card with no way to open it, and the person who asked
 * saw nothing at all — not even confirmation that their message had been sent.
 * The message they typed was stored and unreachable.
 *
 * Two audiences, one component, because they are the same list seen from
 * either end: the owner sees everyone who asked, and an enquirer sees their
 * own request sitting there.
 */
export function ListingRequests({
  listingId,
  category,
  isOwner,
  listingTitle,
}: {
  listingId: string;
  category: string;
  isOwner: boolean;
  listingTitle: string;
}) {
  const c = useThemeColors();
  const { userId } = useAuth();

  const [rows, setRows] = useState<InquiryRow[] | null>(null);

  const load = useCallback(async () => {
    if (!userId) { setRows([]); return; }
    try {
      if (isOwner) {
        setRows(await fetchListingInquiries(listingId));
      } else {
        // Only this listing's, out of everything they have ever asked about.
        const mine = await fetchMyInquiries(userId);
        setRows(mine.filter((r) => r.listing_id === listingId));
      }
    } catch {
      setRows([]);
    }
  }, [listingId, isOwner, userId]);

  useEffect(() => { load(); }, [load]);

  if (rows === null) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }
  if (rows.length === 0) return null;

  const cat = getService(category);
  // "Requests to join" for a carpool, "Enquiries" for a tailor — the noun the
  // category already uses for its own action.
  const noun = cat?.ctaLabel ? `${cat.ctaLabel} requests` : 'Requests';

  return (
    <View className="mt-5">
      <Text className="mb-2 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
        {isOwner ? `${noun} · ${rows.length}` : 'Your request'}
      </Text>

      {rows.map((r) => (
        <View key={r.id} className="mb-2 card p-3.5">
          <View className="flex-row items-start gap-2.5">
            {isOwner ? <Avatar name={r.from_user?.name ?? '?'} size={34} /> : null}

            <View style={{ flex: 1 }}>
              {isOwner ? (
                <Text className="font-sans-sb text-[14px] text-ink">
                  {r.from_user?.name ?? 'A neighbour'}
                  {r.from_user?.flat ? (
                    <Text className="font-sans text-faint"> · {r.from_user.flat}</Text>
                  ) : null}
                </Text>
              ) : (
                <Text className="font-sans-sb text-[13.5px]" style={{ color: c.accent }}>
                  Sent — the owner has been notified
                </Text>
              )}

              {r.message ? (
                <Text className="font-sans mt-1 text-[13.5px] leading-[20px] text-ink">
                  {r.message}
                </Text>
              ) : (
                <Text className="font-sans mt-1 text-[13px]" style={{ color: c.faint }}>
                  {isOwner ? 'No message — just interested.' : 'You did not add a message.'}
                </Text>
              )}
            </View>
          </View>

          {/* The owner needs a way to answer, and it must not be WhatsApp-only:
              the enquirer is a neighbour with an account by definition — they
              had to be signed in to ask. */}
          {isOwner ? (
            <View className="mt-3 gap-2">
              <MessageNeighbour
                userId={r.from_user_id}
                label="Reply"
                variant="outline"
              />
              {r.from_user?.whatsapp ? (
                <Touchable
                  onPress={() =>
                    openUrl(waLink(
                      r.from_user!.whatsapp,
                      `Hi ${r.from_user?.name ?? ''}, about "${listingTitle}" on Aangan…`,
                    ))
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Reply on WhatsApp"
                >
                  <View pointerEvents="none" className="flex-row items-center justify-center gap-1.5 rounded-xl py-2.5"
                    style={{ backgroundColor: '#25D36618' }}>
                    <Ionicons name="logo-whatsapp" size={15} color="#128C7E" />
                    <Text className="font-sans-sb text-[13px]" style={{ color: '#128C7E' }}>
                      Reply on WhatsApp
                    </Text>
                  </View>
                </Touchable>
              ) : null}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
