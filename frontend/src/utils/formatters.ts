/**
 * Format a timestamp to a human-readable date string
 * @param timestamp Unix timestamp in seconds or milliseconds
 * @param options Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export const formatDate = (
  timestamp: number,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }
): string => {
  // Check if timestamp is in seconds (Unix timestamp) and convert to milliseconds if needed
  const timestampMs = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
  
  return new Date(timestampMs).toLocaleDateString(undefined, options);
};

/**
 * Format a number to a currency string
 * @param value Number to format
 * @param currency Currency code (default: 'USD')
 * @param locale Locale string (default: browser locale)
 * @returns Formatted currency string
 */
export const formatCurrency = (
  value: number,
  currency: string = 'USD',
  locale?: string
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

/**
 * Format a number to a percentage string
 * @param value Number to format (0-1)
 * @param decimals Number of decimal places
 * @returns Formatted percentage string
 */
export const formatPercentage = (
  value: number,
  decimals: number = 2
): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * Truncate a string to a maximum length and add ellipsis
 * @param str String to truncate
 * @param maxLength Maximum length
 * @returns Truncated string
 */
export const truncateString = (
  str: string,
  maxLength: number = 20
): string => {
  if (str.length <= maxLength) return str;
  return `${str.substring(0, maxLength)}...`;
};

/**
 * Format an Ethereum address to a shortened form
 * @param address Ethereum address
 * @param startChars Number of characters to show at the start
 * @param endChars Number of characters to show at the end
 * @returns Shortened address
 */
export const formatAddress = (
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string => {
  if (!address) return '';
  if (address.length <= startChars + endChars) return address;
  
  return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
};
