import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Avatar, Button, Container, RowSkeleton, ScreenHeader, Sheet } from '../components/ui';
import { useAuth } from '../context/auth';
import { useConfirm } from '../context/confirm';
import { useToast } from '../context/toast';
import { fetchDirectory } from '../lib/directory';
import {
  DocRow, ShareUser, deleteDocument, fetchDocuments, fetchShares, fileGlyph, formatBytes,
  getDocumentUrl, setDocPublic, shareDocument, unshareDocument, uploadDocument,
} from '../lib/documents';
import { MAX_DOCUMENT_MB, isSupabaseConfigured } from '../lib/supabase';
import { useThemeColors } from '../theme';
import { layout } from '../theme';

type Filter = 'all' | 'mine' | 'shared' | 'public';

function openUrl(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

export default function DocumentsScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const { userId, communityId } = useAuth();

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [showUpload, setShowUpload] = useState(false);
  const [manage, setManage] = useState<DocRow | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !communityId) { setLoading(false); return; }
    try { setDocs(await fetchDocuments(communityId)); }
    catch { toast.show('Could not load documents'); }
    finally { setLoading(false); }
  }, [communityId, toast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => docs.filter((d) => {
    if (filter === 'mine') return d.owner_id === userId;
    if (filter === 'public') return d.is_public;
    if (filter === 'shared') return !d.is_public && d.owner_id !== userId;
    return true;
  }), [docs, filter, userId]);

  const preview = async (d: DocRow) => { try { openUrl(await getDocumentUrl(d.storage_path)); } catch { toast.show('Could not open file'); } };
  const download = async (d: DocRow) => { try { openUrl(await getDocumentUrl(d.storage_path, d.name)); } catch { toast.show('Could not download'); } };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'public', label: 'Public' },
    { key: 'shared', label: 'Shared with me' },
    { key: 'mine', label: 'My uploads' },
  ];

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        icon="folder-outline"
        iconColor="#0EA5E9"
        title="Documents"
        showBack
        onAdd={() => setShowUpload(true)}
        addLabel="Upload document"
        subBar={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4" contentContainerStyle={{ gap: 6 }}>
            {FILTERS.map((f) => (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} className={`rounded-full px-3.5 py-1.5 ${filter === f.key ? 'bg-accent' : 'bg-inset'}`}>
                <Text className={`text-[12px] font-sans-sb ${filter === f.key ? 'text-on-accent' : 'text-muted'}`}>{f.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <View className="w-full self-center" style={{ maxWidth: layout.maxContent }}>
          {loading ? (
            <View className="overflow-hidden rounded-2xl border border-line bg-surface"><RowSkeleton count={6} /></View>
          ) : filtered.length === 0 ? (
            <View className="items-center py-16">
              <Ionicons name="folder-open-outline" size={42} color={c.faint} />
              <Text className="mt-3 font-display text-xl text-ink mb-1">No documents yet</Text>
              <Text className="text-[14px] text-muted text-center max-w-xs">
                {filter === 'all' ? 'Upload society notices, bylaws, forms and more — keep them public or share privately.' : 'Nothing here. Try another filter.'}
              </Text>
            </View>
          ) : (
            <View className="overflow-hidden rounded-2xl border border-line bg-surface">
              {filtered.map((d, i) => (
                <DocRowView
                  key={d.id}
                  doc={d}
                  first={i === 0}
                  isOwner={d.owner_id === userId}
                  c={c}
                  onPreview={() => preview(d)}
                  onDownload={() => download(d)}
                  onManage={() => setManage(d)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <UploadSheet
        visible={showUpload}
        onClose={() => setShowUpload(false)}
        c={c}
        onUpload={async (form) => {
          if (!communityId || !userId) return;
          try {
            await uploadDocument({ communityId, ownerId: userId, ...form });
            setShowUpload(false);
            toast.show('Document uploaded ✅');
            await load();
          } catch { toast.show('Upload failed — try again'); }
        }}
      />

      <ManageSheet
        doc={manage}
        onClose={() => setManage(null)}
        communityId={communityId}
        userId={userId}
        c={c}
        onChanged={load}
        toastShow={toast.show}
      />
    </View>
  );
}

function DocRowView({
  doc, first, isOwner, c, onPreview, onDownload, onManage,
}: {
  doc: DocRow; first: boolean; isOwner: boolean; c: ReturnType<typeof useThemeColors>;
  onPreview: () => void; onDownload: () => void; onManage: () => void;
}) {
  const g = fileGlyph(doc.mime_type);
  const meta = [doc.owner?.name ?? 'Someone', formatBytes(doc.file_size)].filter(Boolean).join(' · ');
  return (
    <View className={`flex-row items-center gap-3 px-3.5 py-3 ${first ? '' : 'border-t border-line'}`}>
      <View className="h-10 w-10 items-center justify-center rounded-xl flex-shrink-0" style={{ backgroundColor: g.color + '20' }}>
        <Ionicons name={g.icon as any} size={20} color={g.color} />
      </View>
      <Pressable onPress={onPreview} className="flex-1 active:opacity-70" style={{ minWidth: 0 }}>
        <View className="flex-row items-center gap-1.5">
          <Text className="font-sans-bold text-[14px] text-ink" numberOfLines={1}>{doc.name}</Text>
          <View className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: doc.is_public ? '#16A34A20' : c.inset }}>
            <Text className="text-[9px] font-sans-sb uppercase" style={{ color: doc.is_public ? '#16A34A' : c.muted }}>{doc.is_public ? 'Public' : 'Private'}</Text>
          </View>
        </View>
        <Text className="text-[12px] text-muted" numberOfLines={1}>{meta}</Text>
      </Pressable>
      <View className="flex-row items-center gap-1">
        <IconBtn icon="eye-outline" onPress={onPreview} c={c} />
        <IconBtn icon="download-outline" onPress={onDownload} c={c} />
        {isOwner ? <IconBtn icon="ellipsis-horizontal" onPress={onManage} c={c} /> : null}
      </View>
    </View>
  );
}

function IconBtn({ icon, onPress, c }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; c: ReturnType<typeof useThemeColors> }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} className="h-9 w-9 items-center justify-center rounded-full bg-inset active:opacity-70">
      <Ionicons name={icon} size={16} color={c.muted} />
    </Pressable>
  );
}

function PublicToggle({ value, onToggle, c }: { value: boolean; onToggle: () => void; c: ReturnType<typeof useThemeColors> }) {
  return (
    <Pressable onPress={onToggle} className="flex-row items-center gap-3 rounded-2xl border border-line bg-inset px-4 py-3">
      <Ionicons name={value ? 'globe-outline' : 'lock-closed-outline'} size={18} color={value ? '#16A34A' : c.muted} />
      <View className="flex-1">
        <Text className="font-sans-sb text-[14px] text-ink">{value ? 'Public' : 'Private'}</Text>
        <Text className="text-[12px] text-muted">{value ? 'Any society member can access' : 'Only people you share with can access'}</Text>
      </View>
      <View className={`h-6 w-10 rounded-full p-0.5 ${value ? 'bg-success' : 'bg-line'}`}>
        <View className={`h-5 w-5 rounded-full bg-white ${value ? 'self-end' : 'self-start'}`} />
      </View>
    </Pressable>
  );
}

function UploadSheet({
  visible, onClose, onUpload, c,
}: {
  visible: boolean; onClose: () => void;
  onUpload: (form: { name: string; description: string | null; isPublic: boolean; file: { uri: string; mimeType?: string | null; size?: number | null } }) => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  const [file, setFile] = useState<{ uri: string; name: string; mimeType?: string | null; size?: number | null } | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => { if (!visible) { setFile(null); setName(''); setDescription(''); setIsPublic(false); } }, [visible]);

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (res.canceled) return;
    const a = res.assets[0];
    if (a.size && a.size > MAX_DOCUMENT_MB * 1024 * 1024) return toast.show(`That file is too large — limit is ${MAX_DOCUMENT_MB} MB`);
    setFile({ uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size });
    if (!name) setName(a.name);
  };

  const submit = () => {
    if (!file || !name.trim()) return;
    setBusy(true);
    onUpload({ name, description: description || null, isPublic, file });
    setBusy(false);
  };

  const g = file ? fileGlyph(file.mimeType) : null;

  return (
    <Sheet visible={visible} onClose={onClose} title="Upload document" footer={<Button label={busy ? 'Uploading…' : 'Upload'} loading={busy} fullWidth disabled={!file || !name.trim()} onPress={submit} />}>
      {file && g ? (
        <Pressable onPress={pick} className="mb-4 flex-row items-center gap-3 rounded-2xl border border-line bg-inset p-3.5 active:opacity-80">
          <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: g.color + '20' }}>
            <Ionicons name={g.icon as any} size={20} color={g.color} />
          </View>
          <View className="flex-1">
            <Text className="font-sans-sb text-[14px] text-ink" numberOfLines={1}>{file.name}</Text>
            <Text className="text-[12px] text-muted">{formatBytes(file.size)} · Tap to change</Text>
          </View>
        </Pressable>
      ) : (
        <Pressable onPress={pick} className="mb-4 items-center rounded-2xl border border-dashed border-line bg-inset py-7 active:opacity-80">
          <Ionicons name="cloud-upload-outline" size={28} color={c.muted} />
          <Text className="mt-2 font-sans-sb text-[14px] text-ink">Choose a file</Text>
          <Text className="text-[12px] text-muted">Any file up to {MAX_DOCUMENT_MB} MB</Text>
        </Pressable>
      )}

      <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Name</Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Society bylaws 2026" placeholderTextColor={c.faint} className="mb-4 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink" style={{ outline: 'none' } as any} />

      <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Description (optional)</Text>
      <TextInput value={description} onChangeText={setDescription} placeholder="What's in this document?" placeholderTextColor={c.faint} multiline className="mb-4 rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink" style={{ minHeight: 56, outline: 'none' } as any} />

      <PublicToggle value={isPublic} onToggle={() => setIsPublic((v) => !v)} c={c} />
    </Sheet>
  );
}

function ManageSheet({
  doc, onClose, communityId, userId, c, onChanged, toastShow,
}: {
  doc: DocRow | null; onClose: () => void; communityId: string | null; userId: string | null;
  c: ReturnType<typeof useThemeColors>; onChanged: () => void; toastShow: (m: string) => void;
}) {
  const confirm = useConfirm();
  const [isPublic, setIsPublic] = useState(false);
  const [shares, setShares] = useState<ShareUser[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string; flat: string | null }[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!doc) return;
    setIsPublic(doc.is_public);
    fetchShares(doc.id).then(setShares).catch(() => {});
    if (communityId) {
      fetchDirectory(communityId, userId, false)
        .then((rs) => setPeople(rs.filter((r) => r.userId && r.userId !== userId).map((r) => ({ id: r.userId!, name: r.name, flat: r.flat }))))
        .catch(() => {});
    }
  }, [doc, communityId, userId]);

  const togglePublic = async () => {
    if (!doc) return;
    const next = !isPublic;
    setIsPublic(next);
    try { await setDocPublic(doc.id, next); onChanged(); } catch { setIsPublic(!next); toastShow('Could not update'); }
  };

  const sharedIds = new Set(shares.map((s) => s.user_id));
  const addPerson = async (uid: string) => {
    if (!doc) return;
    try { await shareDocument(doc.id, uid); setShares(await fetchShares(doc.id)); } catch { toastShow('Could not share'); }
  };
  const revoke = async (uid: string) => {
    if (!doc) return;
    if (!(await confirm({ title: 'Revoke access', message: 'Remove this person’s access to the document?', confirmLabel: 'Revoke', destructive: true }))) return;
    try { await unshareDocument(doc.id, uid); setShares(await fetchShares(doc.id)); } catch { toastShow('Could not revoke'); }
  };
  const remove = async () => {
    if (!doc) return;
    const run = async () => { try { await deleteDocument(doc); onClose(); onChanged(); toastShow('Document deleted'); } catch { toastShow('Could not delete'); } };
    if (await confirm({ title: 'Delete document', message: `Delete "${doc.name}"? This cannot be undone.`, confirmLabel: 'Delete', destructive: true })) run();
  };

  const filteredPeople = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = people.filter((p) => !sharedIds.has(p.id));
    return s ? base.filter((p) => p.name.toLowerCase().includes(s) || (p.flat ?? '').toLowerCase().includes(s)) : base;
  }, [people, q, shares]);

  return (
    <Sheet visible={!!doc} onClose={onClose} title="Manage document">
      <PublicToggle value={isPublic} onToggle={togglePublic} c={c} />

      {!isPublic ? (
        <>
          <Text className="mb-2 mt-5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Shared with · {shares.length}</Text>
          {shares.length > 0 ? (
            <View className="mb-3 gap-2">
              {shares.map((s) => (
                <View key={s.user_id} className="flex-row items-center gap-3">
                  <Avatar name={s.profile?.name ?? '?'} size={32} />
                  <Text className="flex-1 font-sans-sb text-[14px] text-ink" numberOfLines={1}>{s.profile?.name ?? 'Member'}</Text>
                  <Pressable onPress={() => revoke(s.user_id)} hitSlop={6} className="rounded-full bg-inset px-2.5 py-1 active:opacity-70">
                    <Text className="text-[12px] font-sans-sb text-[#EF4444]">Revoke</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text className="mb-3 text-[13px] text-muted">Not shared with anyone yet.</Text>
          )}

          <View className="mb-2 flex-row items-center gap-2 rounded-2xl border border-line bg-inset px-3 py-2.5">
            <Ionicons name="search-outline" size={17} color={c.faint} />
            <TextInput value={q} onChangeText={setQ} placeholder="Add a neighbour…" placeholderTextColor={c.faint} className="flex-1 text-[15px] text-ink" style={{ outline: 'none' } as any} />
          </View>
          <View className="gap-1">
            {filteredPeople.slice(0, 30).map((p) => (
              <Pressable key={p.id} onPress={() => addPerson(p.id)} className="flex-row items-center gap-3 rounded-xl px-2 py-2 active:bg-inset">
                <Avatar name={p.name} size={32} />
                <View className="flex-1">
                  <Text className="font-sans-sb text-[14px] text-ink" numberOfLines={1}>{p.name}</Text>
                  {p.flat ? <Text className="text-[12px] text-faint">Flat {p.flat}</Text> : null}
                </View>
                <Ionicons name="add-circle" size={22} color={c.accent} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Pressable onPress={remove} className="mt-6 items-center py-3">
        <Text className="text-[13px] font-sans-sb text-[#EF4444]">Delete document</Text>
      </Pressable>
    </Sheet>
  );
}
