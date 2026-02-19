import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileHeader, SettingsRow } from '../components';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { theme } from '../theme';
import { auth } from '../services';

const SAMPLE_DATA = {
  name: '{{userName}}',
  email: '{{userEmail}}',
  initials: '{{userInitials}}',
  stats: [
    { value: '{{profileStat1Value}}', label: '{{profileStat1Label}}' },
    { value: '{{profileStat2Value}}', label: '{{profileStat2Label}}' },
    { value: '{{profileStat3Value}}', label: '{{profileStat3Label}}' },
  ],
};

export default function ProfileScreen() {
  const [notificationsOn, setNotificationsOn] = useState(true);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => auth.signOut() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ProfileHeader
          name={SAMPLE_DATA.name}
          email={SAMPLE_DATA.email}
          initials={SAMPLE_DATA.initials}
          stats={SAMPLE_DATA.stats}
        />

        <View style={styles.settings}>
          <SettingsRow
            label="{{setting1}}"
            icon={<Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={2}><Circle cx={12} cy={12} r={3} /><Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Svg>}
            type="arrow"
          />
          <SettingsRow
            label="{{setting2}}"
            icon={<Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={2}><Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><Path d="M13.73 21a2 2 0 0 1-3.46 0" /></Svg>}
            type="toggle"
            value={notificationsOn}
            onToggle={setNotificationsOn}
          />
          <SettingsRow
            label="{{setting3}}"
            icon={<Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={2}><Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Svg>}
            type="arrow"
          />
          <SettingsRow
            label="{{setting4}}"
            icon={<Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={2}><Circle cx={12} cy={12} r={10} /><Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><Line x1={12} y1={17} x2={12.01} y2={17} /></Svg>}
            type="arrow"
          />
        </View>

        <Pressable style={styles.signOut} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050507' },
  scroll: { padding: 20, paddingBottom: 100 },
  settings: { marginTop: 20, gap: 4 },
  signOut: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(244,63,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.2)',
    alignItems: 'center',
  },
  signOutText: { fontSize: 14, fontWeight: '500', color: '#fb7185' },
});
