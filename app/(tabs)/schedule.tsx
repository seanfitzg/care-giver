import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type FilterChip = 'all' | 'medication' | 'nutrition' | 'activity';

const CHIPS: { key: FilterChip; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'medication', label: 'Medication' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'activity', label: 'Activity' },
];
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { TimePicker } from '@/components/TimePicker';

type ItemType = 'medication_scheduled' | 'nutrition' | 'activity';
type NutritionType = 'bolus' | 'oral_self' | 'oral_carer';

type ScheduledItem = {
  id: string;
  type: ItemType;
  name: string;
  time_of_day: string | null;
  overdue_window_minutes: number;
  is_compulsory: boolean;
  bolus_rest_minutes: number | null;
  nutrition_type: NutritionType | null;
  duration_minutes: number | null;
};

type Occurrence = ScheduledItem & {
  occurrenceKey: string;
  occurrenceMinutes: number | null;
};

type ItemForm = {
  editId: string | null;
  type: ItemType;
  name: string;
  time_of_day: string;
  nutrition_type: NutritionType;
  bolus_rest_minutes: string;
  overdue_window_minutes: string;
  is_compulsory: boolean;
  duration_minutes: string;
};

const TYPE_CONFIG: Record<
  ItemType,
  { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; bg: string }
> = {
  medication_scheduled: { icon: 'medkit-outline', color: '#2563eb', bg: '#eff6ff' },
  nutrition: { icon: 'water-outline', color: '#d97706', bg: '#fffbeb' },
  activity: { icon: 'walk-outline', color: '#16a34a', bg: '#f0fdf4' },
};

const NUTRITION_TYPE_LABELS: Record<NutritionType, string> = {
  bolus: 'Bolus',
  oral_self: 'Oral (self)',
  oral_carer: 'Oral (carer)',
};

const NUTRITION_TYPES: NutritionType[] = ['bolus', 'oral_self', 'oral_carer'];

const TYPE_LABELS: Record<ItemType, string> = {
  medication_scheduled: 'Scheduled Medication',
  nutrition: 'Nutrition',
  activity: 'Activity',
};

function expandOccurrences(items: ScheduledItem[]): Occurrence[] {
  const result: Occurrence[] = [];
  for (const item of items) {
    if (!item.time_of_day) {
      result.push({ ...item, occurrenceKey: `${item.id}_0`, occurrenceMinutes: null });
      continue;
    }
    const parts = item.time_of_day.split(':');
    const mins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    result.push({ ...item, occurrenceKey: `${item.id}_0`, occurrenceMinutes: mins });
  }
  result.sort((a, b) => {
    if (a.occurrenceMinutes === null) return 1;
    if (b.occurrenceMinutes === null) return -1;
    return a.occurrenceMinutes - b.occurrenceMinutes;
  });
  return result;
}

function fmtMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseTime(v: string): string | null {
  const match = v.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}

function fmtTime(t: string | null): string {
  return t ? t.slice(0, 5) : '';
}

function blankItemForm(type: ItemType): ItemForm {
  return {
    editId: null,
    type,
    name: type === 'nutrition' ? 'Nutrition' : '',
    time_of_day: '',
    nutrition_type: 'bolus',
    bolus_rest_minutes: '20',
    overdue_window_minutes: '60',
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
    nutrition_type: item.nutrition_type ?? 'bolus',
    bolus_rest_minutes: item.bolus_rest_minutes != null ? String(item.bolus_rest_minutes) : '20',
    overdue_window_minutes: String(item.overdue_window_minutes),
    is_compulsory: item.is_compulsory,
    duration_minutes: String(item.duration_minutes ?? 30),
  };
}

export default function ScheduleScreen() {
  const { careRecipientId, isAdmin, role } = useAuth();
  const qc = useQueryClient();
  const canEdit = isAdmin || role === 'senior_carer';
  const [itemForm, setItemForm] = useState<ItemForm | null>(null);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ScheduledItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['scheduled_items', careRecipientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_items')
        .select(
          'id,type,name,time_of_day,overdue_window_minutes,is_compulsory,bolus_rest_minutes,nutrition_type,duration_minutes',
        )
        .eq('care_recipient_id', careRecipientId!)
        .order('time_of_day', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ScheduledItem[];
    },
    enabled: !!careRecipientId,
  });

  const saveItemMutation = useMutation({
    mutationFn: async (form: ItemForm) => {
      if (!form.name.trim()) throw new Error('Name is required.');
      const overdue = parseInt(form.overdue_window_minutes, 10);
      if (!overdue || overdue < 1) throw new Error('Overdue window must be a positive number.');

      const payload: Record<string, unknown> = {
        care_recipient_id: careRecipientId,
        type: form.type,
        name: form.name.trim(),
        overdue_window_minutes: overdue,
        is_compulsory: form.is_compulsory,
      };

      if (form.type === 'nutrition') {
        const time = parseTime(form.time_of_day);
        if (!time) throw new Error('Enter a valid time (HH:MM).');
        payload.nutrition_type = form.nutrition_type;
        payload.time_of_day = time;
        if (form.nutrition_type === 'bolus') {
          const restMins = parseInt(form.bolus_rest_minutes, 10);
          if (!restMins || restMins < 1) throw new Error('Rest period must be a positive number.');
          payload.bolus_rest_minutes = restMins;
        } else {
          payload.bolus_rest_minutes = null;
        }
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
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('scheduled_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled_items', careRecipientId] });
      setDeleteTarget(null);
    },
  });

  const allOccurrences = expandOccurrences(items);
  const occurrences = allOccurrences.filter((occ) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'medication') return occ.type === 'medication_scheduled';
    return occ.type === activeFilter;
  });

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={s.flex}>
      <View style={s.stickyHeader}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsRow}
        >
          {CHIPS.map((chip) => {
            const active = activeFilter === chip.key;
            return (
              <Pressable
                key={chip.key}
                onPress={() => setActiveFilter(chip.key)}
                style={[s.chip, active && s.chipActive]}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{chip.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        {canEdit && (
          <Pressable style={s.addRow} onPress={() => setTypePickerOpen(true)}>
            <Ionicons name="add-circle-outline" size={18} color="#2563eb" />
            <Text style={s.addRowText}>Add scheduled item</Text>
          </Pressable>
        )}
        {occurrences.length === 0 ? (
          <Text style={s.empty}>No items scheduled.</Text>
        ) : (
          occurrences.map((occ) => (
            <OccurrenceRow
              key={occ.occurrenceKey}
              occurrence={occ}
              canEdit={canEdit}
              onEdit={() => setItemForm(itemFormFromItem(occ))}
              onDelete={() => setDeleteTarget(occ)}
            />
          ))
        )}
      </ScrollView>

      <Modal visible={typePickerOpen} animationType="fade" transparent>
        <Pressable style={s.overlay} onPress={() => setTypePickerOpen(false)}>
          <Pressable onPress={() => {}} style={s.sheet}>
            <Text style={s.sheetTitle}>Add scheduled item</Text>
            {(['medication_scheduled', 'nutrition', 'activity'] as ItemType[]).map((t) => (
              <Pressable
                key={t}
                style={s.sheetOption}
                onPress={() => {
                  setTypePickerOpen(false);
                  setItemForm(blankItemForm(t));
                }}
              >
                <View style={[s.typeIcon, { backgroundColor: TYPE_CONFIG[t].bg }]}>
                  <Ionicons name={TYPE_CONFIG[t].icon} size={18} color={TYPE_CONFIG[t].color} />
                </View>
                <Text style={s.sheetOptionText}>{TYPE_LABELS[t]}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!itemForm} animationType="slide" presentationStyle="formSheet">
        {itemForm && (
          <ScheduledItemModal
            form={itemForm}
            onChange={setItemForm}
            onSave={() => saveItemMutation.mutate(itemForm)}
            onCancel={() => setItemForm(null)}
            isPending={saveItemMutation.isPending}
            error={saveItemMutation.error instanceof Error ? saveItemMutation.error.message : null}
          />
        )}
      </Modal>

      <Modal visible={!!deleteTarget} animationType="fade" transparent>
        <Pressable style={s.overlay} onPress={() => setDeleteTarget(null)}>
          <Pressable onPress={() => {}} style={s.confirmSheet}>
            <Text style={s.confirmTitle}>Delete item</Text>
            <Text style={s.confirmBody}>Delete "{deleteTarget?.name}"? This cannot be undone.</Text>
            {deleteItemMutation.error != null && (
              <Text style={s.errorText}>
                {deleteItemMutation.error instanceof Error
                  ? deleteItemMutation.error.message
                  : 'Failed to delete item. Please try again.'}
              </Text>
            )}
            <View style={s.confirmActions}>
              <Pressable style={s.cancelButton} onPress={() => setDeleteTarget(null)}>
                <Text style={s.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.deleteButton, deleteItemMutation.isPending && s.buttonDisabled]}
                onPress={() => deleteTarget && deleteItemMutation.mutate(deleteTarget.id)}
                disabled={deleteItemMutation.isPending}
              >
                {deleteItemMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.deleteBtnText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function OccurrenceRow({
  occurrence,
  canEdit,
  onEdit,
  onDelete,
}: {
  occurrence: Occurrence;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cfg = TYPE_CONFIG[occurrence.type];
  const timeStr =
    occurrence.occurrenceMinutes !== null ? fmtMinutes(occurrence.occurrenceMinutes) : '—';
  const detail =
    occurrence.type === 'nutrition' && occurrence.nutrition_type
      ? NUTRITION_TYPE_LABELS[occurrence.nutrition_type]
      : null;
  const showCompulsory = occurrence.is_compulsory && occurrence.type === 'medication_scheduled';

  return (
    <View style={s.row}>
      <View style={[s.typeIcon, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
      </View>
      <Text style={s.timeText}>{timeStr}</Text>
      <View style={s.rowMid}>
        <Text style={s.rowName}>{occurrence.name}</Text>
        {(detail || showCompulsory) && (
          <View style={s.badgeRow}>
            {detail && (
              <View style={[s.badge, { backgroundColor: cfg.bg }]}>
                <Text style={[s.badgeText, { color: cfg.color }]}>{detail}</Text>
              </View>
            )}
            {showCompulsory && (
              <View style={s.compulsoryBadge}>
                <Text style={s.compulsoryText}>Compulsory</Text>
              </View>
            )}
          </View>
        )}
      </View>
      {canEdit && (
        <View style={s.rowActions}>
          <Pressable style={s.actionBtn} onPress={onEdit}>
            <Text style={s.actionText}>Edit</Text>
          </Pressable>
          <Pressable style={[s.actionBtn, s.deleteActionBtn]} onPress={onDelete}>
            <Text style={s.deleteActionText}>Delete</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ScheduledItemModal({
  form,
  onChange,
  onSave,
  onCancel,
  isPending,
  error,
}: {
  form: ItemForm;
  onChange: (f: ItemForm) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
}) {
  const set = (patch: Partial<ItemForm>) => onChange({ ...form, ...patch });

  return (
    <ScrollView style={s.modal} contentContainerStyle={s.modalContent}>
      <Text style={s.modalTitle}>
        {form.editId ? 'Edit' : 'Add'} {TYPE_LABELS[form.type]}
      </Text>

      {error && <Text style={s.errorText}>{error}</Text>}

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
          <FieldLabel>Feeding type</FieldLabel>
          <View style={s.segRow}>
            {NUTRITION_TYPES.map((v) => (
              <Pressable
                key={v}
                style={[s.seg, form.nutrition_type === v && s.segSelected]}
                onPress={() => set({ nutrition_type: v })}
              >
                <Text style={[s.segText, form.nutrition_type === v && s.segTextSelected]}>
                  {NUTRITION_TYPE_LABELS[v]}
                </Text>
              </Pressable>
            ))}
          </View>
          <FieldLabel>Time</FieldLabel>
          <TimePicker value={form.time_of_day} onChange={(v) => set({ time_of_day: v })} />
          {form.nutrition_type === 'bolus' && (
            <>
              <FieldLabel>Default rest period between boluses (minutes)</FieldLabel>
              <TextInput
                style={s.input}
                value={form.bolus_rest_minutes}
                onChangeText={(v) => set({ bolus_rest_minutes: v })}
                keyboardType="number-pad"
                placeholder="e.g. 20"
                placeholderTextColor="#9ca3af"
              />
            </>
          )}
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

      <FieldLabel>Mark missed after (minutes)</FieldLabel>
      <TextInput
        style={s.input}
        value={form.overdue_window_minutes}
        onChangeText={(v) => set({ overdue_window_minutes: v })}
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={s.fieldLabel}>{children}</Text>;
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, gap: 10 },

  stickyHeader: {
    backgroundColor: '#f9fafb',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  chipsRow: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  addRowText: { fontSize: 14, color: '#2563eb', fontWeight: '500' },
  empty: { fontSize: 14, color: '#9ca3af', paddingVertical: 8 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  typeIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  timeText: { fontSize: 13, fontWeight: '600', color: '#374151', width: 42 },
  rowMid: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  compulsoryBadge: {
    backgroundColor: '#fee2e2',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  compulsoryText: { fontSize: 11, fontWeight: '600', color: '#dc2626' },
  rowActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  actionText: { fontSize: 12, color: '#374151' },
  deleteActionBtn: { borderColor: '#fca5a5' },
  deleteActionText: { fontSize: 12, color: '#dc2626' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    gap: 4,
  },
  sheetTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  sheetOptionText: { fontSize: 15, color: '#111827' },
  confirmSheet: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  confirmTitle: { fontSize: 17, fontWeight: '600', color: '#111827', marginBottom: 8 },
  confirmBody: { fontSize: 14, color: '#6b7280', marginBottom: 20 },
  confirmActions: { flexDirection: 'row', gap: 12 },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelText: { fontSize: 14, color: '#374151' },
  deleteButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
  },
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
  saveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  saveText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
