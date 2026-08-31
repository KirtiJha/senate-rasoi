import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { getService } from '../../lib/services';
import { ListingRow } from '../../lib/types';
import { useThemeColors } from '../../theme';
import { Avatar, Button, IconButton, useKeyboardInset } from '../ui';

/**
 * WHATSAPP IS A WAY TO REACH SOMEBODY, NOT THE ONLY ONE.
 *
 * This sheet used to end in a single green button. That made WhatsApp
 * compulsory for every one of the fifteen listing categories — you could not
 * join a carpool, ask about a tuition or answer a lost-and-found post without
 * leaving the app, and a resident who does not use WhatsApp, or whose
 * neighbour never added a number, simply had no way through at all.
 *
 * The in-app path already existed and was never offered: an inquiry row
 * notifies the owner on its own. So sending in Aangan is the primary action
 * and always works, and WhatsApp is an extra that appears only when there is
 * actually a number to open it with.
 */
interface InquiryModalProps {
  listing: ListingRow | null;
  senderName: string;
  onClose: () => void;
  onConfirm: (listing: ListingRow, message: string, via: 'app' | 'whatsapp') => void;
}

export function InquiryModal({ listing, senderName, onClose, onConfirm }: InquiryModalProps) {
  const c = useThemeColors();
  const [message, setMessage] = useState('');
  // Inside an RN Modal — Reanimated's keyboard hook reports nothing there.
  const kb = useKeyboardInset();

  useEffect(() => {
    setMessage('');
  }, [listing?.id]);

  if (!listing) return null;

  const cat = getService(listing.category);
  const photo = listing.photos[0];
  // Same resolution the link builder uses, so the button never appears
  // pointing at a number that does not exist.
  const hasWhatsApp = !!(
    listing.is_referral
      ? listing.referral_phone
      : listing.contact_whatsapp ?? listing.owner?.whatsapp
  );
  const ownerName = listing.is_referral
    ? listing.referral_name ?? listing.owner?.name ?? ''
    : listing.owner?.name ?? '';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ paddingBottom: kb }}>
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
            <IconButton icon="close" label="Close" onPress={onClose} />
          </View>

          {/* Listing summary card */}
          <View className="mb-4 flex-row items-center gap-3 card p-3">
            <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-inset">
              {photo ? (
                <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <Ionicons name={(cat?.icon as any) ?? 'grid-outline'} size={24} color={c.accent} />
              )}
            </View>
            <View className="flex-1">
              <Text className="font-display text-[15px] text-ink" numberOfLines={1}>
                {listing.is_referral ? listing.referral_name ?? listing.title : listing.title}
              </Text>
              <View className="mt-1 flex-row items-center gap-1.5">
                <Avatar name={ownerName} size={16} />
                <Text className="font-sans text-[11px] text-muted">{ownerName}</Text>
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
            label={cat?.ctaLabel ?? 'Send'}
            icon="send"
            size="lg"
            fullWidth
            onPress={() => onConfirm(listing, message, 'app')}
          />

          {hasWhatsApp ? (
            <View className="mt-2">
              <Button
                label="Open WhatsApp instead"
                icon="logo-whatsapp"
                variant="whatsapp"
                size="lg"
                fullWidth
                onPress={() => onConfirm(listing, message, 'whatsapp')}
              />
            </View>
          ) : null}

          <Text className="font-sans mt-2.5 text-center text-[11px] leading-4 text-faint">
            {hasWhatsApp
              ? `Either way ${ownerName} is notified on Aangan.`
              : `${ownerName} is notified on Aangan and can reply here.`}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}
