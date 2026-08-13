import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BaseCard from '../Common/BaseCard';
import { useTheme } from '../../theme/ThemeContext';

function ProfileCard({ name, email, onPress }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <BaseCard clickable onPress={onPress} style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarGlyph}>👤</Text>
      </View>
      <View style={styles.details}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{email}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </BaseCard>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.pillBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    avatarGlyph: {
      fontSize: 24,
    },
    details: {
      flex: 1,
    },
    name: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
    },
    email: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    chevron: {
      color: colors.textMuted,
      fontSize: 22,
      fontWeight: '300',
    },
  });

export default ProfileCard;
