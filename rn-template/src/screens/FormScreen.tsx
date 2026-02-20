import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { store } from '../store';
import { theme } from '../theme';

const TAGS = ['{{tag1}}', '{{tag2}}', '{{tag3}}', '{{tag4}}', '{{tag5}}'];

export default function FormScreen() {
  const nav = useNavigation<any>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notify, setNotify] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title');
      return;
    }
    setSaving(true);
    await store.add({
      title: title.trim(),
      subtitle: description.trim() || undefined,
      badge: selectedTags[0] || undefined,
      data: {
        ...(category ? { category } : {}),
        ...(selectedTags.length > 0 ? { tags: selectedTags.join(', ') } : {}),
        ...(notify ? { notifications: 'On' } : {}),
      },
    });
    setSaving(false);
    nav.goBack();
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => nav.goBack()}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>{{pageTitle}}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[s.saveText, { color: theme.colors.primary[0], opacity: saving ? 0.5 : 1 }]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Title field */}
        <View style={s.field}>
          <Text style={s.label}>{{field1Label}} *</Text>
          <TextInput
            style={s.input}
            placeholder="{{field1Placeholder}}"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={title}
            onChangeText={setTitle}
            autoFocus
          />
        </View>

        {/* Description field */}
        <View style={s.field}>
          <Text style={s.label}>{{field2Label}}</Text>
          <TextInput
            style={[s.input, s.textArea]}
            placeholder="{{field2Placeholder}}"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Category field */}
        <View style={s.field}>
          <Text style={s.label}>{{field3Label}}</Text>
          <TextInput
            style={s.input}
            placeholder="{{field3Placeholder}}"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={category}
            onChangeText={setCategory}
          />
        </View>

        {/* Tags */}
        <View style={s.field}>
          <Text style={s.label}>Tags</Text>
          <View style={s.tagsRow}>
            {TAGS.map(tag => (
              <TouchableOpacity
                key={tag}
                style={[s.tag, selectedTags.includes(tag) && { backgroundColor: theme.colors.primary[0] + '30', borderColor: theme.colors.primary[0] }]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[s.tagText, selectedTags.includes(tag) && { color: theme.colors.primary[0] }]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Toggle */}
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>{{toggleLabel}}</Text>
            <Text style={s.toggleDesc}>{{toggleDescription}}</Text>
          </View>
          <Switch
            value={notify}
            onValueChange={setNotify}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.colors.primary[0] + '60' }}
            thumbColor={notify ? theme.colors.primary[0] : '#888'}
          />
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: theme.colors.primary[0], opacity: saving ? 0.5 : 1 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={s.saveBtnText}>{saving ? 'Saving...' : '{{submitLabel}}'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050507' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 24, paddingVertical: 8 },
  cancelText: { color: 'rgba(255,255,255,0.6)', fontSize: 16 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  saveText: { fontSize: 16, fontWeight: '600' },
  field: { marginBottom: 20 },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500', marginBottom: 8 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  textArea: { minHeight: 100, textAlignVertical: 'top', paddingTop: 14 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tagText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '500' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, marginBottom: 24 },
  toggleLabel: { color: '#fff', fontSize: 15, fontWeight: '500' },
  toggleDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  saveBtn: { borderRadius: 14, padding: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
