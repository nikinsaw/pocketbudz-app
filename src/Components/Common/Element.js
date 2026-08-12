import {Text, View, Image} from 'react-native';
import React from 'react';

const Element = ({ type, children, style }) => {
    switch (type) {
        case 'text':
            return <Text style={style}>{children}</Text>;
        case 'view':
            return <View style={style}>{children}</View>;
        case 'image':
            return <Image style={style} source={children} />;
        default:
            return null;
    }
};

export default Element;