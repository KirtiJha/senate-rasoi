import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ui';
import { CreateListingForm } from '../../components/listings/CreateListingForm';
import { useAuth } from '../../context/auth';
import { fetchListingById } from '../../lib/listings';
import { getService } from '../../lib/services';
import type { ListingRow } from '../../lib/types';
import { useThemeColors } from '../../theme';

export default function EditListingScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, isAdmin } = useAuth();
  const [listing, setListing] = useState<ListingRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    fetchListingById(id).then(setListing).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const cat = listing ? getService(listing.category) : null;
  const canEdit = !!listing && (listing.owner_user_id === userId || isAdmin);

  if (loading) {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader icon="create-outline" iconColor={c.accent} title="Edit listing" showBack hideSociety />
        <View className="flex-1 items-center justify-center"><ActivityIndicator color={c.muted} /></View>
      </View>
    );
  }

  if (!listing || !cat || !canEdit) {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader icon="create-outline" iconColor={c.accent} title="Edit listing" showBack hideSociety />
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="lock-closed-outline" size={44} color={c.faint} />
          <Text className="mt-3 text-center font-sans-bold text-[16px] text-ink">Can't edit this</Text>
          <Text className="mt-1.5 text-center text-[13px] text-muted">{!listing ? 'Listing not found.' : "You can only edit your own listings."}</Text>
          <Pressable onPress={() => router.back()} className="mt-5 rounded-xl border border-line bg-surface px-5 py-2.5 active:bg-inset">
            <Text className="font-sans-sb text-[14px] text-ink">Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return <CreateListingForm cat={cat} existing={listing} onBack={() => router.back()} />;
}
