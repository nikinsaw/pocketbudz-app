import {Pressable, Text, View} from 'react-native';
import React from 'react';
import Element from './Element';

const Button = ({onPress, type, elementType, children, style}) => {
  return (
    type === 'custom' ? (
        <Pressable onPress={onPress} style={style}>
            <View style={{alignItems: 'center', justifyContent: 'center', backgroundColor: 'green', borderRadius: 5, padding: 10}}>
                <Element elementType={elementType} style={style}>
                    {children}
                </Element>
            </View>
        </Pressable>
    ) : (
    <Pressable onPress={onPress} style={style}>
        <Element elementType={elementType} style={style}>
            {children}
        </Element>
    </Pressable>
    )
)
};

export default Button;