import * as React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TabNavigator } from './src/Navigators';
import { IconHome, IconInsights } from './src/SVGs/BottomTabIcons';

enableScreens();

function HomeScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Home Screen</Text>
    </View>
  );
}

function InsightsScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Insights Screen</Text>  
    </View>
  );
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function RootStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} >
      <Stack.Screen name="Tabs" component={MyTabs} />
    </Stack.Navigator>
  );
}


function MyTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <TabNavigator {...props} />}>
      <Tab.Screen name="Home" component={HomeScreen} options={{tabBarIcon: (props) => <IconHome {...props} />}} />
      <Tab.Screen name="Insights" component={InsightsScreen} options={{tabBarIcon: (props) => <IconInsights {...props} />}} />
    </Tab.Navigator>
  );
}

function App() {
  return (
    <NavigationContainer>
      <RootStack />
    </NavigationContainer>
  );
}

export default App;
