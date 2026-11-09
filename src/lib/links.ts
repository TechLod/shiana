import { Alert, Linking } from 'react-native';

/** Opens a phone number or email address. */
export function openContact(contact: string): void {
  const trimmed = contact.trim();
  const url = trimmed.includes('@') ? `mailto:${trimmed}` : `tel:${trimmed.replace(/\s+/g, '')}`;
  Linking.openURL(url).catch(() => Alert.alert('Could not open this contact'));
}

/** Opens a website, adding https:// when it is missing. */
export function openLink(url: string): void {
  const trimmed = url.trim();
  const full = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  Linking.openURL(full).catch(() => Alert.alert('Could not open this link'));
}
