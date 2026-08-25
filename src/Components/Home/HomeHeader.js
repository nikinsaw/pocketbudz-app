import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';

function HomeHeader() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarGlyph}>👤</Text>
      </View>
      <Text style={styles.title}>PocketBudz</Text>
      <View style={styles.bell}>
        <Text style={styles.bellGlyph}>🔔</Text>
      </View>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.avatarBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarGlyph: {
      fontSize: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 0.3,
    },
    bell: {
      width: 32,
      alignItems: 'center',
    },
    bellGlyph: {
      fontSize: 22,
    },
  });

export default HomeHeader;
