import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, Download, ExternalLink, RotateCw } from 'lucide-react';
import { create } from 'zustand';

// Lightbox store for global state
interface LightboxState {
    isOpen: boolean;
    mediaUrl: string | null;
    mediaType: 'image' | 'video' | null;
    openLightbox: (url: string, type: 'image' | 'video') => void;
    closeLightbox: () => void;
}

export const useLightboxStore = create<LightboxState>((set) => ({
    isOpen: false,
    mediaUrl: null,
    mediaType: null,
    openLightbox: (url, type) => set({ isOpen: true, mediaUrl: url, mediaType: type }),
    closeLightbox: () => set({ isOpen: false, mediaUrl: null, mediaType: null }),
}));

/**
 * MediaLightbox - Full-screen media viewer
 * Features:
 * - Dark backdrop
 * - Zoom controls
 * - Download/Open Original links
 * - ESC to close
 * - Click outside to close
 */
export function MediaLightbox() {
    const { isOpen, mediaUrl, mediaType, closeLightbox } = useLightboxStore();
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    // Reset zoom/rotation when opening new media
    useEffect(() => {
        if (isOpen) {
            setZoom(1);
            setRotation(0);
        }
    }, [isOpen, mediaUrl]);

    // ESC key handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                closeLightbox();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, closeLightbox]);

    const handleZoomIn = useCallback(() => {
        setZoom((prev) => Math.min(prev + 0.5, 4));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoom((prev) => Math.max(prev - 0.5, 0.5));
    }, []);

    const handleRotate = useCallback(() => {
        setRotation((prev) => (prev + 90) % 360);
    }, []);

    const handleDownload = useCallback(() => {
        if (!mediaUrl) return;
        const link = document.createElement('a');
        link.href = mediaUrl;
        link.download = mediaUrl.split('/').pop() || 'download';
        link.click();
    }, [mediaUrl]);

    const handleOpenOriginal = useCallback(() => {
        if (mediaUrl) {
            window.open(mediaUrl, '_blank');
        }
    }, [mediaUrl]);

    return (
        <AnimatePresence>
            {isOpen && mediaUrl && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[300] flex items-center justify-center"
                    onClick={closeLightbox}
                >
                    {/* Dark Backdrop */}
                    <div className="absolute inset-0 bg-black/90" />

                    {/* Controls Bar - Top */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2">
                            {/* Zoom Controls */}
                            <button
                                onClick={handleZoomOut}
                                disabled={zoom <= 0.5}
                                className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg text-white transition-colors"
                                title="Zoom Out"
                            >
                                <ZoomOut size={20} />
                            </button>
                            <span className="text-white text-sm font-medium min-w-[50px] text-center">
                                {Math.round(zoom * 100)}%
                            </span>
                            <button
                                onClick={handleZoomIn}
                                disabled={zoom >= 4}
                                className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg text-white transition-colors"
                                title="Zoom In"
                            >
                                <ZoomIn size={20} />
                            </button>

                            {/* Rotate */}
                            {mediaType === 'image' && (
                                <button
                                    onClick={handleRotate}
                                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors ml-2"
                                    title="Rotate"
                                >
                                    <RotateCw size={20} />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Open Original */}
                            <button
                                onClick={handleOpenOriginal}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                                title="Open Original"
                            >
                                <ExternalLink size={20} />
                            </button>

                            {/* Download */}
                            <button
                                onClick={handleDownload}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                                title="Download"
                            >
                                <Download size={20} />
                            </button>

                            {/* Close */}
                            <button
                                onClick={closeLightbox}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                                title="Close (ESC)"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </motion.div>

                    {/* Media Content */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative max-w-[90vw] max-h-[85vh] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            transform: `scale(${zoom}) rotate(${rotation}deg)`,
                            transition: 'transform 0.2s ease',
                        }}
                    >
                        {mediaType === 'image' ? (
                            <img
                                src={mediaUrl}
                                alt=""
                                className="max-w-full max-h-[85vh] object-contain rounded-lg"
                                draggable={false}
                            />
                        ) : (
                            <video
                                src={mediaUrl}
                                controls
                                autoPlay
                                className="max-w-full max-h-[85vh] rounded-lg"
                            />
                        )}
                    </motion.div>

                    {/* Close hint */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm">
                        Click outside or press ESC to close
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/**
 * Hook to open lightbox from anywhere
 */
export function useMediaLightbox() {
    const { openLightbox, closeLightbox } = useLightboxStore();

    const openImage = useCallback((url: string) => {
        openLightbox(url, 'image');
    }, [openLightbox]);

    const openVideo = useCallback((url: string) => {
        openLightbox(url, 'video');
    }, [openLightbox]);

    return { openImage, openVideo, closeLightbox };
}
