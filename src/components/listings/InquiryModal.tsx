import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { getService } from '../../lib/services';
import { ListingRow } from '../../lib/types';
import { useThemeColors } from '../../theme';
import { Avatar, Button, IconButton } from '../ui';

interface InquiryModalProps {
  listing: ListingRow | null;
  senderName: string;
  onClose: () => void;
  onConfirm: (listing: ListingRow, message: string) => void;
}

export function InquiryModal({ listing, senderName, onClose, onConfirm }: InquiryModalProps) {
  const c = useThemeColors();
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMessage('');
  }, [listing?.id]);

  if (!listing) return null;

  const cat = getService(listing.category);
  const photo = listing.photos[0];
  const ownerName = listing.is_referral
    ? listing.referral_name ?? listing.owner?.name ?? ''
    : listing.owner?.name ?? '';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1 justify-end"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable className="flex-1 bg-black/55" onPress={onClose} />
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full self-center rounded-t-[28px] bg-bg px-5 pb-9 pt-3"
          style={{ maxWidth: 560 }}
        >
          <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-line" />

          <View className="mb-3 flex-row items-start justify-between">
            <Text className="font-sans-sb text-[13px] uppercase tracking-wider text-accent">
              {cat?.ctaLabel ?? 'Contact'}
            </Text>
            <IconButton icon="close" onPress={onClose} />
          </View>

          {/* Listing summary card */}
          <View className="mb-4 flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3">
            <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-inset">
              {photo ? (
                <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <Ionicons name={(cat?.icon as any) ?? 'grid-outline'} size={24} color={cat?.color ?? c.muted} />
              )}
            </View>
            <View className="flex-1">
              <Text className="font-display text-[15px] text-ink" numberOfLines={1}>
                {listing.is_referral ? listing.referral_name ?? listing.title : listing.title}
              </Text>
              <View className="mt-1 flex-row items-center gap-1.5">
                <Avatar name={ownerName} size={16} />
                <Text className="text-[11px] text-muted">{ownerName}</Text>
              </View>
            </View>
            {listing.price != null && (
              <Text className="font-sans-bold text-[14px] text-accent">
                ₹{listing.price.toLocaleString('en-IN')}
              </Text>
            )}
          </View>

          {/* Message input */}
          <Text className="mb-1.5 font-sans-sb text-[13px] text-ink">
            Add a message <Text className="font-sans-md text-muted">(optional)</Text>
          </Text>
          <View
            className="mb-4 rounded-2xl border bg-surface px-4 py-3"
            style={{ borderColor: c.line }}
          >
            <TextInput
              placeholder="Describe your requirement, timing, quantity…"
              placeholderTextColor={c.faint}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={3}
              className="font-sans-md text-[14px] text-ink"
              style={{ minHeight: 72, textAlignVertical: 'top' }}
            />
          </View>

          <Button
            label={`${cat?.ctaLabel ?? 'Contact'} via WhatsApp`}
            icon="logo-whatsapp"
            variant="whatsapp"
            size="lg"
            fullWidth
            onPress={() => onConfirm(listing, message)}
          />
          <Text className="mt-2.5 text-center text-[11px] leading-4 text-faint">
            Opens WhatsApp and notifies {ownerName} on Aangan.
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
