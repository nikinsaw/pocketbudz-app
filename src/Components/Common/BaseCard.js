import React from 'react';
import { View } from 'react-native';
import BaseButton from './BaseButton';
import colors from '../../theme/colors';

function BaseCard({
  children,
  clickable = false,
  disabled = false,
  onPress,
  padding = 20,
  borderRadius = 20,
  backgroundColor = colors.card,
  style,
  ...rest
}) {
  const cardStyle = [
    { backgroundColor, borderRadius, padding, overflow: 'hidden' },
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
