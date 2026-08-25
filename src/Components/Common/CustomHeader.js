import React, { useEffect } from 'react';
import { View, Text, StyleSheet, BackHandler } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BaseButton from './BaseButton';
import { useTheme } from '../../theme/ThemeContext';

// General-purpose header for stack/detail screens (back/close + title) —
// distinct from HomeHeader, which is the branded avatar/bell header used on
// the four tab-root screens.
function CustomHeader({
  title,
  backgroundColor,
  leftAction = 'back',
  onLeftPress,
  disableSystemBack = false,
}) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const handleLeftPress = onLeftPress || (() => navigation.goBack());

  // Only the hardware/OS back button is affected — the header's own
  // back/close control below always calls handleLeftPress regardless.
  useEffect(() => {
    if (!disableSystemBack) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [disableSystemBack]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: backgroundColor || colors.background,
          paddingTop: insets.top + 12,
        },
      ]}
    >
      <View style={styles.side}>
        {leftAction !== 'none' ? (
          <BaseButton onPress={handleLeftPress} hitSlop={12}>
            <Text style={styles.icon}>{leftAction === 'close' ? '✕' : '‹'}</Text>
          </BaseButton>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.side} />
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingBottom: 12,
    },
    side: {
      width: 40,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    icon: {
      fontSize: 26,
      fontWeight: '600',
      color: colors.text,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    title: {
      flex: 1,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
  });

export default CustomHeader;
