/**
 * Call Components - Barrel exports
 * 
 * The building blocks for Discord-like call UI:
 * - StreamCard: Atomic video/audio card with lifecycle management
 * - ParticipantCard: User camera/avatar cards
 * - ScreenShareCard: Screen share with LIVE badge
 * - ThumbnailStrip: Non-focused participants bar
 * - CallContainer: Layout orchestrator for multi-participant calls
 * - InCallChatSection: Chat section for use during calls
 */

export { StreamCard, type StreamCardProps, type StreamType } from './StreamCard';
export { ParticipantCard, type ParticipantCardProps } from './ParticipantCard';
export { ScreenShareCard, type ScreenShareCardProps } from './ScreenShareCard';
export { ThumbnailStrip, type ThumbnailStripProps } from './ThumbnailStrip';
export { CallContainer, type CallContainerProps } from './CallContainer';
export { DeviceSettingsPopover } from './DeviceSettingsPopover';
export { MiniPlayer } from './MiniPlayer';
export { InCallChatSection } from './InCallChatSection';
export { VoiceConnectionPanel } from './VoiceConnectionPanel';
export { CallAudioManager } from './CallAudioManager';
