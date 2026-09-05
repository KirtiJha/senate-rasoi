import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { getService } from '../../lib/services';
import { ListingRow } from '../../lib/types';
import { useThemeColors } from '../../theme';
import { Field } from '../forms';
import { Avatar, Button, Sheet } from '../ui';

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
    <Sheet
      visible
      onClose={onClose}
      title={cat?.ctaLabel ?? 'Contact'}
      maxWidth={560}
      footer={
        <View className="gap-2">
          <Button
            label={cat?.ctaLabel ?? 'Send'}
            icon="send"
            size="lg"
            fullWidth
            onPress={() => onConfirm(listing, message, 'app')}
          />
          {hasWhatsApp ? (
            <Button
              label="Open WhatsApp instead"
              icon="logo-whatsapp"
              variant="whatsapp"
              size="lg"
              fullWidth
              onPress={() => onConfirm(listing, message, 'whatsapp')}
            />
          ) : null}
          <Text className="font-sans text-center text-[11px] leading-4 text-faint">
            {hasWhatsApp
              ? `Either way ${ownerName} is notified on Aangan.`
              : `${ownerName} is notified on Aangan and can reply here.`}
          </Text>
        </View>
      }
    >
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

      <Field
        label="Add a message"
        hint={`Sent from ${senderName || 'you'}`}
        placeholder="Describe your requirement, timing, quantity…"
        value={message}
        onChangeText={setMessage}
        multiline
      />
    </Sheet>
  );
}
