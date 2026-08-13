import React from 'react';
import { View } from 'react-native';
import BaseButton from './BaseButton';
import { useTheme } from '../../theme/ThemeContext';

function BaseCard({
  children,
  clickable = false,
  disabled = false,
  onPress,
  padding = 20,
  borderRadius = 20,
  backgroundColor,
  style,
  ...rest
}) {
  const { colors } = useTheme();
  const resolvedBackground = backgroundColor ?? colors.card;

  const cardStyle = [
    { backgroundColor: resolvedBackground, borderRadius, padding, overflow: 'hidden' },
    disabled && { opacity: 0.5 },
    style,
  ];

  if (clickable) {
    return (
      <BaseButton onPress={onPress} disabled={disabled} style={cardStyle} {...rest}>
        {children}
      </BaseButton>
    );
  }

  return (
    <View style={cardStyle} {...rest}>
      {children}
    </View>
  );
}

export default BaseCard;
