import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { TimePicker } from '@/components/TimePicker';

type ItemType = 'medication_scheduled' | 'nutrition' | 'activity';

type ScheduledItem = {
  id: string;
  type: ItemType;
  name: string;
  time_of_day: string | null;
  interval_minutes: number | null;
  overdue_window_minutes: number;
  missed_threshold_minutes: number;
  is_compulsory: boolean;
  bolus_rest_minutes: number | null;
  bolus_rounds: number | null;
  duration_minutes: number | null;
};

type AsNeededMed = {
  id: string;
  name: string;
  notes: string | null;
};

type ItemForm = {
  editId: string | null;
  type: ItemType;
  name: string;
  time_of_day: string;
  interval_minutes: string;
  bolus_rest_minutes: '20' | '25';
  bolus_rounds: string;
  overdue_window_minutes: string;
  missed_threshold_minutes: string;
  is_compulsory: boolean;
  duration_minutes: string;
};

type AsnForm = {
  editId: string | null;
  name: string;
  notes: string;
};

function parseTime(v: string): string | null {
  const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}

function fmtTime(t: string | null): string {
  return t ? t.slice(0, 5) : '';
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function blankItemForm(type: ItemType): ItemForm {
  return {
    editId: null,
    type,
    name: type === 'nutrition' ? 'Nutrition' : '',
    time_of_day: '',
    interval_minutes: '180',
    bolus_rest_minutes: '20',
    bolus_rounds: '',
    overdue_window_minutes: '15',
    missed_threshold_minutes: '60',
    is_compulsory: true,
    duration_minutes: '30',
  };
}

function itemFormFromItem(item: ScheduledItem): ItemForm {
  return {
    editId: item.id,
    type: item.type,
    name: item.name,
    time_of_day: fmtTime(item.time_of_day),
    interval_minutes: String(item.interval_minutes ?? 180),
    bolus_rest_minutes: item.bolus_rest_minutes === 25 ? '25' : '20',
    bolus_rounds: item.bolus_rounds != null ? String(item.bolus_rounds) : '',
    overdue_window_minutes: String(item.overdue_window_minutes),
    missed_threshold_minutes: String(item.missed_threshold_minutes),
    is_compulsory: item.is_compulsory,
    duration_minutes: String(item.duration_minutes ?? 30),
  };
}

const TYPE_LABELS: Record<ItemType, string> = {
  medication_scheduled: 'Scheduled Medication',
  nutrition: 'Nutrition',
  activity: 'Activity',
};

export default function ScheduleScreen() {
  const { careRecipientId, role } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [itemForm, setItemForm] = useState<ItemForm | null>(null);
  const [asnForm, setAsnForm] = useState<AsnForm | null>(null);

  useEffect(() => {
    if (role === 'carer') router.replace('/(tabs)' as never);
  }, [role, router]);

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ['scheduled_items', careRecipientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_items')
        .select(
          'id,type,name,time_of_day,interval_minutes,overdue_window_minutes,missed_threshold_minutes,is_compulsory,bolus_rest_minutes,bolus_rounds,duration_minutes',
        )
        .eq('care_recipient_id', careRecipientId!)
        .order('time_of_day', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ScheduledItem[];
    },
    enabled: !!careRecipientId,
  });

  const { data: asnMeds = [], isLoading: loadingAsn } = useQuery({
    queryKey: ['as_needed_medications', careRecipientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('as_needed_medications')
        .select('id,name,notes')
        .eq('care_recipient_id', careRecipientId!)
        .order('name');
      if (error) throw error;
      return (data ?? []) as AsNeededMed[];
    },
    enabled: !!careRecipientId,
  });

  const saveItemMutation = useMutation({
    mutationFn: async (form: ItemForm) => {
      if (!form.name.trim()) throw new Error('Name is required.');

      const overdue = parseInt(form.overdue_window_minutes, 10);
      const missed = parseInt(form.missed_threshold_minutes, 10);
      if (!overdue || overdue < 1) throw new Error('Overdue window must be a positive number.');
      if (!missed || missed < 1) throw new Error('Missed threshold must be a positive number.');

      const payload: Record<string, unknown> = {
        care_recipient_id: careRecipientId,
        type: form.type,
        name: form.name.trim(),
        overdue_window_minutes: overdue,
        missed_threshold_minutes: missed,
        is_compulsory: form.is_compulsory,
      };

      if (form.type === 'nutrition') {
        const interval = parseInt(form.interval_minutes, 10);
        if (!interval || interval < 1) throw new Error('Interval must be a positive number.');
        payload.interval_minutes = interval;
        payload.bolus_rest_minutes = parseInt(form.bolus_rest_minutes, 10);
        payload.time_of_day = form.time_of_day ? parseTime(form.time_of_day) : null;
        const rounds = parseInt(form.bolus_rounds, 10);
        payload.bolus_rounds = rounds > 0 ? rounds : null;
      } else {
        const time = parseTime(form.time_of_day);
        if (!time) throw new Error('Enter a valid time (HH:MM).');
        payload.time_of_day = time;
      }

      if (form.type === 'activity') {
        const duration = parseInt(form.duration_minutes, 10);
        if (!duration || duration < 1) throw new Error('Duration must be a positive number.');
        payload.duration_minutes = duration;
      }

      if (form.editId) {
        const { error } = await supabase
          .from('scheduled_items')
          .update(payload)
          .eq('id', form.editId);
        if (error) throw error;
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        payload.created_by = session!.user.id;
        const { error } = await supabase.from('scheduled_items').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled_items', careRecipientId] });
      setItemForm(null);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('scheduled_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled_items', careRecipientId] }),
    onError: (err: Error) => Alert.alert('Delete failed', err.message),
  });

  const saveAsnMutation = useMutation({
    mutationFn: async (form: AsnForm) => {
      if (!form.name.trim()) throw new Error('Name is required.');
      const payload = {
        care_recipient_id: careRecipientId,
        name: form.name.trim(),
        notes: form.notes.trim() || null,
      };
      if (form.editId) {
        const { error } = await supabase
          .from('as_needed_medications')
          .update(payload)
          .eq('id', form.editId);
        if (error) throw error;
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const { error } = await supabase
          .from('as_needed_medications')
          .insert({ ...payload, created_by: session!.user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['as_needed_medications', careRecipientId] });
      setAsnForm(null);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const deleteAsnMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('as_needed_medications').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['as_needed_medications', careRecipientId] }),
    onError: (err: Error) => Alert.alert('Delete failed', err.message),
  });

  const confirmDelete = (item: ScheduledItem) =>
    Alert.alert('Delete item', `Delete "${item.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteItemMutation.mutate(item.id) },
    ]);

  const confirmDeleteAsn = (item: AsNeededMed) =>
    Alert.alert('Delete medication', `Delete "${item.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteAsnMutation.mutate(item.id) },
    ]);

  const meds = items.filter((i) => i.type === 'medication_scheduled');
  const nutritionItems = items.filter((i) => i.type === 'nutrition');
  const activities = items.filter((i) => i.type === 'activity');

  if (loadingItems || loadingAsn) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <SectionBlock
          title="Scheduled Medications"
          onAdd={() => setItemForm(blankItemForm('medication_scheduled'))}
        >
          {meds.map((item) => (
            <ItemRow
              key={item.id}
              label={item.name}
              sub={`${fmtTime(item.time_of_day)} · ${item.is_compulsory ? 'Compulsory' : 'Supplement'} · overdue ${item.overdue_window_minutes}min`}
              onEdit={() => setItemForm(itemFormFromItem(item))}
              onDelete={() => confirmDelete(item)}
            />
          ))}
          {meds.length === 0 && <Text style={s.empty}>No medications scheduled.</Text>}
        </SectionBlock>

        <SectionBlock title="Nutrition Schedule" onAdd={() => setItemForm(blankItemForm('nutrition'))}>
          {nutritionItems.map((item) => (
            <ItemRow
              key={item.id}
              label={item.name}
              sub={[
                `Every ${fmtDuration(item.interval_minutes ?? 0)}`,
                `${fmtDuration(item.bolus_rest_minutes ?? 0)} bolus rest`,
                item.bolus_rounds != null ? `${item.bolus_rounds} bolus rounds` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              onEdit={() => setItemForm(itemFormFromItem(item))}
              onDelete={() => confirmDelete(item)}
            />
          ))}
          {nutritionItems.length === 0 && <Text style={s.empty}>No nutrition sessions set.</Text>}
        </SectionBlock>

        <SectionBlock title="Activities" onAdd={() => setItemForm(blankItemForm('activity'))}>
          {activities.map((item) => (
            <ItemRow
              key={item.id}
              label={item.name}
              sub={[
                fmtTime(item.time_of_day),
                item.duration_minutes != null ? fmtDuration(item.duration_minutes) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              onEdit={() => setItemForm(itemFormFromItem(item))}
              onDelete={() => confirmDelete(item)}
            />
          ))}
          {activities.length === 0 && <Text style={s.empty}>No activities scheduled.</Text>}
        </SectionBlock>

        <SectionBlock
          title="As-Needed Medications"
          onAdd={() => setAsnForm({ editId: null, name: '', notes: '' })}
        >
          {asnMeds.map((item) => (
            <ItemRow
              key={item.id}
              label={item.name}
              sub={item.notes ?? ''}
              onEdit={() =>
                setAsnForm({ editId: item.id, name: item.name, notes: item.notes ?? '' })
              }
              onDelete={() => confirmDeleteAsn(item)}
            />
          ))}
          {asnMeds.length === 0 && <Text style={s.empty}>No as-needed medications defined.</Text>}
        </SectionBlock>
      </ScrollView>

      <Modal visible={!!itemForm} animationType="slide" presentationStyle="formSheet">
        {itemForm && (
          <ScheduledItemModal
            form={itemForm}
            onChange={setItemForm}
            onSave={() => saveItemMutation.mutate(itemForm)}
            onCancel={() => setItemForm(null)}
            isPending={saveItemMutation.isPending}
          />
        )}
      </Modal>

      <Modal visible={!!asnForm} animationType="slide" presentationStyle="formSheet">
        {asnForm && (
          <AsnModal
            form={asnForm}
            onChange={setAsnForm}
            onSave={() => saveAsnMutation.mutate(asnForm)}
            onCancel={() => setAsnForm(null)}
            isPending={saveAsnMutation.isPending}
          />
        )}
      </Modal>
    </>
  );
}

function SectionBlock({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>{title}</Text>
        <Pressable style={s.addBtn} onPress={onAdd}>
          <Text style={s.addBtnText}>+ Add</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function ItemRow({
  label,
  sub,
  onEdit,
  onDelete,
}: {
  label: string;
  sub: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={s.row}>
      <View style={s.rowInfo}>
        <Text style={s.rowLabel}>{label}</Text>
        {!!sub && <Text style={s.rowSub}>{sub}</Text>}
      </View>
      <View style={s.rowActions}>
        <Pressable style={s.actionBtn} onPress={onEdit}>
          <Text style={s.actionText}>Edit</Text>
        </Pressable>
        <Pressable style={[s.actionBtn, s.deleteBtn]} onPress={onDelete}>
          <Text style={[s.actionText, s.deleteText]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ScheduledItemModal({
  form,
  onChange,
  onSave,
  onCancel,
  isPending,
}: {
  form: ItemForm;
  onChange: (f: ItemForm) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const set = (patch: Partial<ItemForm>) => onChange({ ...form, ...patch });

  return (
    <ScrollView style={s.modal} contentContainerStyle={s.modalContent}>
      <Text style={s.modalTitle}>
        {form.editId ? 'Edit' : 'Add'} {TYPE_LABELS[form.type]}
      </Text>

      <FieldLabel>Name</FieldLabel>
      <TextInput
        style={s.input}
        value={form.name}
        onChangeText={(v) => set({ name: v })}
        placeholder="Name"
        placeholderTextColor="#9ca3af"
      />

      {form.type !== 'nutrition' && (
        <>
          <FieldLabel>Time</FieldLabel>
          <TimePicker value={form.time_of_day} onChange={(v) => set({ time_of_day: v })} />
        </>
      )}

      {form.type === 'nutrition' && (
        <>
          <FieldLabel>First session at (optional)</FieldLabel>
          <TimePicker value={form.time_of_day} onChange={(v) => set({ time_of_day: v })} />
          <FieldLabel>Interval between sessions (minutes)</FieldLabel>
          <TextInput
            style={s.input}
            value={form.interval_minutes}
            onChangeText={(v) => set({ interval_minutes: v })}
            keyboardType="number-pad"
            placeholder="e.g. 180"
            placeholderTextColor="#9ca3af"
          />
          <FieldLabel>Bolus rest duration</FieldLabel>
          <View style={s.segRow}>
            {(['20', '25'] as const).map((v) => (
              <Pressable
                key={v}
                style={[s.seg, form.bolus_rest_minutes === v && s.segSelected]}
                onPress={() => set({ bolus_rest_minutes: v })}
              >
                <Text style={[s.segText, form.bolus_rest_minutes === v && s.segTextSelected]}>
                  {v} min
                </Text>
              </Pressable>
            ))}
          </View>
          <FieldLabel>Target bolus rounds (optional)</FieldLabel>
          <TextInput
            style={s.input}
            value={form.bolus_rounds}
            onChangeText={(v) => set({ bolus_rounds: v })}
            keyboardType="number-pad"
            placeholder="e.g. 4 (leave blank if open-ended)"
            placeholderTextColor="#9ca3af"
          />
        </>
      )}

      {form.type === 'medication_scheduled' && (
        <>
          <FieldLabel>Type</FieldLabel>
          <View style={s.segRow}>
            {([true, false] as const).map((v) => (
              <Pressable
                key={String(v)}
                style={[s.seg, form.is_compulsory === v && s.segSelected]}
                onPress={() => set({ is_compulsory: v })}
              >
                <Text style={[s.segText, form.is_compulsory === v && s.segTextSelected]}>
                  {v ? 'Compulsory' : 'Supplement'}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {form.type === 'activity' && (
        <>
          <FieldLabel>Duration (minutes)</FieldLabel>
          <TextInput
            style={s.input}
            value={form.duration_minutes}
            onChangeText={(v) => set({ duration_minutes: v })}
            keyboardType="number-pad"
            placeholder="e.g. 30"
            placeholderTextColor="#9ca3af"
          />
        </>
      )}

      <FieldLabel>Overdue window (minutes)</FieldLabel>
      <TextInput
        style={s.input}
        value={form.overdue_window_minutes}
        onChangeText={(v) => set({ overdue_window_minutes: v })}
        keyboardType="number-pad"
        placeholder="e.g. 15"
        placeholderTextColor="#9ca3af"
      />

      <FieldLabel>Missed threshold (minutes)</FieldLabel>
      <TextInput
        style={s.input}
        value={form.missed_threshold_minutes}
        onChangeText={(v) => set({ missed_threshold_minutes: v })}
        keyboardType="number-pad"
        placeholder="e.g. 60"
        placeholderTextColor="#9ca3af"
      />

      <View style={s.modalActions}>
        <Pressable style={s.cancelButton} onPress={onCancel}>
          <Text style={s.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[s.saveButton, isPending && s.buttonDisabled]}
          onPress={onSave}
          disabled={isPending}
        >
          {isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function AsnModal({
  form,
  onChange,
  onSave,
  onCancel,
  isPending,
}: {
  form: AsnForm;
  onChange: (f: AsnForm) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const set = (patch: Partial<AsnForm>) => onChange({ ...form, ...patch });

  return (
    <View style={s.modal}>
      <Text style={s.modalTitle}>{form.editId ? 'Edit' : 'Add'} As-Needed Medication</Text>

      <FieldLabel>Name</FieldLabel>
      <TextInput
        style={s.input}
        value={form.name}
        onChangeText={(v) => set({ name: v })}
        placeholder="e.g. Rescue medication"
        placeholderTextColor="#9ca3af"
      />

      <FieldLabel>Notes (optional)</FieldLabel>
      <TextInput
        style={[s.input, s.inputMultiline]}
        value={form.notes}
        onChangeText={(v) => set({ notes: v })}
        placeholder="Any notes about this medication"
        placeholderTextColor="#9ca3af"
        multiline
        numberOfLines={3}
      />

      <View style={s.modalActions}>
        <Pressable style={s.cancelButton} onPress={onCancel}>
          <Text style={s.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[s.saveButton, isPending && s.buttonDisabled]}
          onPress={onSave}
          disabled={isPending}
        >
          {isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={s.fieldLabel}>{children}</Text>;
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, gap: 24 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#374151' },
  addBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  row: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '500', color: '#111827' },
  rowSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  actionText: { fontSize: 12, color: '#374151' },
  deleteBtn: { borderColor: '#fca5a5' },
  deleteText: { color: '#dc2626' },
  empty: { fontSize: 13, color: '#9ca3af', paddingVertical: 4 },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalContent: { padding: 24, paddingTop: 40, gap: 0 },
  modalTitle: { fontSize: 20, fontWeight: '600', color: '#111827', marginBottom: 24 },
  fieldLabel: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  segRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  seg: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  segSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  segText: { fontSize: 14, color: '#374151' },
  segTextSelected: { color: '#2563eb', fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, color: '#374151' },
  saveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  saveText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
