import { useState } from 'react';
import { Settings, Mic, Camera, Volume2, ChevronDown, X } from 'lucide-react';
import { useMediaDevices, type MediaDevice } from '@/hooks/useMediaDevices';

interface DeviceSettingsPopoverProps {
    onDeviceChange?: (kind: 'audioinput' | 'videoinput' | 'audiooutput', deviceId: string) => void;
}

/**
 * Device Settings Popover - Shown in ActiveCallModal
 * Allows switching microphone, camera, and speaker mid-call
 */
export function DeviceSettingsPopover({ onDeviceChange }: DeviceSettingsPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const {
        audioInputs,
        audioOutputs,
        videoInputs,
        selectedAudioInput,
        selectedAudioOutput,
        selectedVideoInput,
        selectAudioInput,
        selectAudioOutput,
        selectVideoInput,
    } = useMediaDevices();

    const handleSelectDevice = (kind: MediaDevice['kind'], deviceId: string) => {
        switch (kind) {
            case 'audioinput':
                selectAudioInput(deviceId);
                break;
            case 'audiooutput':
                selectAudioOutput(deviceId);
                break;
            case 'videoinput':
                selectVideoInput(deviceId);
                break;
        }
        onDeviceChange?.(kind, deviceId);
    };

    return (
        <div className="relative">
            {/* Settings Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                title="Device Settings"
            >
                <Settings size={18} className="text-white" />
            </button>

            {/* Popover */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Panel */}
                    <div className="absolute bottom-full mb-2 right-0 w-72 bg-[#1e1f22] rounded-lg shadow-xl border border-white/10 z-50 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                            <span className="font-semibold text-text-heading">Device Settings</span>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                            >
                                <X size={16} className="text-text-muted" />
                            </button>
                        </div>

                        {/* Device Sections */}
                        <div className="p-3 space-y-4">
                            {/* Microphone */}
                            <DeviceSelect
                                label="Microphone"
                                icon={<Mic size={16} />}
                                devices={audioInputs}
                                selectedId={selectedAudioInput}
                                onSelect={(id) => handleSelectDevice('audioinput', id)}
                            />

                            {/* Camera */}
                            <DeviceSelect
                                label="Camera"
                                icon={<Camera size={16} />}
                                devices={videoInputs}
                                selectedId={selectedVideoInput}
                                onSelect={(id) => handleSelectDevice('videoinput', id)}
                            />

                            {/* Speaker */}
                            <DeviceSelect
                                label="Speaker"
                                icon={<Volume2 size={16} />}
                                devices={audioOutputs}
                                selectedId={selectedAudioOutput}
                                onSelect={(id) => handleSelectDevice('audiooutput', id)}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

/**
 * Device Select Dropdown
 */
function DeviceSelect({
    label,
    icon,
    devices,
    selectedId,
    onSelect,
}: {
    label: string;
    icon: React.ReactNode;
    devices: MediaDevice[];
    selectedId: string | null;
    onSelect: (deviceId: string) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const selectedDevice = devices.find(d => d.deviceId === selectedId);

    return (
        <div>
            {/* Label */}
            <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
                {icon}
                <span className="uppercase font-semibold">{label}</span>
            </div>

            {/* Dropdown Button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-3 py-2 bg-background-tertiary rounded hover:bg-background-modifier-hover transition-colors text-left"
            >
                <span className="text-sm text-text-normal truncate">
                    {selectedDevice?.label || 'Default'}
                </span>
                <ChevronDown
                    size={14}
                    className={`text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Options */}
            {isExpanded && (
                <div className="mt-1 bg-background-tertiary rounded overflow-hidden">
                    {devices.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-text-muted italic">
                            No devices found
                        </div>
                    ) : (
                        devices.map((device) => (
                            <button
                                key={device.deviceId}
                                onClick={() => {
                                    onSelect(device.deviceId);
                                    setIsExpanded(false);
                                }}
                                className={`w-full px-3 py-2 text-sm text-left transition-colors ${device.deviceId === selectedId
                                        ? 'bg-discord-primary text-white'
                                        : 'text-text-normal hover:bg-background-modifier-hover'
                                    }`}
                            >
                                {device.label}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
