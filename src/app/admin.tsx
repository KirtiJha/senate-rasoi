import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Container, ScreenHeader } from '../components/ui';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { deleteMember, listCommunityMembers, setMemberBlocked, setUserRoles } from '../lib/admin';
import { getOrCreateThread } from '../lib/dm';
import { supabase } from '../lib/supabase';
import { DbProfile } from '../lib/types';
import { useThemeColors } from '../theme';

type AdminTab = 'members' | 'requests';

interface JoinRequest {
  id: string;
  society_name: string;
  society_address: string;
  requester_name: string;
  requester_phone: string;
  requester_email: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
}

export default function AdminScreen() {
  const router = useRouter();
  const toast = useToast();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { ready, isAdmin, userId, communityId, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('members');

  // Members state
  const [members, setMembers] = useState<DbProfile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Join requests state
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!communityId) return;
    try {
      setMembers(await listCommunityMembers(communityId));
    } catch (e) {
      console.error(e);
      toast.show('Could not load members');
    }
  }, [communityId, toast]);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const { data, error } = await supabase
        .from('society_join_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRequests((data ?? []) as JoinRequest[]);
    } catch {
      toast.show('Could not load requests');
    } finally {
      setRequestsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isAdmin) {
      loadMembers();
      loadRequests();
    }
  }, [isAdmin, loadMembers, loadRequests]);

  if (ready && !isAdmin) return <Redirect href="/" />;

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'members') await loadMembers();
    else await loadRequests();
    setRefreshing(false);
  };

  const confirm = (title: string, message: string, onYes: () => void, destructive = false) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) onYes();
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: destructive ? 'destructive' : 'default', onPress: onYes },
      ]);
    }
  };

  const startChat = async (m: DbProfile) => {
    try {
      const threadId = await getOrCreateThread(m.id);
      router.push(`/messages/${threadId}` as any);
    } catch { toast.show('Could not start chat'); }
  };

  const toggleAdmin = async (m: DbProfile) => {
    const next = m.roles.includes('admin') ? m.roles.filter((r) => r !== 'admin') : [...m.roles, 'admin' as const];
    setBusy(m.id);
    try {
      const ok = await setUserRoles(m.id, next as DbProfile['roles']);
      if (!ok) { toast.show('Not allowed'); return; }
      setMembers((cur) => cur.map((x) => (x.id === m.id ? { ...x, roles: next as DbProfile['roles'] } : x)));
      if (m.id === userId) await refreshProfile();
    } catch { toast.show('Could not update'); }
    finally { setBusy(null); }
  };

  const toggleBlock = (m: DbProfile) => {
    const blocking = !m.blocked;
    confirm(
      blocking ? `Block ${m.name || 'this member'}?` : `Unblock ${m.name || 'this member'}?`,
      blocking
        ? "They'll be signed out and can't access the app until you unblock them."
        : 'They will be able to sign in and use the app again.',
      async () => {
        setBusy(m.id);
        try {
          const ok = await setMemberBlocked(m.id, blocking);
          if (!ok) { toast.show('Not allowed'); return; }
          setMembers((cur) => cur.map((x) => (x.id === m.id ? { ...x, blocked: blocking } : x)));
          toast.show(blocking ? 'Member blocked' : 'Member unblocked');
        } catch { toast.show('Could not update'); }
        finally { setBusy(null); }
      },
      blocking,
    );
  };

  const removeMember = (m: DbProfile) => {
    confirm(
      `Delete ${m.name || 'this member'}?`,
      'This permanently removes their account and all their content. This cannot be undone.',
      async () => {
        setBusy(m.id);
        try {
          const ok = await deleteMember(m.id);
          if (!ok) { toast.show('Not allowed'); return; }
          setMembers((cur) => cur.filter((x) => x.id !== m.id));
          toast.show('Member deleted');
        } catch { toast.show('Could not delete'); }
        finally { setBusy(null); }
      },
      true,
    );
  };

  const updateRequestStatus = async (id: string, status: 'approved' | 'rejected', note?: string) => {
    try {
      const { error } = await supabase
        .from('society_join_requests')
        .update({ status, admin_note: note ?? null })
        .eq('id', id);
      if (error) throw error;
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      toast.show(status === 'approved' ? 'Request approved' : 'Request rejected');
    } catch {
      toast.show('Could not update request');
    }
  };

  const stats = useMemo(() => ({
    total: members.length,
    admins: members.filter((m) => m.roles.includes('admin')).length,
    blocked: members.filter((m) => m.blocked).length,
  }), [members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name?.toLowerCase().includes(q) || m.phone?.includes(q) || m.flat?.toLowerCase().includes(q),
    );
  }, [members, query]);

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader icon="shield-checkmark-outline" title="Admin" showBack />
      <View className="border-b border-line bg-bg px-4 pb-3 pt-3">
        <Container narrow>
          {/* Stats row */}
          <View className="flex-row gap-2 mb-3">
            {[
              { label: 'Members', value: stats.total, icon: 'people-outline' as const },
              { label: 'Admins', value: stats.admins, icon: 'shield-checkmark-outline' as const },
              { label: 'Blocked', value: stats.blocked, icon: 'ban-outline' as const },
            ].map((s) => (
              <View key={s.label} className="flex-1 items-center rounded-2xl bg-inset py-2.5 px-1">
                <Ionicons name={s.icon} size={15} color={c.muted} />
                <Text className="font-sans-bold text-[16px] text-ink mt-0.5">{s.value}</Text>
                <Text className="text-[10px] text-faint">{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Tab switcher */}
          <View className="flex-row rounded-2xl bg-inset p-1">
            <Pressable
              onPress={() => setActiveTab('members')}
              className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2 ${activeTab === 'members' ? 'bg-surface' : ''}`}
            >
              <Ionicons name="people-outline" size={15} color={activeTab === 'members' ? c.accent : c.muted} />
              <Text className={`text-[13px] ${activeTab === 'members' ? 'font-sans-sb text-ink' : 'font-sans-md text-muted'}`}>Members</Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('requests')}
              className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2 ${activeTab === 'requests' ? 'bg-surface' : ''}`}
            >
              <Ionicons name="mail-open-outline" size={15} color={activeTab === 'requests' ? c.accent : c.muted} />
              <Text className={`text-[13px] ${activeTab === 'requests' ? 'font-sans-sb text-ink' : 'font-sans-md text-muted'}`}>
                Requests{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </Text>
            </Pressable>
          </View>
        </Container>
      </View>

      {activeTab === 'members' ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Container narrow>
            {/* Search */}
            <View className="mb-4 flex-row items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5">
              <Ionicons name="search-outline" size={16} color={c.faint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name, phone or flat…"
                placeholderTextColor={c.faint}
                className="flex-1 font-sans text-[14px] text-ink"
                style={{ outline: 'none' } as any}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={c.faint} />
                </Pressable>
              ) : null}
            </View>

            {filtered.length === 0 && query.length > 0 ? (
              <View className="items-center py-10">
                <Text className="text-[14px] text-muted">No members match "{query}"</Text>
              </View>
            ) : null}

            {filtered.map((m) => {
              const self = m.id === userId;
              const memberAdmin = m.roles.includes('admin');
              return (
                <View key={m.id} className="mb-3 rounded-3xl border border-line bg-surface p-4">
                  <View className="flex-row items-center gap-3">
                    <Avatar name={m.name} size={44} />
                    <View className="flex-1">
                      <View className="flex-row items-center gap-1.5 flex-wrap">
                        <Text className="font-sans-sb text-[15px] text-ink" numberOfLines={1}>{m.name || 'Unnamed'}</Text>
                        {self ? <Badge label="you" color={c.accent} /> : null}
                        {memberAdmin ? <Badge label="admin" color={c.accent} /> : null}
                        {m.blocked ? <Badge label="blocked" color="#EF4444" /> : null}
                      </View>
                      <Text className="text-[12px] text-muted">
                        {m.phone ?? '—'}{m.flat ? ` · Flat ${m.flat}` : ''}
                      </Text>
                    </View>
                  </View>

                  {!self ? (
                    <View className="mt-3 flex-row flex-wrap gap-2">
                      <ActionBtn icon="chatbubble-outline" label="Message" onPress={() => startChat(m)} c={c} />
                      <ActionBtn
                        icon={memberAdmin ? 'shield-checkmark' : 'shield-outline'}
                        label={memberAdmin ? 'Remove admin' : 'Make admin'}
                        active={memberAdmin}
                        disabled={busy === m.id}
                        onPress={() => toggleAdmin(m)}
                        c={c}
                      />
                      <ActionBtn
                        icon={m.blocked ? 'lock-open-outline' : 'ban-outline'}
                        label={m.blocked ? 'Unblock' : 'Block'}
                        danger={!m.blocked}
                        disabled={busy === m.id}
                        onPress={() => toggleBlock(m)}
                        c={c}
                      />
                      <ActionBtn icon="trash-outline" label="Delete" danger disabled={busy === m.id} onPress={() => removeMember(m)} c={c} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Container>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={requestsLoading} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          <Container narrow>
            {requests.length === 0 ? (
              <View className="items-center py-16">
                <Ionicons name="mail-open-outline" size={40} color={c.faint} />
                <Text className="mt-3 font-sans-sb text-[15px] text-ink">No join requests</Text>
                <Text className="mt-1 text-[13px] text-muted">Society join requests appear here</Text>
              </View>
            ) : null}
            {requests.map((req) => (
              <JoinRequestCard key={req.id} req={req} onUpdate={updateRequestStatus} c={c} />
            ))}
          </Container>
        </ScrollView>
      )}
    </View>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: color + '20' }}>
      <Text className="text-[10px] font-sans-sb uppercase" style={{ color }}>{label}</Text>
    </View>
  );
}

function ActionBtn({
  icon, label, onPress, c, active, danger, disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  c: ReturnType<typeof useThemeColors>;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const color = danger ? '#EF4444' : active ? c.accent : c.muted;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center gap-1.5 rounded-xl border px-2.5 py-2 ${disabled ? 'opacity-50' : ''}`}
      style={{ borderColor: (danger || active) ? color + '60' : c.line, backgroundColor: (danger || active) ? color + '12' : c.inset }}
    >
      <Ionicons name={icon} size={14} color={color} />
      <Text className="text-[12px] font-sans-sb" style={{ color }}>{label}</Text>
    </Pressable>
  );
}

function JoinRequestCard({
  req, onUpdate, c,
}: {
  req: JoinRequest;
  onUpdate: (id: string, status: 'approved' | 'rejected', note?: string) => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  const statusColor = req.status === 'pending' ? '#F59E0B' : req.status === 'approved' ? '#10B981' : '#EF4444';
  const statusLabel = req.status === 'pending' ? 'Pending' : req.status === 'approved' ? 'Approved' : 'Rejected';

  return (
    <View className="mb-3 rounded-3xl border border-line bg-surface p-4">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-sans-sb text-[15px] text-ink flex-1 mr-2" numberOfLines={1}>{req.society_name}</Text>
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: statusColor + '20' }}>
          <Text className="text-[11px] font-sans-sb" style={{ color: statusColor }}>{statusLabel}</Text>
        </View>
      </View>

      <Text className="text-[12px] text-muted mb-1">{req.society_address}</Text>

      <View className="mt-2 rounded-2xl bg-inset p-3">
        <Text className="text-[11px] font-sans-sb text-faint mb-1">REQUESTER</Text>
        <Text className="text-[13px] font-sans-md text-ink">{req.requester_name}</Text>
        <Text className="text-[12px] text-muted">{req.requester_phone}</Text>
        {req.requester_email ? <Text className="text-[12px] text-muted">{req.requester_email}</Text> : null}
      </View>

      <Text className="mt-2 text-[11px] text-faint">
        {new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
      </Text>

      {req.status === 'pending' ? (
        <View className="mt-3 flex-row gap-2">
          <Pressable onPress={() => onUpdate(req.id, 'rejected')} className="flex-1 items-center rounded-xl border border-red-200 bg-red-50 py-2.5">
            <Text className="text-[13px] font-sans-sb text-red-600">Reject</Text>
          </Pressable>
          <Pressable onPress={() => onUpdate(req.id, 'approved')} className="flex-1 items-center rounded-xl bg-accent py-2.5">
            <Text className="text-[13px] font-sans-sb text-on-accent">Approve</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
