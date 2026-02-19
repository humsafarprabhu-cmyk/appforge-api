import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassInput, GradientButton, GlassCard } from '../components';
import { theme } from '../theme';
import { db } from '../services';

const SAMPLE_TAGS = ['{{tag1}}', '{{tag2}}', '{{tag3}}', '{{tag4}}', '{{tag5}}'];

export default function FormScreen() {
  const [field1, setField1] = useState('');
  const [field2, setField2] = useState('');
  const [field3, setField3] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([SAMPLE_TAGS[0]]);
  const [toggleOn, setToggleOn] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!field1.trim()) {
      Alert.alert('Required', 'Please fill in the title');
      return;
    }
    setSubmitting(true);
    try {
      await db.add('{{collection}}', {
        title: field1,
        category: field2,
        description: field3,
        tags: selectedTags,
        notifications: toggleOn,
      });
      Alert.alert('Success', 'Item saved successfully!');
      setField1(''); setField2(''); setField3('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{{pageTitle}}</Text>
        <Text style={styles.subtitle}>{{formSubtitle}}</Text>

        <View style={styles.form}>
          <GlassInput label="{{field1Label}}" placeholder="{{field1Placeholder}}" value={field1} onChangeText={setField1} />
          <GlassInput label="{{field2Label}}" placeholder="{{field2Placeholder}}" value={field2} onChangeText={setField2} />
          <GlassInput label="{{field3Label}}" placeholder="{{field3Placeholder}}" value={field3} onChangeText={setField3} multiline numberOfLines={4} />

          <View style={styles.tagsSection}>
            <Text style={styles.tagsLabel}>{{field4Label}}</Text>
            <View style={styles.tagsList}>
              {SAMPLE_TAGS.map((tag, i) => (
                <Pressable
                  key={i}
                  style={[styles.tag, selectedTags.includes(tag) && styles.tagActive]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text style={[styles.tagText, selectedTags.includes(tag) && styles.tagTextActive]}>{tag}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <GlassCard variant="sm" style={styles.toggleRow}>
            <View style={styles.toggleContent}>
              <Text style={styles.toggleLabel}>{{toggleLabel}}</Text>
              <Text style={styles.toggleDesc}>{{toggleDescription}}</Text>
            </View>
            <Pressable
              style={[styles.toggle, toggleOn && styles.toggleActive]}
              onPress={() => setToggleOn(!toggleOn)}
            >
              <View style={[styles.toggleThumb, toggleOn && styles.toggleThumbActive]} />
            </Pressable>
          </GlassCard>

          <GradientButton label="{{submitLabel}}" onPress={handleSubmit} disabled={submitting} style={styles.submit} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050507' },
  scroll: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 13, color: theme.colors.textDimmed, marginTop: 4, marginBottom: 20 },
  form: {},
  tagsSection: { marginBottom: 16 },
  tagsLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted, marginBottom: 8 },
  tagsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  tagActive: { backgroundColor: theme.colors.primary[0], borderColor: theme.colors.primary[0] },
  tagText: { fontSize: 12, color: theme.colors.textMuted },
  tagTextActive: { color: '#fff', fontWeight: '500' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  toggleContent: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '500', color: '#fff' },
  toggleDesc: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2 },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', paddingHorizontal: 2 },
  toggleActive: { backgroundColor: theme.colors.primary[0] },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleThumbActive: { alignSelf: 'flex-end' },
  submit: { marginTop: 8 },
});
