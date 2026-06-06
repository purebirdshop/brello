// mobile/app/tabs/_layout.tsx
// Main app tab navigator. Phase 2 stubs — filled in Phase 3+.

import React from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { View, StyleSheet } from 'react-native'
import { colors } from '../../lib/theme'
import { useNotificationStore } from '../../store/notificationStore'

export default function TabsLayout() {
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  return (
    <Tabs
      screenOptions={{
        headerShown:          false,
        tabBarStyle: {
          backgroundColor:    colors.surface,
          borderTopColor:     colors.border,
          borderTopWidth:     1,
          height:             64,
          paddingBottom:      8,
        },
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize:   11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: 'Listings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="circle"
        options={{
          title: 'Circle',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="person-outline" color={color} size={size} />
              {unreadCount > 0 && <View style={badgeStyle.dot} />}
            </View>
          ),
        }}
      />
    </Tabs>
  )
}

const badgeStyle = StyleSheet.create({
  dot: {
    position:        'absolute',
    top:             0,
    right:           0,
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: colors.error,
    borderWidth:     1.5,
    borderColor:     colors.surface,
  },
})
