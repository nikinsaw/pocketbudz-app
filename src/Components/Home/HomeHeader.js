import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';

function HomeHeader() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarGlyph}>👤</Text>
      </View>
      <Text style={styles.title}>PocketBudz</Text>
      <View style={styles.actions}>
        <Pressable
          onPress={() => navigation.navigate('AskSpending')}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Ask about your spending"
        >
          <Text style={styles.iconGlyph}>💬</Text>
        </Pressable>
        <View style={styles.iconButton}>
          <Text style={styles.iconGlyph}>🔔</Text>
        </View>
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
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconButton: {
      width: 32,
      alignItems: 'center',
    },
    iconGlyph: {
      fontSize: 22,
    },
  });

export default HomeHeader;
