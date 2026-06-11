import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Container, ScreenHeader, useResponsive } from '../components/ui';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import {
  ALL_EMERGENCY_ROLES, EMERGENCY_ROLE_COLORS, EMERGENCY_ROLE_ICONS, EMERGENCY_ROLE_LABELS,
  EmergencyContact, EmergencyRole,
  addEmergencyContact, deleteEmergencyContact, fetchEmergencyContacts,
} from '../lib/emergency';
import { isSupabaseConfigured } from '../lib/supabase';
import { useThemeColors } from '../theme';

export default function EmergencyScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const { communityId, isAdmin } = useAuth();
  const toast = useToast();

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !communityId) { setLoading(false); return; }
    try {
      setContacts(await fetchEmergencyContacts(communityId));
    } catch { toast.show('Could not load contacts'); }
    finally { setLoading(false); }
  }, [communityId, toast]);

  useEffect(() => { load(); }, [load]);

  const handleCall = (phone: string) => {
    const url = `tel:${phone.replace(/\s/g, '')}`;
    if (Platform.OS === 'web') window.open(url);
    else Linking.openURL(url);
  };

  const handleDelete = (contact: EmergencyContact) => {
    const doDelete = async () => {
      try {
        await deleteEmergencyContact(contact.id);
        setContacts((prev: EmergencyContact[]) => prev.filter((c: EmergencyContact) => c.id !== contact.id));
        toast.show('Contact removed');
      } catch { toast.show('Could not remove contact'); }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove "${contact.name}"?`)) doDelete();
    } else {
      Alert.alert('Remove contact', `Remove "${contact.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="call-outline"
        iconColor="#EF4444"
        title="Emergency Contacts"
        showBack
        onAdd={isAdmin ? () => setShowAdd(true) : undefined}
        addLabel="Add contact"
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Container>
          {loading ? (
            <View className="gap-3">
              {[1, 2, 3].map((i) => (
                <View key={i} className="h-20 rounded-2xl bg-surface" />
              ))}
            </View>
          ) : contacts.length === 0 ? (
            <View className="items-center py-20">
              <Ionicons name="call-outline" size={44} color={c.faint} />
              <Text className="mt-3 font-display text-xl text-ink">No contacts yet</Text>
              <Text className="mt-1 text-center text-[14px] text-muted max-w-xs">
                {isAdmin
                  ? 'Add important numbers like security, maintenance, and emergency services.'
                  : 'The society admin will add emergency contacts here.'}
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {contacts.map((contact: EmergencyContact) => {
                const color = EMERGENCY_ROLE_COLORS[contact.role];
                const icon = EMERGENCY_ROLE_ICONS[contact.role];
                return (
                  <View key={contact.id} className="rounded-2xl border border-line bg-surface overflow-hidden">
                    <View style={{ height: 3, backgroundColor: color }} />
                    <View className="flex-row items-center gap-3 p-4">
                      <View
                        className="h-11 w-11 items-center justify-center rounded-2xl"
                        style={{ backgroundColor: color + '18' }}
                      >
                        <Ionicons name={icon as any} size={22} color={color} />
                      </View>
                      <View className="flex-1">
                        <Text className="font-sans-sb text-[15px] text-ink">{contact.name}</Text>
                        <Text className="text-[12px] text-muted">{contact.category || EMERGENCY_ROLE_LABELS[contact.role]}</Text>
                        <Text className="text-[13px] font-sans-md text-faint mt-0.5">{contact.phone}</Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Pressable
                          onPress={() => handleCall(contact.phone)}
                          className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
                          style={{ backgroundColor: color + '18' }}
                        >
                          <Ionicons name="call" size={18} color={color} />
                        </Pressable>
                        {isAdmin ? (
                          <Pressable
                            onPress={() => handleDelete(contact)}
                            className="h-10 w-10 items-center justify-center rounded-full active:bg-inset"
                          >
                            <Ionicons name="trash-outline" size={16} color={c.faint} />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Container>
      </ScrollView>

      {isAdmin ? (
        <AddContactModal
          visible={showAdd}
          communityId={communityId ?? ''}
          onClose={() => setShowAdd(false)}
          onAdded={(contact: EmergencyContact) => {
            setContacts((prev: EmergencyContact[]) => [...prev, contact].sort((a: EmergencyContact, b: EmergencyContact) => a.order_pos - b.order_pos));
            setShowAdd(false);
            toast.show('Contact added');
          }}
          c={c}
        />
      ) : null}
    </View>
  );
}

function AddContactModal({
  visible, communityId, onClose, onAdded, c,
}: {
  visible: boolean;
  communityId: string;
  onClose: () => void;
  onAdded: (contact: EmergencyContact) => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<EmergencyRole>('security');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    if (!phone.trim()) return;
    setSaving(true);
    try {
      const contact = await addEmergencyContact({ communityId, name, phone, role, category: category || null });
      onAdded(contact);
      setName(''); setPhone(''); setRole('security'); setCategory('');
    } catch {
      // parent handles toast
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-bg" style={{ paddingBottom: insets.bottom + 16 }}>
        <View className="border-b border-line px-4 py-4 flex-row items-center justify-between">
          <Text className="font-sans-sb text-[16px] text-ink">Add Emergency Contact</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={c.muted} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <View className="mb-3.5">
            <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Security guard, Maintenance…"
              placeholderTextColor={c.faint}
              className="rounded-2xl border border-line bg-inset px-3.5 py-3 text-[15px] text-ink"
              style={{ outline: 'none' } as any}
            />
          </View>

          <View className="mb-3.5">
            <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Phone number</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="98765 43210"
              keyboardType="phone-pad"
              placeholderTextColor={c.faint}
              className="rounded-2xl border border-line bg-inset px-3.5 py-3 text-[15px] text-ink"
              style={{ outline: 'none' } as any}
            />
          </View>

          <View className="mb-3.5">
            <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Service / label (optional)</Text>
            <TextInput
              value={category}
              onChangeText={setCategory}
              placeholder="e.g. Plumber, Electrician, Water tanker"
              placeholderTextColor={c.faint}
              className="rounded-2xl border border-line bg-inset px-3.5 py-3 text-[15px] text-ink"
              style={{ outline: 'none' } as any}
            />
          </View>

          <View className="mb-5">
            <Text className="mb-2 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Type</Text>
            <View className="flex-row flex-wrap" style={{ marginHorizontal: -3 }}>
              {ALL_EMERGENCY_ROLES.map((r: EmergencyRole) => (
                <View key={r} style={{ padding: 3 }}>
                  <Pressable
                    onPress={() => setRole(r)}
                    className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${role === r ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}
                  >
                    <Ionicons name={EMERGENCY_ROLE_ICONS[r] as any} size={12} color={role === r ? c.accent : c.faint} />
                    <Text className={`text-[12px] ${role === r ? 'font-sans-sb text-accent' : 'font-sans-md text-muted'}`}>
                      {EMERGENCY_ROLE_LABELS[r]}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>

          <Pressable
            onPress={save}
            disabled={saving || !name.trim() || !phone.trim()}
            className={`items-center rounded-2xl py-3.5 ${saving || !name.trim() || !phone.trim() ? 'bg-inset' : 'bg-accent active:bg-accent-press'}`}
          >
            <Text className={`font-sans-sb text-[15px] ${saving || !name.trim() || !phone.trim() ? 'text-faint' : 'text-on-accent'}`}>
              {saving ? 'Saving…' : 'Add Contact'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
