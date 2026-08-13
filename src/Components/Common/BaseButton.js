import React from 'react';
import { Pressable } from 'react-native';

function BaseButton({ onPress, disabled, children, style, hitSlop, ...rest }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        typeof style === 'function' ? style({ pressed }) : style,
        pressed && !disabled && { opacity: 0.85 },
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

export default BaseButton;
