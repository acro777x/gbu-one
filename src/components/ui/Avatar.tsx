import React from 'react';
import { StyleSheet, View, Text, Image, ViewStyle } from 'react-native';
import { User } from 'lucide-react-native';
import { theme } from '../../lib/theme';

export interface AvatarProps {
  url?: string | null;
  name?: string;
  size?: number;
  isGuest?: boolean;
  style?: ViewStyle;
}

export const Avatar: React.FC<AvatarProps> = ({
  url,
  name,
  size = 40,
  isGuest = false,
  style,
}) => {
  const getInitials = (n?: string) => {
    if (!n) return 'G';
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  const squircleRadius = Math.round(size * 0.45);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: squircleRadius,
        },
        style,
      ]}
    >
      {url ? (
        <Image
          source={{ uri: url }}
          style={[styles.image, { borderRadius: squircleRadius }]}
        />
      ) : isGuest || !name ? (
        <User size={size * 0.55} color={theme.colors.textSecondary} />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.4 }]}>
          {getInitials(name)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#202024',
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initials: {
    color: theme.colors.ivory,
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
  },
});

export default Avatar;
