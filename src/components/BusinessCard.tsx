import React from 'react';
import { Image, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { formatDistance, timeAgo } from '../lib/format';
import { colors } from '../lib/theme';
import { Business } from '../types';

export function BusinessCard({
  business,
  onPress,
  style,
}: {
  business: Business;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const distance = formatDistance(business.distance);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
    >
      {business.cover_url ? (
        <Image source={{ uri: business.cover_url }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <Text style={styles.coverEmoji}>📍</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.meta}>{timeAgo(business.created_at ?? "")}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {business.name}
        </Text>
        {business.address ? (
          <Text style={styles.meta} numberOfLines={1}>
            {business.address}
          </Text>
        ) : null}
        {business.opening_hours ? (
          <Text style={styles.meta} numberOfLines={1}>
            {business.opening_hours}
          </Text>
        ) : null}
        <View style={styles.footer}>
          {distance ? <Text style={styles.footerText}>{distance} away</Text> : null}
          {business.rating_count > 0 ? (
            <Text style={styles.footerText}>
              ★ {Number(business.rating_avg).toFixed(1)} ({business.rating_count})
            </Text>
          ) : null}
          {business.price_from ? <Text style={styles.footerText}>From {business.price_from}</Text> : null}
          {business.category === 'hotel' && business.rooms_available !== null ? (
            <Text style={styles.footerText}>{business.rooms_available} rooms available</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.85 },
  cover: { width: '100%', height: 130, backgroundColor: colors.cardAlt },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  coverEmoji: { fontSize: 36 },
  body: { padding: 12, gap: 3 },
  category: { fontSize: 12, fontWeight: '700', color: colors.accent },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.sub },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  footerText: { fontSize: 13, color: colors.text },
});