import { Tabs } from 'expo-router'
import { Text } from 'react-native'

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 11, color: focused ? '#E11D48' : '#6B7280', fontWeight: focused ? '700' : '500' }}>
      {label}
    </Text>
  )
}

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: '#E11D48',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Today', tabBarLabel: ({ focused }) => <TabLabel label="Home" focused={focused} /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'History', tabBarLabel: ({ focused }) => <TabLabel label="History" focused={focused} /> }}
      />
      <Tabs.Screen
        name="device"
        options={{ title: 'Device', tabBarLabel: ({ focused }) => <TabLabel label="Device" focused={focused} /> }}
      />
      <Tabs.Screen
        name="requests"
        options={{ title: 'Requests', tabBarLabel: ({ focused }) => <TabLabel label="Requests" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarLabel: ({ focused }) => <TabLabel label="Profile" focused={focused} /> }}
      />
    </Tabs>
  )
}
